import { createServer } from 'node:http';
import { createApp } from './app.mjs';
import { resolve,dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import express from 'express';
import { spawn } from 'node:child_process';
const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const production=process.argv.includes('--production');
const app=createApp({defaultDemo:process.argv.includes('--demo')});
const server=createServer(app);let vite;
if(production){if(!existsSync(join(project,'dist/index.html'))){console.error('Primero ejecute npm run build.');process.exit(1);}app.use(express.static(join(project,'dist')));app.get('/{*path}',(req,res)=>res.sendFile(join(project,'dist/index.html')));}
else{const {createServer}=await import('vite');vite=await createServer({root:project,server:{middlewareMode:true,hmr:{server}},appType:'spa'});app.use(vite.middlewares);}
const port=Number(process.env.PORT||3000);
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`El puerto ${port} ya está ocupado. Cierre la otra instancia o configure PORT.`:e.message);process.exit(1);});
server.listen(port,'127.0.0.1',()=>{console.log(`\n  CEICOM · Gestión académica\n  Abra http://127.0.0.1:${port}\n  Mantenga esta ventana abierta. Ctrl+C para salir.\n`);if(process.platform==='win32'&&!process.env.CI&&process.env.CEICOM_OPEN!=='0')spawn('cmd.exe',['/c','start','',`http://127.0.0.1:${port}`],{stdio:'ignore',windowsHide:true}).on('error',()=>{});});
let closing=false;async function close(){if(closing)return;closing=true;server.closeAllConnections();await new Promise(r=>server.close(r));await vite?.close();app.locals.close();process.exit(0);}process.on('SIGINT',close);process.on('SIGTERM',close);
