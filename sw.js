/* Only public static app files are cached. Never cache API responses or user data. */
const CACHE='sport-app-shell-v7';
const FILES=['./','./index.html','./styles.css','./config.js','./core/dates.js','./core/planner.js','./core/calendar.js','./demo.js','./db.js','./app.js','./manifest.webmanifest','./assets/icon.svg','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('sport-app-shell-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url),base=new URL(self.registration.scope);
  if(event.request.method!=='GET'||url.origin!==base.origin||url.search||!url.pathname.startsWith(base.pathname))return;
  const rel='./'+url.pathname.slice(base.pathname.length);
  if(!FILES.includes(rel))return;
  // Network first keeps manual GitHub Pages updates visible after a reload.
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request).then(r=>r||new Response('Offline',{status:503}))));
});
