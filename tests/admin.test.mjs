import test from 'node:test';import assert from 'node:assert/strict';import {makeHandler,verifier,validLink} from '../netlify/lib/core.mjs';
const env={ADMIN_USERNAME:'adminx',ADMIN_PASSWORD_SALT:'test-salt-only',ADMIN_PASSWORD_HASH:verifier('test-password-only','test-salt-only')};
function setup(){const map=new Map();const store={async get(k){return map.get(k)||null},async setJSON(k,v){map.set(k,v)},async delete(k){map.delete(k)}};return makeHandler(store,env);}
const req=(path,method='GET',data,cookie)=>new Request('https://blog.test'+path,{method,headers:{origin:'https://blog.test','content-type':'application/json',...(cookie?{cookie}:{})},body:method==='GET'?undefined:JSON.stringify(data||{})});
test('rejects writes without login and rejects cross origin',async()=>{const h=setup();assert.equal((await h(req('/api/admin/config','PUT',{officialUrl:'https://gov.br'}))).status,401);const r=new Request('https://blog.test/api/admin/login',{method:'POST',headers:{origin:'https://other.test','content-type':'application/json'},body:'{}'});assert.equal((await h(r)).status,403);});
test('login, global update, live redirect and logout',async()=>{const h=setup();const login=await h(req('/api/admin/login','POST',{username:'adminx',password:'test-password-only'}),{ip:'test'});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);const auth=cookie.split(';')[0];let r=await h(req('/api/admin/config','PUT',{officialUrl:'https://www.gov.br/programa'},auth));assert.equal(r.status,200);let data=await (await h(req('/api/config'))).json();assert.equal(data.officialUrl,'https://www.gov.br/programa');r=await h(req('/go'));assert.equal(r.status,302);assert.equal(r.headers.get('location'),data.officialUrl);await h(req('/api/admin/logout','POST',{},auth));assert.equal((await h(req('/api/admin/session','GET',null,auth))).status,401);});
test('rejects unsafe destinations',()=>{for(const url of ['javascript:alert(1)','http://www.gov.br','https://localhost/','https://127.0.0.1/','https://user:pass@gov.br/'])assert.throws(()=>validLink(url));});
test('redirect passes campaign attribution and preserves destination parameters and fragment',async()=>{
 const h=setup(),login=await h(req('/api/admin/login','POST',{username:'adminx',password:'test-password-only'})),auth=login.headers.get('set-cookie').split(';')[0];
 await h(req('/api/admin/config','PUT',{officialUrl:'https://www.example.com/offer?product=42&utm_source=old#buy'},auth));
 const response=await h(req('/go?utm_source=google&utm_medium=cpc&utm_campaign=Teste%20CNH&gclid=click123&gbraid=braid123&email=private&redirect=https://evil.test'));
 assert.equal(response.status,302);const target=new URL(response.headers.get('location'));
 assert.equal(target.origin,'https://www.example.com');assert.equal(target.searchParams.get('product'),'42');assert.equal(target.hash,'#buy');assert.equal(target.searchParams.get('utm_source'),'google');assert.equal(target.searchParams.get('utm_campaign'),'Teste CNH');assert.equal(target.searchParams.get('gclid'),'click123');assert.equal(target.searchParams.get('gbraid'),'braid123');assert.equal(target.searchParams.has('email'),false);assert.equal(target.searchParams.has('redirect'),false);
});
test('throttles repeated failures',async()=>{const h=setup();for(let i=0;i<5;i++)assert.equal((await h(req('/api/admin/login','POST',{username:'adminx',password:'wrong'}),{ip:'one-client'})).status,401);assert.equal((await h(req('/api/admin/login','POST',{username:'adminx',password:'test-password-only'}),{ip:'one-client'})).status,429);});

test('online counts unique active visitors, excludes stale records and protects dashboard',async()=>{
 const map=new Map(),store={async get(k){return map.get(k)||null},async setJSON(k,v){map.set(k,v)},async delete(k){map.delete(k)},async list({prefix}){return {blobs:[...map.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))}}};
 const h=makeHandler(store,env),id='10000000-0000-4000-8000-000000000001';
 assert.equal((await h(req('/api/admin/online'))).status,401);
 assert.equal((await h(req('/api/presence','POST',{id,path:'/historias/entregador/'}))).status,200);
 const presence=await h(req('/api/presence','POST',{id,path:'/guia/',ip:'spoofed',city:'spoofed'}),{ip:'203.0.113.7',geo:{city:'Salvador',subdivision:{name:'Bahia'},country:{name:'Brazil'},latitude:12,longitude:34}});
 assert.equal(presence.status,200);assert.deepEqual(await presence.json(),{ok:true});
 assert.equal((await h(req('/api/presence','POST',{id,path:'/adminx'}))).status,400);
 assert.equal((await h(req('/api/presence','POST',{id,path:'/guia/?email=private'}))).status,400);
 const now=Date.now(),bucket=Math.floor(now/60000);
 map.set('presence/'+bucket+'/expired',{path:'/',lastSeen:now-100000});
 const login=await h(req('/api/admin/login','POST',{username:'adminx',password:'test-password-only'}),{ip:'test'}),auth=login.headers.get('set-cookie').split(';')[0];
 const data=await (await h(req('/api/admin/online','GET',null,auth))).json();
 assert.equal(data.online,1);assert.deepEqual(data.pages,[{path:'/guia/',count:1}]);
 assert.equal(data.visitors.length,1);assert.equal(data.visitors[0].ip,'203.0.113.7');assert.equal(data.visitors[0].city,'Salvador');assert.equal(data.visitors[0].region,'Bahia');assert.equal(data.visitors[0].country,'Brazil');assert.equal(data.visitors[0].latitude,undefined);assert.equal(data.visitors[0].longitude,undefined);
});

test('login accepts server environment password and rejects unconfigured authentication',async()=>{
 const map=new Map(),store={async get(k){return map.get(k)||null},async setJSON(k,v){map.set(k,v)},async delete(k){map.delete(k)}};
 const h=makeHandler(store,{ADMIN_PASSWORD:'local-test-password'});
 assert.equal((await h(req('/api/admin/login','POST',{username:'adminx',password:'wrong'}))).status,401);
 assert.equal((await h(req('/api/admin/login','POST',{username:'adminx',password:'local-test-password'}))).status,200);
 const unconfigured=makeHandler(store,{});assert.equal((await unconfigured(req('/api/admin/login','POST',{}))).status,503);
});
