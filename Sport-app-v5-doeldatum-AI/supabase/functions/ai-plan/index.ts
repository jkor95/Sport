import {preflight,authenticate,bodyJSON,adminRest,env,json,HttpError,failure} from '../_shared/http.ts';

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
      instructions:`Je bent de schema-strategiemodule van Sport-app. Maak uitsluitend een realistische weekstrategie, geen medisch advies. Gebruik exact weekindex 0 t/m ${horizon-1}. Het doel is ${goal}${raceDate?' op '+raceDate:''}. De horizon is de volledige resterende tijd tot de doeldatum: gebruik dus alle weken voor een doorlopende opbouw. Bouw geleidelijk vanaf de echte basis, met een lichtere week waar passend, een duidelijke piek voor de taper en daarna taper richting de doeldag. Forceer nooit een onhaalbare inhaalslag omdat de datum dichtbij is. Bij een lage basis mag je expliciet een lagere piek adviseren. Een marathon hoeft niet 42,2 km als trainingsduurloop te bevatten; een piekduurloop rond 28-32 km kan passend zijn bij voldoende basis en tijd. Gemiste kilometers worden nooit als schuld doorgeschoven. Andere sporten zijn aanvullende belasting maar worden niet naar hardloopkilometers omgerekend. Geef korte Nederlandse notities per week.`,
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
