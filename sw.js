/* Online Shop service worker — cache-first app shell, SWR for products */
const CACHE='kerasys-v5';
const DATA_CACHE='kerasys-data-v2';
const ASSETS=[
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    try{
      const c=await caches.open(CACHE);
      await c.addAll(ASSETS).catch(()=>{});
      // Pre-warm products.json on install so first cold render is instant
      try{
        const r=await fetch('https://kerasys-dokon-default-rtdb.firebaseio.com/products.json');
        if(r.ok){const dc=await caches.open(DATA_CACHE);await dc.put(r.url,r.clone());}
      }catch(_){}
    }catch(_){}
    self.skipWaiting();
  })());
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE&&k!==DATA_CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET')return;
  const url=new URL(r.url);

  // SWR for products.json: serve cached INSTANTLY, refresh in background
  if(url.hostname.endsWith('firebaseio.com')&&url.pathname==='/products.json'){
    e.respondWith((async()=>{
      const c=await caches.open(DATA_CACHE);
      const cached=await c.match(r);
      const fresh=fetch(r).then(res=>{if(res&&res.ok)c.put(r,res.clone());return res;}).catch(()=>null);
      return cached || (await fresh) || new Response('null',{headers:{'Content-Type':'application/json'}});
    })());
    return;
  }

  // Skip caching for firebase realtime/firestore/etc
  if(url.hostname.includes('firebaseio.com')||url.hostname.includes('firestore')||url.hostname.includes('googleapis.com')||url.hostname.includes('telegram.org')||url.hostname.includes('pollinations')) return;

  // Cache-first for our own app shell (HTML/CSS/JS/icons) with background revalidate
  if(url.origin===self.location.origin){
    e.respondWith((async()=>{
      const c=await caches.open(CACHE);
      const cached=await c.match(r);
      const fresh=fetch(r).then(res=>{
        if(res&&res.ok){c.put(r,res.clone()).catch(()=>{});}
        return res;
      }).catch(()=>null);
      // Serve cache if available, otherwise wait for network. Background refresh always runs.
      if(cached){fresh;return cached;}
      const net=await fresh;
      return net||caches.match('./index.html')||new Response('Offline',{status:503});
    })());
    return;
  }

  // 3rd-party CDNs (fonts, twemoji, tesseract) — cache aggressively for repeat visits
  if(url.hostname.includes('gstatic.com')||url.hostname.includes('jsdelivr.net')||url.hostname.includes('unpkg.com')||url.hostname.includes('fonts.googleapis.com')){
    e.respondWith((async()=>{
      const c=await caches.open(CACHE);
      const cached=await c.match(r);
      if(cached)return cached;
      try{
        const res=await fetch(r);
        if(res&&res.ok)c.put(r,res.clone()).catch(()=>{});
        return res;
      }catch(_){return cached||new Response('',{status:504});}
    })());
  }
});
