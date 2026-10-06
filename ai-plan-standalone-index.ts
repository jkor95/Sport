export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(503, 'Serverconfiguratie ontbreekt. Controleer de installatiehandleiding.');
  return value;
}
export function cors(): HeadersInit {
  return {'Access-Control-Allow-Origin':Deno.env.get('APP_ORIGIN')||'https://invalid.invalid',
    'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods':'POST, OPTIONS', 'Vary':'Origin'};
}
export function json(body: unknown, status=200): Response {
  return new Response(JSON.stringify(body), {status,headers:{...cors(),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
}
export function preflight(req: Request): Response | null {
  const origin=req.headers.get('Origin');
  if(origin && origin !== env('APP_ORIGIN')) throw new HttpError(403,'Deze website is niet toegelaten.');
  if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors()});
  if(req.method!=='POST') throw new HttpError(405,'Alleen POST is toegestaan.');
  return null;
}
export async function bodyJSON(req:Request,max=8192):Promise<Record<string,unknown>> {
  if(Number(req.headers.get('content-length')||0)>max) throw new HttpError(413,'Verzoek te groot.');
  // Read with a bound even if Content-Length is absent or inaccurate.
  const reader=req.body?.getReader();if(!reader)throw new HttpError(400,'Verzoek ontbreekt.');
  let n=0;const parts:Uint8Array[]=[];
  while(true){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>max){await reader.cancel();throw new HttpError(413,'Verzoek te groot.');}parts.push(value);}
  const bytes=new Uint8Array(n);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  try{const data=JSON.parse(new TextDecoder().decode(bytes));if(!data||Array.isArray(data)||typeof data!=='object')throw new Error();return data;}
  catch{throw new HttpError(400,'Ongeldige JSON.');}
}
export async function adminRest(path: string, options: RequestInit = {}): Promise<any> {
  const key=env('SUPABASE_SERVICE_ROLE_KEY');
  const res=await fetch(env('SUPABASE_URL')+'/rest/v1/'+path,{...options,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(15000)});
  if(!res.ok)throw new HttpError(503,'Databasebewerking mislukt. Controleer de serverinstallatie.');
  const text=await res.text();return text?JSON.parse(text):null;
}
export async function authenticate(req:Request):Promise<{id:string;token:string}> {
  const header=req.headers.get('Authorization')||'';if(!/^Bearer [A-Za-z0-9._-]+$/.test(header))throw new HttpError(401,'Log eerst in.');
  const token=header.slice(7);
  const res=await fetch(env('SUPABASE_URL')+'/auth/v1/user',{headers:{apikey:env('SUPABASE_ANON_KEY'),Authorization:header},signal:AbortSignal.timeout(10000)});
  if(!res.ok)throw new HttpError(401,'Je sessie is verlopen. Log opnieuw in.');
  const user=await res.json();if(!user.id||user.is_anonymous||!/^[a-f0-9-]{36}$/.test(user.id))throw new HttpError(401,'Geen geldig persoonlijk account.');
  return {id:user.id,token};
}
export async function ownState(user:{id:string;token:string}):Promise<any> {
  // The authenticated user's JWT is used here: RLS still applies.
  const res=await fetch(env('SUPABASE_URL')+'/rest/v1/sport_states?user_id=eq.'+user.id+'&select=data',{headers:{apikey:env('SUPABASE_ANON_KEY'),Authorization:'Bearer '+user.token},signal:AbortSignal.timeout(15000)});
  if(!res.ok)throw new HttpError(403,'Gegevens niet toegankelijk.');
  const rows=await res.json();if(!rows[0]?.data?.profile)throw new HttpError(400,'Maak eerst je persoonlijke schema.');return rows[0].data;
}
export async function sha256(value:string):Promise<string> {
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export function failure(error:unknown):Response {
  if(error instanceof HttpError)return json({error:error.message},error.status);
  // Never return or log tokens, complete requests, profiles, keys, or model errors.
  return json({error:'Serverfout. Probeer later opnieuw of controleer de serverconfiguratie.'},500);
}


const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const addDays=(day:string,n:number)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const monday=(day:string)=>{const d=new Date(day+'T12:00:00Z');const i=(d.getUTCDay()+6)%7;return addDays(day,-i)};
const daysBetween=(a:string,b:string)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);
const roundKm=(n:number)=>Math.round(n*10)/10;

