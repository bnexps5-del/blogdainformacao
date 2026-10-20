import {getStore} from '@netlify/blobs';
import {makeHandler} from '../lib/core.mjs';
export default async function(request,context){const store=getStore({name:'blog-admin',consistency:'strong'});return makeHandler(store)(request,context);}
export const config={path:['/api/config','/api/admin/*','/api/presence','/go']};
