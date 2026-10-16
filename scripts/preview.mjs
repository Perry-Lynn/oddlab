import http from 'node:http';
import worker from '../worker/index.js';
import {localD1} from './local-d1.mjs';
const DB=await localD1('/private/tmp/oddlab-multilingual-preview.sqlite');
http.createServer(async(req,res)=>{try{const chunks=[];for await(const chunk of req)chunks.push(chunk);const response=await worker.fetch(new Request('http://127.0.0.1:8765'+req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)}),{DB});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch(e){res.writeHead(500);res.end('Preview error');}}).listen(8765,'127.0.0.1',()=>console.log('Preview http://127.0.0.1:8765'));
