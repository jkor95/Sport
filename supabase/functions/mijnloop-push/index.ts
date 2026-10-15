
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const ORIGIN = 'https://jkor95.github.io';
const headers = (origin:string|null)=>({
  'Access-Control-Allow-Origin': origin===ORIGIN?origin:ORIGIN,
  'Access-Control-Allow-Headers':'content-type, apikey, x-mijnloop-session, x-mijnloop-push-secret',
  'Access-Control-Allow-Methods':'POST, OPTIONS',
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store',
  'Vary':'Origin'
});
const json=(body:unknown,status=200,origin:string|null=null)=>new Response(JSON.stringify(body),{status,headers:headers(origin)});
const bytesHex=(b:Uint8Array)=>[...b].map(x=>x.toString(16).padStart(2,'0')).join('');
async function sha(v:string){return bytesHex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))));}

const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
let cachedConfig:any=null,cachedAt=0;
async function pushConfig(){
  if(cachedConfig && Date.now()-cachedAt<300000)return cachedConfig;
  const {data,error}=await sb.from('mijnloop_push_config').select('vapid_public,vapid_private,cron_secret').eq('id',1).maybeSingle();
  if(error||!data)throw new Error('Pushconfiguratie ontbreekt.');
  cachedConfig=data;cachedAt=Date.now();
  webpush.setVapidDetails('https://jkor95.github.io/Sport/',data.vapid_public,data.vapid_private);
  return data;
}
async function session(req:Request){
  const raw=req.headers.get('x-mijnloop-session')||'';
  if(!raw)throw Object.assign(new Error('Je sessie is verlopen. Log opnieuw in.'),{status:401});
  const h=await sha(raw);
  const {data:s,error}=await sb.from('mijnloop_sessions').select('account_id,expires_at').eq('token_hash',h).gt('expires_at',new Date().toISOString()).maybeSingle();
  if(error||!s)throw Object.assign(new Error('Je sessie is verlopen. Log opnieuw in.'),{status:401});
  const {data:u}=await sb.from('mijnloop_accounts').select('id,active').eq('id',s.account_id).maybeSingle();
  if(!u?.active)throw Object.assign(new Error('Dit account is niet actief.'),{status:401});
  return u;
}
const asSubscription=(s:any)=>typeof s?.endpoint==='string'&&s.endpoint.startsWith('https://')&&typeof s?.keys?.auth==='string'&&typeof s?.keys?.p256dh==='string';

