document.addEventListener('DOMContentLoaded',()=>{
 const isTracking=key=>/^utm_[a-z0-9_]+$/i.test(key)||['gclid','gbraid','wbraid','dclid','fbclid','msclkid','src','sck','xcod'].includes(key);
 const tracking=new URLSearchParams();
 try{for(const [key,value] of new URLSearchParams(sessionStorage.getItem('blog-attribution')||''))if(isTracking(key))tracking.set(key,value);}catch{}
 for(const [key,value] of new URLSearchParams(location.search))if(isTracking(key)&&value.length<=2048)tracking.set(key,value);
 try{sessionStorage.setItem('blog-attribution',tracking.toString());}catch{}
 const trackedURL=value=>{const url=new URL(value,location.href);for(const [key,value] of tracking)url.searchParams.set(key,value);return url;};
 const decorateLink=link=>{try{const url=new URL(link.href,location.href);if(url.origin===location.origin&&!url.pathname.startsWith('/admin'))link.href=trackedURL(url.href).href;}catch{}};
 document.querySelectorAll('a[href]').forEach(decorateLink);
 document.addEventListener('click',event=>{const link=event.target.closest?.('a[href]');if(link)decorateLink(link);},true);
 if(!location.pathname.startsWith('/admin')){
  let visitorId=crypto.randomUUID();
  try{const saved=JSON.parse(localStorage.getItem('blog-presence')||'null');if(saved&&saved.until>Date.now())visitorId=saved.id;else localStorage.setItem('blog-presence',JSON.stringify({id:visitorId,until:Date.now()+86400000}));}catch{}
  const heartbeat=()=>{if(document.visibilityState!=='visible')return;fetch('/api/presence',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:visitorId,path:location.pathname}),credentials:'omit',cache:'no-store'}).catch(()=>{});};
  heartbeat();setInterval(heartbeat,30000);document.addEventListener('visibilitychange',heartbeat);
 }
 const menu=document.querySelector('.menu');
 menu?.addEventListener('click',()=>{const open=document.querySelector('header').classList.toggle('open');menu.setAttribute('aria-expanded',String(open));});
 document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('.filter').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-pressed','false');});
  button.classList.add('active');button.setAttribute('aria-pressed','true');let count=0;
  document.querySelectorAll('.profile-card').forEach(card=>{const visible=button.dataset.category==='Todos'||card.dataset.category===button.dataset.category;card.hidden=!visible;if(visible)count++;});
  document.querySelector('.result-count').textContent=count+(count===1?' caminho para explorar':' caminhos para explorar');
 }));
 const dialog=document.querySelector('#official-dialog');let trigger=null;
 document.querySelectorAll('.official').forEach(button=>button.addEventListener('click',async()=>{
  let value='';
  try { const response=await fetch('/api/config',{cache:'no-store'}); if(response.ok)value=(await response.json()).officialUrl||''; } catch {}
  if(value){try{const url=new URL(value);if(url.protocol==='https:'){window.location.assign(trackedURL('/go').href);return;}}catch{}}
  trigger=button;dialog.showModal();document.body.classList.add('dialog-open');
 }));
 const close=()=>{dialog.close();document.body.classList.remove('dialog-open');trigger?.focus();};
 dialog?.querySelectorAll('.close,.close-dialog').forEach(b=>b.addEventListener('click',close));
 dialog?.addEventListener('close',()=>document.body.classList.remove('dialog-open'));
 dialog?.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)close();}});
});
