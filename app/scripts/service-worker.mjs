export function renderServiceWorker(cacheName, files, assets) {
  return `const CACHE=${JSON.stringify(cacheName)};
const RUNTIME='upsc-assets-v2';
const FILES=${JSON.stringify(files)};
const ASSET_FILES=${JSON.stringify(assets)};
const SCOPE=new URL(self.registration.scope);
const ASSETS=new Set(ASSET_FILES.map(file=>new URL(file,SCOPE).href));
const HASHED_PATH=new URL('./assets/',SCOPE).pathname;
const safeMatch=async(name,request)=>{try{return await(await caches.open(name)).match(request);}catch{return undefined;}};
const legacyMatch=async(request)=>{for(const name of await caches.keys())if(name.startsWith('upsc-static-')&&name!==CACHE){const cached=await safeMatch(name,request);if(cached)return cached;}};
const save=async(name,request,response)=>{try{await(await caches.open(name)).put(request,response);}catch{/* An optional cache write must not block a successful request. */}};
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(file=>new Request(new URL(file,SCOPE),{cache:'no-cache'})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    const runtime=await caches.open(RUNTIME);
    const core=await caches.open(CACHE);
    for(const name of names.filter(name=>name.startsWith('upsc-static-')&&name!==CACHE)){
      const previous=await caches.open(name);
      for(const request of await previous.keys()){
        const url=new URL(request.url);
        if(ASSETS.has(url.href)&&url.pathname.startsWith(HASHED_PATH)&&!await core.match(request)&&!await runtime.match(request)){
          try{const response=await previous.match(request);if(response)await runtime.put(request,response);}catch{continue;}
        }
        await previous.delete(request);
      }
      if(!(await previous.keys()).length)await caches.delete(name);
    }
    await Promise.all((await runtime.keys()).filter(request=>!ASSETS.has(request.url)).map(request=>runtime.delete(request)));
    if(self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(()=>{});
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==SCOPE.origin||!url.pathname.startsWith(SCOPE.pathname)||url.searchParams.has('token_hash')||url.searchParams.has('code')||url.pathname.endsWith('/auth-config.json')) return;
  if(!url.search&&ASSETS.has(url.href)){
    event.respondWith((async()=>{
      const immutable=url.pathname.startsWith(HASHED_PATH);
      const cached=await safeMatch(CACHE,request)||(immutable?await safeMatch(RUNTIME,request)||await legacyMatch(request):undefined);
      if(cached)return cached;
      try{
        const response=await fetch(request);
        if(response.ok)event.waitUntil(save(immutable?RUNTIME:CACHE,request,response.clone()));
        return response;
      }catch{return new Response('Open this study content once while online to make it available offline.',{status:503,headers:{'Content-Type':'text/plain'}});}
    })());
    return;
  }
  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const response=await Promise.resolve(event.preloadResponse).catch(()=>undefined)||await fetch(request);
        if(response.ok)event.waitUntil(save(CACHE,request,response.clone()));
        if(response.status<500)return response;
      }catch{}
      return await safeMatch(CACHE,request)||await safeMatch(CACHE,new URL('./index.html',SCOPE).href)||new Response('Offline',{status:503});
    })());
  }
});
`;
}
