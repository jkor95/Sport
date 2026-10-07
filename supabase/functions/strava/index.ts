class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
const env=(name:string)=>{const v=Deno.env.get(name);if(!v)throw new HttpError(503,`Serverinstelling ${name} ontbreekt.`);return v;};
const cors=()=>({'Access-Control-Allow-Origin':Deno.env.get('APP_ORIGIN')||'https://invalid.invalid','Access-Control-Allow-Headers':'content-type, apikey, x-local-account, x-local-secret','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'});
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors(),'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
const safeReturnUrl=(value:unknown)=>{const u=new URL(String(value||env('APP_ORIGIN')));if(u.origin!==env('APP_ORIGIN'))throw new HttpError(400,'Ongeldige terugkeer-URL.');u.search='';u.hash='';return u.toString();};
const randomHex=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
async function sha256(value:string){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function adminRest(path:string,options:RequestInit={}){const key=env('SUPABASE_SERVICE_ROLE_KEY');const res=await fetch(env('SUPABASE_URL')+'/rest/v1/'+path,{...options,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(15000)});if(!res.ok)throw new HttpError(503,'Serveropslag voor Strava mislukt.');const text=await res.text();return text?JSON.parse(text):null;}
async function readBody(req:Request){try{return await req.json();}catch{throw new HttpError(400,'Ongeldig verzoek.');}}
const callbackUrl=()=>env('SUPABASE_URL')+'/functions/v1/strava/callback';
async function exchangeToken(params:Record<string,string>){const body=new URLSearchParams(params);body.set('client_id',env('STRAVA_CLIENT_ID'));body.set('client_secret',env('STRAVA_CLIENT_SECRET'));const res=await fetch('https://www.strava.com/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(20000)});if(!res.ok)throw new HttpError(502,'Strava kon de koppeling niet afronden.');return res.json();}
async function tokenRow(accountId:string){const rows=await adminRest('mijnloop_local_strava_tokens?account_id=eq.'+encodeURIComponent(accountId)+'&select=*');return rows?.[0]||null;}
async function localAccount(req:Request,{allowCreate=false}={}){const accountId=req.headers.get('X-Local-Account')||'',secret=req.headers.get('X-Local-Secret')||'';if(!/^[0-9a-f-]{36}$/i.test(accountId)||!/^[a-f0-9]{64}$/i.test(secret))throw new HttpError(401,'Ongeldige lokale accountkoppeling.');const hash=await sha256(secret.toLowerCase()),row=await tokenRow(accountId);if(!row){if(!allowCreate)return {accountId,hash,row:null};return {accountId,hash,row:null};}if(row.secret_hash!==hash)throw new HttpError(401,'Lokale accountkoppeling is niet geldig op dit apparaat.');return {accountId,hash,row};}
async function validAccess(row:any){if(!row?.refresh_token)throw new HttpError(400,'Strava is niet gekoppeld.');const now=Math.floor(Date.now()/1000);if(row.access_token&&Number(row.expires_at)>now+120)return {row,accessToken:String(row.access_token)};const fresh=await exchangeToken({grant_type:'refresh_token',refresh_token:String(row.refresh_token)});const updated={...row,access_token:fresh.access_token,refresh_token:fresh.refresh_token||row.refresh_token,expires_at:fresh.expires_at,scope:fresh.scope||row.scope,updated_at:new Date().toISOString()};await adminRest('mijnloop_local_strava_tokens?account_id=eq.'+encodeURIComponent(row.account_id),{method:'PATCH',body:JSON.stringify({access_token:updated.access_token,refresh_token:updated.refresh_token,expires_at:updated.expires_at,scope:updated.scope,updated_at:updated.updated_at})});return {row:updated,accessToken:String(updated.access_token)};}
const isRun=(a:any)=>['Run','TrailRun','VirtualRun'].includes(String(a?.sport_type||a?.type||''));
const bestEfforts=(detail:any)=>Array.isArray(detail?.best_efforts)?detail.best_efforts.map((e:any)=>({name:String(e.name||''),distanceKm:Math.round((Number(e.distance)||0)/100)/10,seconds:Math.max(1,Math.round(Number(e.moving_time||e.elapsed_time)||0))})).filter((e:any)=>e.distanceKm>0&&e.seconds>0):[];
async function stravaGet(path:string,token:string){const res=await fetch('https://www.strava.com/api/v3'+path,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(20000)});if(res.status===429)throw new HttpError(429,'Strava API-limiet bereikt. Probeer later opnieuw.');if(!res.ok)throw new HttpError(502,'Strava-gegevens konden niet worden opgehaald.');return res.json();}
function normalize(a:any,detail:any|null){const km=(Number(a.distance)||0)/1000,seconds=Math.max(1,Number(a.moving_time)||Number(a.elapsed_time)||0);const local=String(a.start_date_local||a.start_date||'');const src=detail||a;return {provider:'strava',id:String(a.id),name:String(a.name||'Strava hardlooptraining').slice(0,120),date:local.slice(0,10),time:/T(\d{2}:\d{2})/.exec(local)?.[1]||'12:00',distanceKm:Math.round(km*100)/100,movingSeconds:Math.round(seconds),elapsedSeconds:Math.round(Number(a.elapsed_time)||seconds),averagePaceSeconds:km>0?Math.round(seconds/km):0,elevationGain:Math.round((Number(a.total_elevation_gain)||0)*10)/10,averageHeartrate:Number(src.average_heartrate)||0,maxHeartrate:Number(src.max_heartrate)||0,averageCadence:Number(src.average_cadence)||0,deviceName:String(detail?.device_name||a.device_name||''),url:'https://www.strava.com/activities/'+String(a.id),bestEfforts:bestEfforts(detail)};}
function redirect(url:string,status:string){const u=new URL(url);u.searchParams.set('strava',status);return Response.redirect(u.toString(),302);}

Deno.serve(async(req:Request)=>{
  try{
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors()});
    const url=new URL(req.url);
    if(req.method==='GET'&&url.pathname.endsWith('/callback')){
      const state=url.searchParams.get('state')||'',code=url.searchParams.get('code')||'',error=url.searchParams.get('error')||'';
      if(!/^[a-f0-9]{64}$/.test(state))return redirect(env('APP_ORIGIN'),'error');
      const rows=await adminRest('mijnloop_local_strava_tokens?oauth_state=eq.'+state+'&select=*'),row=rows?.[0];if(!row||!row.return_url||!row.oauth_expires||Date.parse(row.oauth_expires)<Date.now())return redirect(env('APP_ORIGIN'),'error');
      const returnUrl=safeReturnUrl(row.return_url);
      if(error||!code){await adminRest('mijnloop_local_strava_tokens?account_id=eq.'+row.account_id,{method:'PATCH',body:JSON.stringify({oauth_state:null,oauth_expires:null,updated_at:new Date().toISOString()})});return redirect(returnUrl,'denied');}
      const tok=await exchangeToken({grant_type:'authorization_code',code}),athlete=tok.athlete||{};
      await adminRest('mijnloop_local_strava_tokens?account_id=eq.'+row.account_id,{method:'PATCH',body:JSON.stringify({athlete_id:athlete.id||null,athlete_name:[athlete.firstname,athlete.lastname].filter(Boolean).join(' ').slice(0,120),access_token:tok.access_token,refresh_token:tok.refresh_token,expires_at:tok.expires_at,scope:tok.scope||'',connected_at:new Date().toISOString(),oauth_state:null,oauth_expires:null,updated_at:new Date().toISOString()})});
      return redirect(returnUrl,'connected');
    }
    if(req.method!=='POST')throw new HttpError(405,'Alleen POST is toegestaan.');
    const origin=req.headers.get('Origin');if(origin&&origin!==env('APP_ORIGIN'))throw new HttpError(403,'Deze website is niet toegelaten.');
    const body=await readBody(req),action=String(body.action||''),local=await localAccount(req,{allowCreate:action==='start'});
    if(action==='start'){
      const oauthState=randomHex(),returnUrl=safeReturnUrl(body.returnUrl),expires=new Date(Date.now()+10*60*1000).toISOString();
      if(!local.row){await adminRest('mijnloop_local_strava_tokens',{method:'POST',body:JSON.stringify({account_id:local.accountId,secret_hash:local.hash,oauth_state:oauthState,oauth_expires:expires,return_url:returnUrl,updated_at:new Date().toISOString()})});}
      else await adminRest('mijnloop_local_strava_tokens?account_id=eq.'+local.accountId,{method:'PATCH',body:JSON.stringify({oauth_state:oauthState,oauth_expires:expires,return_url:returnUrl,updated_at:new Date().toISOString()})});
      const auth=new URL('https://www.strava.com/oauth/authorize');auth.searchParams.set('client_id',env('STRAVA_CLIENT_ID'));auth.searchParams.set('redirect_uri',callbackUrl());auth.searchParams.set('response_type','code');auth.searchParams.set('approval_prompt','auto');auth.searchParams.set('scope','activity:read_all');auth.searchParams.set('state',oauthState);return json({url:auth.toString()});
    }
    const row=local.row;
    if(action==='status')return json({connected:!!row?.refresh_token,athleteName:row?.athlete_name||'',lastSync:row?.last_sync||null});
    if(action==='disconnect'){
      if(row?.refresh_token){try{const basic=btoa(env('STRAVA_CLIENT_ID')+':'+env('STRAVA_CLIENT_SECRET'));await fetch('https://www.strava.com/oauth/revoke',{method:'POST',headers:{Authorization:'Basic '+basic,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:String(row.refresh_token),token_type_hint:'refresh_token'}),signal:AbortSignal.timeout(10000)});}catch{}}
      if(row)await adminRest('mijnloop_local_strava_tokens?account_id=eq.'+local.accountId,{method:'DELETE'});return json({disconnected:true});
    }
    if(action!=='sync')throw new HttpError(400,'Onbekende actie.');
    const {row:active,accessToken}=await validAccess(row),known=new Set(Array.isArray(body.knownIds)?body.knownIds.map(String).slice(0,150):[]);
    const after=Math.floor(Date.now()/1000)-180*86400,list=await stravaGet('/athlete/activities?after='+after+'&per_page=50&page=1',accessToken),runs=(Array.isArray(list)?list:[]).filter(isRun).slice(0,50),out=[];
    for(const a of runs){let detail:any=null;if(!known.has(String(a.id))){try{detail=await stravaGet('/activities/'+encodeURIComponent(String(a.id))+'?include_all_efforts=false',accessToken);}catch(e){if(e instanceof HttpError&&e.status===429)throw e;}}out.push(normalize(a,detail));}
    const now=new Date().toISOString();await adminRest('mijnloop_local_strava_tokens?account_id=eq.'+local.accountId,{method:'PATCH',body:JSON.stringify({last_sync:now,updated_at:now})});return json({activities:out,lastSync:now,athleteName:active.athlete_name||''});
  }catch(e){if(e instanceof HttpError)return json({error:e.message},e.status);return json({error:'Strava-koppeling gaf een serverfout.'},500);}
});
