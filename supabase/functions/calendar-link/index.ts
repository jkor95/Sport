import {preflight,authenticate,bodyJSON,ownState,adminRest,sha256,env,json,HttpError,failure} from '../_shared/http.ts';
Deno.serve(async (req:Request)=>{
  try{
    const option=preflight(req);if(option)return option;
    const user=await authenticate(req),body=await bodyJSON(req);
    if(body.action==='revoke'){
      await adminRest('sport_calendar_tokens?user_id=eq.'+user.id,{method:'DELETE'});
      return json({revoked:true});
    }
    if(body.action!=='create')throw new HttpError(400,'Onbekende actie.');
    await ownState(user);
    // 256 random bits. Only the one-way hash is persisted, never the URL/token.
    const bytes=crypto.getRandomValues(new Uint8Array(32));
    const token=[...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');
    const token_hash=await sha256(token);
    await adminRest('sport_calendar_tokens?on_conflict=user_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({user_id:user.id,token_hash,minimal:body.minimal!==false,created_at:new Date().toISOString()})});
    return json({url:env('SUPABASE_URL')+'/functions/v1/calendar-feed?token='+token});
  }catch(e){return failure(e);}
});
