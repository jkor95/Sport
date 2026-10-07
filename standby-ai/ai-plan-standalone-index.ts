export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function env(name:string){const v=Deno.env.get(name);if(!v)throw new HttpError(503,'Serverconfiguratie ontbreekt. Controleer de installatiehandleiding.');return v;}
function cors(){return {'Access-Control-Allow-Origin':Deno.env.get('APP_ORIGIN')||'https://invalid.invalid','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};}
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors(),'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});}
function preflight(req:Request){const origin=req.headers.get('Origin');if(origin&&origin!==env('APP_ORIGIN'))throw new HttpError(403,'Deze website is niet toegelaten.');if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors()});if(req.method!=='POST')throw new HttpError(405,'Alleen POST is toegestaan.');return null;}
async function bodyJSON(req:Request,max=8192){if(Number(req.headers.get('content-length')||0)>max)throw new HttpError(413,'Verzoek te groot.');const reader=req.body?.getReader();if(!reader)throw new HttpError(400,'Verzoek ontbreekt.');let n=0;const parts:Uint8Array[]=[];while(true){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>max){await reader.cancel();throw new HttpError(413,'Verzoek te groot.');}parts.push(value);}const bytes=new Uint8Array(n);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}try{const data=JSON.parse(new TextDecoder().decode(bytes));if(!data||Array.isArray(data)||typeof data!=='object')throw new Error();return data as Record<string,unknown>;}catch{throw new HttpError(400,'Ongeldige JSON.');}}
async function adminRest(path:string,options:RequestInit={}){const key=env('SUPABASE_SERVICE_ROLE_KEY');const res=await fetch(env('SUPABASE_URL')+'/rest/v1/'+path,{...options,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(15000)});if(!res.ok)throw new HttpError(503,'Databasebewerking mislukt. Controleer de serverinstallatie.');const text=await res.text();return text?JSON.parse(text):null;}
async function authenticate(req:Request){const header=req.headers.get('Authorization')||'';if(!/^Bearer [A-Za-z0-9._-]+$/.test(header))throw new HttpError(401,'Log eerst in.');const token=header.slice(7);const res=await fetch(env('SUPABASE_URL')+'/auth/v1/user',{headers:{apikey:env('SUPABASE_ANON_KEY'),Authorization:header},signal:AbortSignal.timeout(10000)});if(!res.ok)throw new HttpError(401,'Je sessie is verlopen. Log opnieuw in.');const user=await res.json();if(!user.id||user.is_anonymous||!/^[a-f0-9-]{36}$/.test(user.id))throw new HttpError(401,'Geen geldig persoonlijk account.');return {id:user.id,token};}
async function ownState(user:{id:string;token:string}){const res=await fetch(env('SUPABASE_URL')+'/rest/v1/sport_states?user_id=eq.'+user.id+'&select=data',{headers:{apikey:env('SUPABASE_ANON_KEY'),Authorization:'Bearer '+user.token},signal:AbortSignal.timeout(15000)});if(!res.ok)throw new HttpError(403,'Gegevens niet toegankelijk.');const rows=await res.json();if(!rows[0]?.data?.profile)throw new HttpError(400,'Maak eerst je persoonlijke schema.');return rows[0].data;}
function failure(error:unknown){if(error instanceof HttpError)return json({error:error.message},error.status);return json({error:'Serverfout. Probeer later opnieuw of controleer de serverconfiguratie.'},500);}
function clamp(n:number,min:number,max:number){return Math.max(min,Math.min(max,n));}
function cleanNumber(n:unknown,max=1000){const x=Number(n);return Number.isFinite(x)?clamp(x,0,max):0;}
function outputText(result:any){return (result.output||[]).flatMap((o:any)=>o.content||[]).filter((c:any)=>c.type==='output_text').map((c:any)=>c.text).join('\n').trim();}
async function takeQuota(userId:string){const quota=await adminRest('rpc/sport_take_ai_quota',{method:'POST',body:JSON.stringify({p_user_id:userId})});if(quota!==true)throw new HttpError(429,'AI-limiet bereikt of te snel opnieuw geprobeerd. Maximaal 10 AI-aanroepen per UTC-dag en minimaal 10 seconden ertussen.');}