Deno.serve(async(req:Request)=>{
  try{
    const option=preflight(req);if(option)return option;
    const user=await authenticate(req),body=await bodyJSON(req);
    const p=body.profile||{}, slots=Array.isArray(body.slots)?body.slots:[], recent=Array.isArray(body.recent)?body.recent.slice(0,12):[];
    const goal=String(p.goal||''); if(!['fit','5k','10k','half','marathon'].includes(goal)) throw new HttpError(400,'Ongeldig sportdoel.');
    const base=Number(p.baseWeeklyKm),longest=Number(p.longestKm),pace=Number(p.pace),horizon=Number(p.horizon||12),raceDate=String(p.raceDate||'');
    if(!Number.isFinite(base)||base<1||base>150||!Number.isFinite(longest)||longest<1||longest>base||!Number.isFinite(pace)||pace<3||pace>15||!Number.isInteger(horizon)||horizon<1||horizon>52) throw new HttpError(400,'Controleer je startniveau.');
    if(raceDate&&!/^\d{4}-\d{2}-\d{2}$/.test(raceDate)) throw new HttpError(400,'Ongeldige doeldatum.');
    const runSlots=slots.filter((x:any)=>x?.sport==='run'); if(runSlots.length<1||runSlots.length>4) throw new HttpError(400,'Gebruik 1-4 hardloopmomenten per week.');
    const quota=await adminRest('rpc/sport_take_ai_quota',{method:'POST',body:JSON.stringify({p_user_id:user.id})});
    if(quota!==true) throw new HttpError(429,'AI-limiet bereikt of te snel opnieuw geprobeerd. Wacht ten minste 10 seconden.');
    const today=new Date().toISOString().slice(0,10), firstWeek=monday(today);
    const cleanRecent=recent.map((x:any)=>({sport:String(x.sport||'other').slice(0,20),date:String(x.date||'').slice(0,10),plannedKm:clamp(Number(x.plannedKm)||0,0,100),actualKm:clamp(Number(x.actualKm)||0,0,100),minutes:clamp(Number(x.minutes)||0,0,600),rpe:clamp(Number(x.rpe)||0,0,10)}));
    const schema={type:'object',additionalProperties:false,properties:{summary:{type:'string'},weeks:{type:'array',items:{type:'object',additionalProperties:false,properties:{index:{type:'integer'},weeklyKm:{type:'number'},longKm:{type:'number'},phase:{type:'string',enum:['basis','opbouw','piek','taper','herstel']},note:{type:'string'}},required:['index','weeklyKm','longKm','phase','note']}}},required:['summary','weeks']};
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+env('OPENAI_API_KEY'),'Content-Type':'application/json'},signal:AbortSignal.timeout(30000),body:JSON.stringify({model:env('OPENAI_MODEL'),store:false,max_output_tokens:3500,
      instructions:`Je bent de schema-strategiemodule van Sport-app. Maak uitsluitend een realistische weekstrategie, geen medisch advies. Gebruik exact weekindex 0 t/m ${horizon-1}. Het doel is ${goal}${raceDate?' op '+raceDate:''}. De horizon is de volledige resterende tijd tot de doeldatum: gebruik alle weken voor een doorlopende opbouw. Bouw geleidelijk vanaf de echte basis, plan een duidelijke piek voor de taper en daarna taper richting de doeldag. Forceer nooit een onhaalbare inhaalslag omdat de datum dichtbij is. Bij een lage basis mag je expliciet een lagere piek adviseren. Een marathon hoeft niet 42,2 km als trainingsduurloop te bevatten; een piekduurloop rond 28-32 km kan passend zijn bij voldoende basis en tijd. Gemiste kilometers worden nooit als schuld doorgeschoven. Andere sporten zijn aanvullende belasting maar worden niet naar hardloopkilometers omgerekend. Geef korte Nederlandse notities per week.`,
      input:[{role:'user',content:JSON.stringify({today,profile:{goal,raceDate,baseWeeklyKm:base,longestKm:longest,pace,horizon},runSlots:runSlots.map((x:any)=>({day:Number(x.day),minutes:clamp(Number(x.minutes)||0,15,300),kind:x.kind==='long'?'long':'easy'})),recent:cleanRecent})}],text:{format:{type:'json_schema',name:'sportkompas_training_strategy',strict:true,schema}}})});
    if(!response.ok) throw new HttpError(502,'De AI-provider kon geen schema maken. Controleer API-sleutel, model en budget.');
    const result=await response.json();
    const text=(result.output||[]).flatMap((o:any)=>o.content||[]).filter((c:any)=>c.type==='output_text').map((c:any)=>c.text).join('').trim();
    if(!text) throw new HttpError(502,'Geen AI-strategie ontvangen.');
    let raw:any; try{raw=JSON.parse(text)}catch{throw new HttpError(502,'AI-strategie kon niet worden gelezen.');}
    if(!Array.isArray(raw.weeks)) throw new HttpError(502,'AI-strategie bevat geen weken.');
    const byIndex=new Map<number,any>(); for(const w of raw.weeks){const i=Number(w.index);if(Number.isInteger(i)&&i>=0&&i<horizon)byIndex.set(i,w);}
    if(byIndex.size!==horizon) throw new HttpError(502,'AI-strategie is niet compleet; probeer opnieuw.');
    const weeks=[]; let previousWeekly=base, previousLong=longest;
    for(let i=0;i<horizon;i++){
      const w=byIndex.get(i), weekStart=addDays(firstWeek,i*7);
      const feasibleWeekly=Math.min(90,base*Math.pow(1.10,i));
      let weekly=clamp(Number(w.weeklyKm)||previousWeekly,Math.max(1,base*.55),feasibleWeekly);
      let longKm=clamp(Number(w.longKm)||previousLong,1,Math.min(34,longest*Math.pow(1.15,i),weekly*.70));
      let phase=['basis','opbouw','piek','taper','herstel'].includes(w.phase)?w.phase:'opbouw';
      if(i>0&&i%4===3&&(!raceDate||daysBetween(weekStart,raceDate)>21)){weekly=Math.min(weekly,previousWeekly*.9);longKm=Math.min(longKm,previousLong*.9);phase='herstel';}
      if(raceDate){const left=Math.ceil(daysBetween(weekStart,raceDate)/7);if(left===2){weekly=Math.min(weekly,previousWeekly*.8);longKm=Math.min(longKm,22);phase='taper';}if(left===1){weekly=Math.min(weekly,previousWeekly*.65);longKm=Math.min(longKm,12);phase='taper';}if(left<=0){weekly=Math.min(weekly,base*.6);longKm=Math.min(longKm,8);phase='taper';}}
      weekly=roundKm(weekly);longKm=roundKm(Math.min(longKm,weekly*.70));
      weeks.push({index:i,weekStart,weeklyKm:weekly,longKm,phase,note:String(w.note||'').slice(0,180)});previousWeekly=weekly;previousLong=longKm;
    }
    return json({strategy:{source:'openai',createdAt:new Date().toISOString(),summary:String(raw.summary||'').slice(0,500),weeks}});
  }catch(e){return failure(e);}
});
