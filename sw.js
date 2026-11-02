const V='tr-v9';
const SHELL=['./','index.html','style.css','app.js','manifest.json','data.enc.json','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET')return;
  const u=new URL(r.url); if(u.origin!==location.origin)return;
  // network first (so edits deploy), fall back to cache quickly when offline / weak signal
  e.respondWith((async()=>{
    const c=await caches.open(V);
    try{
      const res=await Promise.race([fetch(r),new Promise((_,j)=>setTimeout(()=>j(new Error('slow')),3000))]);
      if(res&&res.ok)c.put(r,res.clone());
      return res;
    }catch(_){
      const hit=await c.match(r,{ignoreSearch:true});
      if(hit)return hit;
      if(r.mode==='navigate'){const i=await c.match('index.html');if(i)return i;}
      return Response.error();
    }
  })());
});