Deno.serve(async(req:Request)=>{
  try{
    const option=preflight(req);if(option)return option;
    const user=await authenticate(req),body=await bodyJSON(req);
    if(body.consent!==true)throw new HttpError(400,'Toestemming voor deze AI-aanroep ontbreekt.');
    const mode=String(body.mode||'');
    if(!['coach','adapt'].includes(mode))throw new HttpError(400,'Onbekende AI-actie.');
    const state=await ownState(user);
    const today=new Date().toISOString().slice(0,10);

    if(mode==='coach'){
      const question=String(body.question||'').trim();if(!question||question.length>1200)throw new HttpError(400,'Gebruik een vraag van 1-1200 tekens.');
      await takeQuota(user.id);
      const summary={goal:String(state.profile.goal||'fit'),raceDate:String(state.profile.raceDate||''),baseWeeklyKm:cleanNumber(state.profile.baseWeeklyKm),longestKm:cleanNumber(state.profile.longestKm),paused:!!state.hold,
        recent:(state.workouts||[]).filter((w:any)=>w.actual&&w.date<=today).sort((a:any,b:any)=>b.date.localeCompare(a.date)).slice(0,10).map((w:any)=>({sport:w.sport,date:w.date,plannedKm:cleanNumber(w.actual.plannedKm),actualKm:cleanNumber(w.actual.km),minutes:cleanNumber(w.actual.minutes,1440),effort:cleanNumber(w.actual.rpe,10),reason:String(w.actual.reason||'')})),
        upcoming:(state.workouts||[]).filter((w:any)=>w.status==='planned'&&w.date>=today).sort((a:any,b:any)=>a.date.localeCompare(b.date)).slice(0,6).map((w:any)=>({sport:w.sport,date:w.date,km:cleanNumber(w.km),minutes:cleanNumber(w.minutes,1440),kind:String(w.kind||'')}))};
      const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+env('OPENAI_API_KEY'),'Content-Type':'application/json'},signal:AbortSignal.timeout(25000),body:JSON.stringify({model:env('OPENAI_MODEL'),store:false,max_output_tokens:900,
        instructions:'Je geeft in het Nederlands uitleg bij MijnLoop. Het basisschema is een lokaal offline schema en jij wijzigt het niet vanuit een Coach-vraag. Geef maximaal 250 woorden. Gemiste kilometers worden niet ingehaald. Vaste sportmomenten blijven vast. Onderscheid tijdgebrek van fysieke overbelasting. Geef geen diagnose of medische trainingsvrijgave. Bij pijn of ziekte: adviseer voorzichtig en verwijs bij aanhoudende of ernstige klachten naar een passende zorgprofessional. Garandeer geen wedstrijdhaalbaarheid.',
        input:[{role:'user',content:JSON.stringify({question,summary})}]})});
      if(!response.ok)throw new HttpError(502,'De AI-provider kon niet antwoorden. Controleer model, API-sleutel en API-budget. Het gewone offline schema blijft werken.');
      const answer=outputText(await response.json());if(!answer)throw new HttpError(502,'Geen bruikbaar AI-antwoord ontvangen.');return json({answer:answer.slice(0,12000)});
    }

    const workoutId=String(body.workoutId||'');if(!/^[A-Za-z0-9_-]{1,80}$/.test(workoutId))throw new HttpError(400,'Training ontbreekt.');
    const trigger=(state.workouts||[]).find((w:any)=>w.id===workoutId&&w.actual);if(!trigger)throw new HttpError(400,'Geregistreerde training niet gevonden.');
    if(state.hold||['pain','illness'].includes(String(trigger.actual?.reason||'')))return json({adjustment:null,note:'De vaste veiligheidsregel heeft de planning al gepauzeerd. AI mag dit niet overrulen.'});
    const next=(state.workouts||[]).filter((w:any)=>w.status==='planned'&&w.sport==='run'&&w.date>=today).sort((a:any,b:any)=>(a.date+a.time).localeCompare(b.date+b.time))[0];
    if(!next)return json({adjustment:null,note:'Geen toekomstige hardlooptraining om aan te passen.'});
    await takeQuota(user.id);
    const recent=(state.workouts||[]).filter((w:any)=>w.actual&&w.sport==='run'&&w.date<=today).sort((a:any,b:any)=>b.date.localeCompare(a.date)).slice(0,6).map((w:any)=>({date:w.date,kind:w.kind,plannedKm:cleanNumber(w.actual.plannedKm),actualKm:cleanNumber(w.actual.km),rpe:cleanNumber(w.actual.rpe,10),reason:String(w.actual.reason||'')}));
    const schema={type:'object',additionalProperties:false,properties:{factor:{type:'number',minimum:0.7,maximum:1},note:{type:'string'}},required:['factor','note']};
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+env('OPENAI_API_KEY'),'Content-Type':'application/json'},signal:AbortSignal.timeout(25000),body:JSON.stringify({model:env('OPENAI_MODEL'),store:false,max_output_tokens:350,
      instructions:'Je beoordeelt alleen of de eerstvolgende hardlooptraining tijdelijk gelijk kan blijven of korter moet. Het offline basisschema is leidend. Geef factor 0.70 t/m 1.00; nooit hoger dan 1.00, nooit inhaalkilometers. Tijdgebrek of weer is niet automatisch een reden om trainingsbelasting te verlagen. Herhaalde vermoeidheid, hoge RPE of duidelijk minder lopen kan wel tot een tijdelijke verlaging leiden. Geef geen diagnose. De app heeft pijn/ziekte al apart gepauzeerd.',
      input:[{role:'user',content:JSON.stringify({trigger:{date:trigger.date,kind:trigger.kind,plannedKm:cleanNumber(trigger.actual?.plannedKm),actualKm:cleanNumber(trigger.actual?.km),rpe:cleanNumber(trigger.actual?.rpe,10),reason:String(trigger.actual?.reason||'')},next:{id:next.id,date:next.date,kind:next.kind,km:cleanNumber(next.km)},recent})}],text:{format:{type:'json_schema',name:'sport_app_adaptation',strict:true,schema}}})});
    if(!response.ok)throw new HttpError(502,'De AI-provider kon de training niet extra beoordelen. Het offline schema blijft ongewijzigd.');
    const text=outputText(await response.json());if(!text)throw new HttpError(502,'Geen bruikbare AI-bijsturing ontvangen.');let raw:any;try{raw=JSON.parse(text)}catch{throw new HttpError(502,'AI-bijsturing kon niet worden gelezen.');}
    const factor=clamp(Number(raw.factor)||1,.7,1),targetKm=Math.round(Math.min(cleanNumber(next.km),cleanNumber(next.km)*factor,32)*10)/10;
    return json({adjustment:{workoutId:next.id,targetKm,note:String(raw.note||'AI-beoordeling na je laatste registratie.').slice(0,180)}});
  }catch(e){return failure(e);}
});
