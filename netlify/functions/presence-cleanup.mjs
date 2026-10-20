import {getStore} from '@netlify/blobs';
export default async function(){
 const store=getStore({name:'blog-admin',consistency:'strong'}),cutoff=Math.floor(Date.now()/60000)-5;
 for await(const page of store.list({prefix:'presence/',paginate:true})){
  for(let i=0;i<page.blobs.length;i+=20)await Promise.all(page.blobs.slice(i,i+20).filter(({key})=>Number(key.split('/')[1])<cutoff).map(({key})=>store.delete(key)));
 }
 return new Response('ok');
}
export const config={schedule:'@daily'};
