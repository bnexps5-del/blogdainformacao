const $=id=>document.getElementById(id);let current='';
let onlineTimer=null,onlinePending=false;
async function refreshOnline(){
 if(onlinePending||$('dashboard').hidden||document.visibilityState!=='visible')return;
 onlinePending=true;
 try{const data=await api('online');$('online-count').textContent=data.online;$('online-status').textContent='Atualizado às '+new Date(data.updatedAt).toLocaleTimeString('pt-BR');$('online-pages').replaceChildren();if(!data.pages.length){$('online-pages').textContent='Nenhum visitante ativo neste momento.';}for(const page of data.pages){const row=document.createElement('div');row.className='online-row';const label=document.createElement('span'),count=document.createElement('strong');label.textContent=page.path;count.textContent=page.count+' online';row.append(label,count);$('online-pages').append(row);}}
 catch(e){$('online-count').textContent='—';$('online-status').textContent='Não foi possível atualizar os visitantes. Tentando novamente...';if(e.status===401){showLogin();message('Sua sessão expirou. Entre novamente.',true);}}
 finally{onlinePending=false;}
}
document.addEventListener('visibilitychange',refreshOnline);
function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error);$('message').hidden=false;}
async function api(path,method='GET',data){const response=await fetch('/api/admin/'+path,{method,credentials:'same-origin',headers:method==='GET'?{}:{'content-type':'application/json'},body:data?JSON.stringify(data):undefined,cache:'no-store'});let value;try{value=await response.json();}catch{throw Error('O painel precisa ser publicado com o servidor configurado.');}if(!response.ok){const error=Error(value.error||'Não foi possível concluir.');error.status=response.status;throw error;}return value;}
function showLogin(){clearInterval(onlineTimer);onlineTimer=null;current='';$('password').value='';$('dashboard').hidden=true;$('login-panel').hidden=false;}
function showDashboard(c){clearInterval(onlineTimer);onlineTimer=setInterval(refreshOnline,15000);setTimeout(refreshOnline,0);$('login-panel').hidden=true;$('dashboard').hidden=false;current=c.officialUrl||'';$('official-url').value=current;$('link-status').textContent=current?'Configurado':'Não configurado';$('test-link').hidden=!current;if(current)$('test-link').href=current;$('updated').textContent=c.updatedAt?'Última atualização: '+new Date(c.updatedAt).toLocaleString('pt-BR'):'Nenhum link configurado.';}
$('show-password').addEventListener('click',()=>{const show=$('password').type==='password';$('password').type=show?'text':'password';$('show-password').textContent=show?'Ocultar':'Mostrar';$('show-password').setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');});
$('login-form').addEventListener('submit',async event=>{event.preventDefault();$('login-button').disabled=true;try{await api('login','POST',{username:$('username').value,password:$('password').value});$('password').value='';showDashboard(await api('session'));$('message').hidden=true;}catch(e){message(e.message,true);}finally{$('login-button').disabled=false;}});
$('link-form').addEventListener('submit',async event=>{event.preventDefault();$('save').disabled=true;try{const c=await api('config','PUT',{officialUrl:$('official-url').value});showDashboard(c);message('Link salvo. Os botões de todas as páginas já usam o novo destino.');}catch(e){if(e.status===401)showLogin();message(e.message,true);}finally{$('save').disabled=false;}});
$('logout').addEventListener('click',async()=>{try{await api('logout','POST',{});showLogin();message('Você saiu do painel.');}catch(e){message(e.message,true);}});
api('session').then(showDashboard).catch(e=>{showLogin();if(e.status!==401)message(e.message,true);});
