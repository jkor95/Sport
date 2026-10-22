/* Only public static app files are cached. Never cache API responses or user data. */
const CACHE='mijnloop-shell-v39';
const FILES=['./','./index.html','./styles.css','./config.js','./core/dates.js','./core/planner.js','./core/calendar.js','./demo.js','./local-auth.js','./db.js','./push.js','./app.js','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('sport-app-shell-')||k.startsWith('mijnloop-shell-'))&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url),base=new URL(self.registration.scope);
  if(event.request.method!=='GET'||url.origin!==base.origin||url.search||!url.pathname.startsWith(base.pathname))return;
  const rel='./'+url.pathname.slice(base.pathname.length);
  if(!FILES.includes(rel))return;
  // Network first keeps manual GitHub Pages updates visible after a reload.
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request).then(r=>r||new Response('Offline',{status:503}))));
});

self.addEventListener('notificationclick',event=>{event.notification.close();const target=new URL(event.notification.data?.url||'./',self.registration.scope).href;event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if(c.url.startsWith(self.registration.scope)){c.focus();return c.navigate(target);}}return clients.openWindow(target);}));});


self.addEventListener('push',event=>{
  let data={};try{data=event.data?.json()||{};}catch{}
  event.waitUntil(self.registration.showNotification(data.title||'MijnLoop',{
    body:data.body||'Er is een nieuwe melding.',
    icon:'./assets/icon-192.png',
    badge:'./assets/icon-192.png',
    tag:data.tag||('mijnloop-push-'+Date.now()),
    data:data.data||{url:'./'},
    renotify:false
  }));
});
