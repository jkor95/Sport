import {adminRest,sha256} from '../_shared/http.ts';
import '../_shared/dates.js';
import '../_shared/calendar.js';
const SK=(globalThis as unknown as {SK:any}).SK;
const headers={'Content-Type':'text/calendar; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','Content-Disposition':'inline; filename="sportkompas.ics"'};
Deno.serve(async (req:Request)=>{
  const notFound=()=>new Response('Agenda niet beschikbaar.',{status:404,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  try{
    if(req.method!=='GET'&&req.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD'}});
    const token=new URL(req.url).searchParams.get('token')||'';
    if(!/^[a-f0-9]{64}$/.test(token))return notFound();
    const hash=await sha256(token);
    const links=await adminRest('sport_calendar_tokens?token_hash=eq.'+hash+'&select=user_id,minimal');
    const link=links[0];if(!link)return notFound();
    const rows=await adminRest('sport_states?user_id=eq.'+link.user_id+'&select=data');
    if(!rows[0]?.data)return notFound();
    const ics=SK.calendarText(rows[0].data,{owner:link.user_id,minimal:link.minimal});
    return new Response(req.method==='HEAD'?null:ics,{status:200,headers});
  }catch{
    return new Response('Agenda tijdelijk niet beschikbaar.',{status:503,headers:{'Cache-Control':'no-store','Retry-After':'300'}});
  }
});
