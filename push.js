/* MijnLoop Web Push: custom MijnLoop-sessie, geen Supabase Auth. */
(function(global){
  'use strict';
  const cfg=()=>global.SPORT_CONFIG||{};
  const endpoint=()=>`${cfg().supabaseUrl}/functions/v1/mijnloop-push`;
  const auth=()=>global.MijnLoopLocalAuth;
  const bytes=s=>{const x=(s+'='.repeat((4-s.length%4)%4)).replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(x),c=>c.charCodeAt(0));};
  const isiOS=()=>/iPhone|iPad|iPod/i.test(navigator.userAgent);
  const standalone=()=>!!navigator.standalone||matchMedia('(display-mode: standalone)').matches;
  async function api(action,body={}){
    const token=auth()?.sessionToken?.();if(!token)throw new Error('Log opnieuw in om pushmeldingen te beheren.');
    const res=await fetch(endpoint(),{method:'POST',headers:{'Content-Type':'application/json','apikey':cfg().supabasePublishableKey,'x-mijnloop-session':token},body:JSON.stringify({action,...body})});
    let data={};try{data=await res.json();}catch{}
    if(!res.ok)throw new Error(data.error||('Pushserver gaf fout '+res.status));
    return data;
  }
  async function status(){
    if(!('PushManager' in global)||!('serviceWorker' in navigator)||!('Notification' in global))return {supported:false,subscribed:false,message:'Dit apparaat ondersteunt geen webpush.'};
    if(isiOS()&&!standalone())return {supported:false,subscribed:false,message:'Op iPhone: zet MijnLoop eerst op het beginscherm en open de app via dat icoon.'};
    const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();
    return {supported:true,subscribed:!!sub,permission:Notification.permission,message:sub?'Echte push is ingeschakeld op dit apparaat.':Notification.permission==='denied'?'Meldingen zijn in iOS/browserinstellingen geblokkeerd.':'Echte push is nog niet ingeschakeld op dit apparaat.'};
  }
  async function subscribe(){
    if(!('PushManager' in global)||!('serviceWorker' in navigator)||!('Notification' in global))throw new Error('Dit apparaat ondersteunt geen webpush.');
    if(isiOS()&&!standalone())throw new Error('Op iPhone: kies Deel → Zet op beginscherm, open MijnLoop via het nieuwe app-icoon en schakel daarna push in.');
    const {publicKey}=await api('config');const permission=await Notification.requestPermission();if(permission!=='granted')throw new Error('Meldingstoestemming is niet verleend.');
    const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes(publicKey)});
    await api('subscribe',{subscription:sub.toJSON()});return true;
  }
  async function unsubscribe(){if(!('serviceWorker' in navigator))return true;const reg=await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();if(!sub)return true;try{await api('unsubscribe',{subscription:{endpoint:sub.endpoint}});}finally{await sub.unsubscribe();}return true;}
  async function test(){return api('test');}
  global.MijnLoopPush={status,subscribe,unsubscribe,test};
})(globalThis);
