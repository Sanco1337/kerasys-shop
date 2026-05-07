/* Kerasys Shop service worker — install, offline shell, products SWR cache */
const CACHE='kerasys-v3';
const DATA_CACHE='kerasys-data-v1';
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
    caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k!==DATA_CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET')return;
  const url=new URL(r.url);
  // Stale-while-revalidate for products.json — serve cached instantly, refresh in background
  if(url.hostname.endsWith('firebaseio.com')&&url.pathname==='/products.json'){
    e.respondWith(
      caches.open(DATA_CACHE).then(c=>{
        const fresh=fetch(r).then(res=>{ if(res&&res.ok) c.put(r,res.clone()); return res; }).catch(()=>null);
        return c.match(r).then(cached=>cached||fresh);
      })
    );
    return;
  }
  // Never cache other Firebase / API calls
  if(url.hostname.includes('firebaseio.com')||url.hostname.includes('firestore')||url.hostname.includes('googleapis.com')||url.hostname.includes('telegram.org')) return;
  // App shell — network first, fallback to cache (offline support)
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
