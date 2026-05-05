/* Kerasys Shop service worker — minimal install + offline shell */
const CACHE='kerasys-v2';
const ASSETS=[
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{}));
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET')return;
  const url=new URL(r.url);
  // Never cache Firebase / API calls
  if(url.hostname.includes('firebaseio.com')||url.hostname.includes('firestore')||url.hostname.includes('googleapis.com')||url.hostname.includes('telegram.org')) return;
  // For app shell — network first, fallback to cache (offline support)
  if(url.origin===self.location.origin){
    e.respondWith(
      fetch(r).then(res=>{
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(r,copy)).catch(()=>{});
        return res;
      }).catch(()=>caches.match(r).then(c=>c||caches.match('./index.html')))
    );
  }
});
