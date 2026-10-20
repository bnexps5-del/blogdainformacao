import {randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
const lifetime=8*60*60*1000;
export function validLink(value){
 if(typeof value!=='string'||value.length>2048)throw Error('Informe um endereço HTTPS válido.');
 let u;try{u=new URL(value.trim());}catch{throw Error('Informe um endereço HTTPS completo.');}
 if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.')||u.hostname==='localhost'||u.hostname.endsWith('.local')||/^\d+(\.\d+){3}$/.test(u.hostname)||u.hostname.includes(':'))throw Error('Use um endereço público com HTTPS.');
 return u.href;
}
export function verifier(password,salt){return scryptSync(password,salt,64).toString('hex');}
const digest=v=>createHash('sha256').update(v).digest('hex');
const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
export function makeHandler(store,env=process.env){
 const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff',...headers}});
 const cookie=(token,age)=>`__Host-blog_admin=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
 async function session(req){const token=req.headers.get('cookie')?.match(/(?:^|;\s*)__Host-blog_admin=([a-f0-9]{64})(?:;|$)/)?.[1];if(!token)return null;const key='session/'+digest(token),value=await store.get(key,{type:'json'});if(!value||value.expiresAt<Date.now()){if(value)await store.delete(key);return null;}return {key,...value};}
 async function config(){return await store.get('config',{type:'json'})||{officialUrl:'',updatedAt:null};}
 return async function(req,context={}){try{
  const u=new URL(req.url),path=u.pathname.replace(/\/$/,''),method=req.method;
  if(method!=='GET'&&method!=='HEAD'){
   if(req.headers.get('origin')!==u.origin)return json({error:'Origem não permitida.'},403);
   if(!(req.headers.get('content-type')||'').startsWith('application/json'))return json({error:'Formato inválido.'},415);
   if(Number(req.headers.get('content-length')||0)>8192)return json({error:'Pedido muito grande.'},413);
  }
  if(path==='/api/config'&&method==='GET')return json(await config());
  if(path==='/api/presence'&&method==='POST'){
   const raw=await req.text();if(raw.length>1024)return json({error:'Pedido muito grande.'},413);
   let data;try{data=JSON.parse(raw);}catch{return json({error:'Pedido inválido.'},400);}
   if(!/^[a-f0-9-]{36}$/.test(data.id||'')||typeof data.path!=='string'||!/^\/(?:[a-zA-Z0-9/_-]*)$/.test(data.path)||data.path.length>180||/^\/admin/.test(data.path))return json({error:'Dados inválidos.'},400);
   const now=Date.now(),bucket=Math.floor(now/60000);
   const text=v=>typeof v==='string'?v.slice(0,120):'';
   await store.setJSON('presence/'+bucket+'/'+digest(data.id),{path:data.path,lastSeen:now,ip:text(context.ip),city:text(context.geo?.city),region:text(context.geo?.subdivision?.name),country:text(context.geo?.country?.name)});
   return json({ok:true});
  }
  if(path==='/go'&&method==='GET'){const c=await config();if(!c.officialUrl)return new Response('O link oficial ainda não foi configurado. Volte à página e tente novamente mais tarde.',{status:503,headers:{'content-type':'text/plain; charset=utf-8','cache-control':'no-store'}});let target;try{target=new URL(validLink(c.officialUrl));for(const [key,value] of u.searchParams){if((/^utm_[a-z0-9_]+$/i.test(key)||['gclid','gbraid','wbraid','dclid','fbclid','msclkid','src','sck','xcod'].includes(key))&&value.length<=2048)target.searchParams.set(key,value);}}catch{return json({error:'Destino indisponível.'},503);}return new Response(null,{status:302,headers:{location:target.href,'cache-control':'no-store','referrer-policy':'strict-origin-when-cross-origin'}});}
  if(path==='/api/admin/login'&&method==='POST'){
   if((!env.ADMIN_PASSWORD_HASH||!env.ADMIN_PASSWORD_SALT)&&!env.ADMIN_PASSWORD)return json({error:'A senha do AdminX ainda precisa ser definida no Netlify.'},503);
   const ip=context.ip||'unknown',key='attempt/'+digest(ip),now=Date.now();let attempts=await store.get(key,{type:'json'});
   if(attempts&&attempts.until>now&&attempts.count>=5)return json({error:'Muitas tentativas. Aguarde 15 minutos.'},429,{'retry-after':'900'});
   const raw=await req.text();if(raw.length>8192)return json({error:'Pedido muito grande.'},413);let data;try{data=JSON.parse(raw);}catch{return json({error:'Pedido inválido.'},400);}
   const username=String(data.username||'').slice(0,120),password=String(data.password||'').slice(0,1024);
   const salt=env.ADMIN_PASSWORD_SALT||'blog-admin-environment-v1';
   const expected=env.ADMIN_PASSWORD_HASH||verifier(env.ADMIN_PASSWORD,salt);
   const ok=equal(username,env.ADMIN_USERNAME||'adminx')&&equal(verifier(password,salt),expected);
   if(!ok){if(!attempts||attempts.until<=now)attempts={count:0,until:now+900000};attempts.count++;await store.setJSON(key,attempts);return json({error:'Usuário ou senha incorretos.'},401);}
   await store.delete(key);const token=randomBytes(32).toString('hex');await store.setJSON('session/'+digest(token),{username,expiresAt:now+lifetime});
   return json({authenticated:true},200,{'set-cookie':cookie(token,lifetime/1000)});
  }
  if(path.startsWith('/api/admin/')){
   const auth=await session(req);if(!auth)return json({error:'Entre na sua conta para continuar.'},401);
   if(path==='/api/admin/online'&&method==='GET'){
    const now=Date.now(),bucket=Math.floor(now/60000),unique=new Map();
    for(let n=0;n<3;n++){
     const {blobs}=await store.list({prefix:'presence/'+(bucket-n)+'/'});
     for(let i=0;i<blobs.length;i+=20){await Promise.all(blobs.slice(i,i+20).map(async({key})=>{const v=await store.get(key,{type:'json'});if(v&&v.lastSeen>now-90000){const id=key.split('/').pop(),prev=unique.get(id);if(!prev||v.lastSeen>prev.lastSeen)unique.set(id,v);}}));}
    }
    const pages=new Map();for(const v of unique.values())pages.set(v.path,(pages.get(v.path)||0)+1);
    const visitors=[...unique.values()].sort((a,b)=>b.lastSeen-a.lastSeen).map(v=>({path:v.path,lastSeen:new Date(v.lastSeen).toISOString(),ip:v.ip||'',city:v.city||'',region:v.region||'',country:v.country||''}));
    return json({online:unique.size,visitors,pages:[...pages].map(([path,count])=>({path,count})).sort((a,b)=>b.count-a.count),updatedAt:new Date(now).toISOString(),windowSeconds:90});
   }
   if(path==='/api/admin/session'&&method==='GET')return json({authenticated:true,username:auth.username,...await config()});
   if(path==='/api/admin/logout'&&method==='POST'){await store.delete(auth.key);return json({ok:true},200,{'set-cookie':cookie('',0)});}
   if(path==='/api/admin/config'&&method==='PUT'){
    const raw=await req.text();if(raw.length>8192)return json({error:'Pedido muito grande.'},413);let d;try{d=JSON.parse(raw);}catch{return json({error:'Pedido inválido.'},400);}
    let officialUrl;try{officialUrl=validLink(d.officialUrl);}catch(e){return json({error:e.message},400);}
    if(new URL(officialUrl).origin===u.origin)return json({error:'Use o site oficial externo, não uma página deste blog.'},400);
    const value={officialUrl,updatedAt:new Date().toISOString()};await store.setJSON('config',value);return json({ok:true,...value});
   }
  }
  return json({error:'Recurso não encontrado.'},404);
 }catch{return json({error:'Não foi possível completar a operação. Tente novamente.'},500);}}
}
