import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const electron=require('electron');
const root=path.resolve('.test-data');fs.mkdirSync(root,{recursive:true});
const data=fs.mkdtempSync(path.join(root,'desktop-'));
const outputRoot=path.resolve('artifacts/smoke');fs.mkdirSync(outputRoot,{recursive:true});
const output=fs.mkdtempSync(path.join(outputRoot,'run-'));
const executable=process.env.DESKTOP_PLAYER_SMOKE_EXE||electron;
const viaLauncher=process.env.DESKTOP_PLAYER_SMOKE_LAUNCHER==='1';
const launcher=path.resolve('Educational Desktop Playerを起動.cmd');
for(const phase of ['first','restart']){
 const child=spawn(viaLauncher?(process.env.ComSpec||'cmd.exe'):executable,viaLauncher?['/d','/s','/c',`""${launcher}" --wait"`]:process.env.DESKTOP_PLAYER_SMOKE_EXE?[]:['.'],{cwd:process.cwd(),windowsHide:true,windowsVerbatimArguments:viaLauncher,env:{...process.env,DESKTOP_PLAYER_DATA_DIR:data,DESKTOP_PLAYER_SMOKE_PHASE:phase,DESKTOP_PLAYER_SMOKE_OUTPUT:output},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
 const code=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{child.kill();reject(Error('Desktop smoke timeout\n'+logs));},30000);child.on('error',reject);child.on('exit',code=>{clearTimeout(timeout);resolve(code);});});
 const file=path.join(output,phase+'.json');
 if(code!==0||!fs.existsSync(file)||!JSON.parse(fs.readFileSync(file)).passed)throw Error('Desktop smoke failed: '+phase+'\n'+logs+(fs.existsSync(file)?fs.readFileSync(file):''));
 console.log(phase+': '+JSON.parse(fs.readFileSync(file)).checks.join(' / '));
}
fs.writeFileSync(path.join(output,'data-location.txt'),data);
fs.writeFileSync(path.join(outputRoot,'latest.json'),JSON.stringify({output,data,executable:viaLauncher?path.resolve('release/win-unpacked/Educational Desktop Player.exe'):executable,launcher:viaLauncher?launcher:null},null,2));
console.log('Smoke passed. Isolated test data: '+data);