function amsterdamMs(date:string,time:string){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date||'');
  const t=/^(\d{2}):(\d{2})$/.exec(time||'');
  if(!m||!t)return NaN;
  const guess=Date.UTC(+m[1],+m[2]-1,+m[3],+t[1],+t[2],0);
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Europe/Amsterdam',timeZoneName:'shortOffset',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(guess));
  const tz=parts.find(p=>p.type==='timeZoneName')?.value||'GMT+0';
  const om=/GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(tz);
  const off=om?((om[1]==='-'?-1:1)*(Number(om[2])*60+Number(om[3]||0))):0;
  return guess-off*60000;
}
function kmText(v:any){return Number(v||0).toLocaleString('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2});}
function notificationPrefs(state:any){
  const n=state?.notifications&&typeof state.notifications==='object'?state.notifications:{};
  return {
    enabled:n.enabled!==false,
    pushUpcoming:n.pushUpcoming!==false,
    pushPending:n.pushPending!==false,
    upcoming:n.upcoming!==false,
    upcomingHours:[1,2,4,8,12,24,48].includes(Number(n.upcomingHours))?Number(n.upcomingHours):4,
    pending:n.pending!==false,
    pendingDelayMinutes:[0,15,30,60,120,180].includes(Number(n.pendingDelayMinutes))?Number(n.pendingDelayMinutes):30
  };
}
function candidateEvents(state:any,nowMs=Date.now()){
  const pref=notificationPrefs(state),out:any[]=[];
  if(!pref.enabled)return out;
  for(const w of Array.isArray(state?.workouts)?state.workouts:[]){
    if(!w||w.status!=='planned')continue;
    const startMs=amsterdamMs(String(w.date||''),String(w.time||''));
    if(!Number.isFinite(startMs))continue;
    const endMs=startMs+Math.max(0,Number(w.minutes)||0)*60000;
    const base={workoutId:String(w.id||''),date:String(w.date||''),time:String(w.time||''),title:String(w.title||'Training')};
    if(pref.pushUpcoming&&pref.upcoming&&startMs>nowMs&&startMs-nowMs<=pref.upcomingHours*3600000){
      out.push({
        key:`upcoming:${base.workoutId}:${base.date}:${base.time}`,
        category:'upcoming',
        workoutId:base.workoutId,
        title:'Training komt eraan',
        body:`${base.title} om ${base.time}${w.sport==='run'&&Number(w.km)>0?` · ${kmText(w.km)} km`:''}.`
      });
    }
    if(pref.pushPending&&pref.pending&&nowMs>=endMs+pref.pendingDelayMinutes*60000&&nowMs-endMs<=7*86400000){
      out.push({
        key:`pending:${base.workoutId}:${base.date}:${base.time}`,
        category:'pending',
        workoutId:base.workoutId,
        title:'Training nog invullen',
        body:`${base.title} stond gepland op ${base.date} om ${base.time}. Vul in wat je werkelijk hebt gedaan.`
      });
    }
  }
  return out;
}
async function subscriptionsFor(accountId:string){
  const {data,error}=await sb.from('mijnloop_push_subscriptions').select('endpoint,subscription').eq('account_id',accountId);
  if(error)throw error;
  return data||[];
}
async function sendPayload(subs:any[],payload:any){
  let delivered=0,failed=0;
  const seen=new Set<string>();
  for(const row of subs){
    if(!row?.endpoint||seen.has(row.endpoint))continue;seen.add(row.endpoint);
    try{
      await webpush.sendNotification(row.subscription,JSON.stringify(payload),{TTL:86400});
      delivered++;
    }catch(e:any){
      failed++;
      if([404,410].includes(Number(e?.statusCode)))await sb.from('mijnloop_push_subscriptions').delete().eq('endpoint',row.endpoint);
    }
  }
  return {delivered,failed};
}
async function scheduledCheck(){
  await pushConfig();
  const {data:subs,error}=await sb.from('mijnloop_push_subscriptions').select('endpoint,account_id,subscription');
  if(error)throw error;
  const grouped=new Map<string,any[]>();
  for(const s of subs||[]){const arr=grouped.get(s.account_id)||[];arr.push(s);grouped.set(s.account_id,arr);}
  let accountsChecked=0,notificationsSent=0;
  const nowMs=Date.now();
  for(const [accountId,accountSubs] of grouped){
    const {data:stateRow,error:stateError}=await sb.from('mijnloop_states').select('data').eq('account_id',accountId).maybeSingle();
    if(stateError||!stateRow?.data)continue;
    accountsChecked++;
    for(const ev of candidateEvents(stateRow.data,nowMs)){
      const {error:claimError}=await sb.from('mijnloop_push_events').insert({account_id:accountId,event_key:ev.key,category:ev.category,workout_id:ev.workoutId});
      if(claimError?.code==='23505')continue;
      if(claimError)continue;
      const result=await sendPayload(accountSubs,{kind:ev.category,title:ev.title,body:ev.body,tag:'mijnloop-'+ev.key,data:{url:'./'}});
      if(result.delivered>0){
        notificationsSent+=result.delivered;
        await sb.from('mijnloop_push_events').update({sent_at:new Date().toISOString()}).eq('account_id',accountId).eq('event_key',ev.key);
      }else{
        await sb.from('mijnloop_push_events').delete().eq('account_id',accountId).eq('event_key',ev.key);
      }
    }
  }
  return {ok:true,accountsChecked,notificationsSent};
}

Deno.serve(async(req)=>{
  const origin=req.headers.get('Origin');
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)});
  if(origin&&origin!==ORIGIN)return json({error:'Deze website is niet toegestaan.'},403,origin);
  if(req.method!=='POST')return json({error:'Alleen POST is toegestaan.'},405,origin);
  let body:any={};try{body=await req.json();}catch{return json({error:'Ongeldige aanvraag.'},400,origin);}
  const action=String(body.action||'');
  try{
    if(action==='scheduled-check'){
      const cfg=await pushConfig();
      if(!cfg.cron_secret||req.headers.get('x-mijnloop-push-secret')!==cfg.cron_secret)return json({error:'Niet toegestaan.'},401,origin);
      return json(await scheduledCheck(),200,origin);
    }
    const account=await session(req);
    const cfg=await pushConfig();
    if(action==='config')return json({publicKey:cfg.vapid_public},200,origin);
    if(action==='status'){
      const {count}=await sb.from('mijnloop_push_subscriptions').select('*',{count:'exact',head:true}).eq('account_id',account.id);
      return json({subscribed:(count||0)>0,count:Number(count||0)},200,origin);
    }
    if(action==='subscribe'){
      const s=body.subscription;
      if(!asSubscription(s))return json({error:'Ongeldig pushabonnement.'},400,origin);
      const {error}=await sb.from('mijnloop_push_subscriptions').upsert({endpoint:s.endpoint,account_id:account.id,subscription:s,updated_at:new Date().toISOString()},{onConflict:'endpoint'});
      if(error)throw error;
      return json({ok:true},200,origin);
    }
    if(action==='unsubscribe'){
      const endpoint=body.subscription?.endpoint;
      if(typeof endpoint!=='string')return json({error:'Ongeldig pushabonnement.'},400,origin);
      const {error}=await sb.from('mijnloop_push_subscriptions').delete().eq('endpoint',endpoint).eq('account_id',account.id);
      if(error)throw error;
      return json({ok:true},200,origin);
    }
    if(action==='test'){
      const subs=await subscriptionsFor(account.id);
      if(!subs.length)return json({error:'Schakel eerst echte pushmeldingen in op dit apparaat.'},409,origin);
      const result=await sendPayload(subs,{kind:'test',title:'MijnLoop – Testmelding',body:'Je echte pushmeldingen werken! ✅',tag:'mijnloop-test-'+crypto.randomUUID(),data:{url:'./'}});
      if(!result.delivered)return json({error:'De testmelding kon niet worden afgeleverd.'},503,origin);
      return json({ok:true,...result},200,origin);
    }
    return json({error:'Onbekende actie.'},400,origin);
  }catch(e:any){
    return json({error:e?.message||'Serverfout.'},e?.status||500,origin);
  }
});
