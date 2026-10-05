import {app,BrowserWindow,ipcMain,Tray,Menu,nativeImage,screen,powerMonitor,dialog} from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {HistoryStore,readJson,writeJson} from '../core/storage.mjs';
import {loadContent} from '../core/content.mjs';
import {fitBounds,bottomRight} from '../core/geometry.mjs';
import {readSettings} from '../core/settings.mjs';
import type {Mode,Page,Settings,State,Command,Content} from '../shared/types';
import {runSmoke} from './smoke';
const appRoot=app.getAppPath(); const base=app.isPackaged?process.resourcesPath:appRoot;
const portableBase=app.isPackaged?path.dirname(process.execPath):base;
const workspaceBase=app.isPackaged&&fs.existsSync(path.resolve(portableBase,'../../Educational Desktop Playerを起動.cmd'))?path.resolve(portableBase,'../..'):portableBase;
const dataDirectory=process.env.DESKTOP_PLAYER_DATA_DIR||path.join(workspaceBase,'data');
fs.mkdirSync(path.join(dataDirectory,'runtime'),{recursive:true});app.setPath('userData',path.join(dataDirectory,'runtime'));app.setName('Educational Desktop Player');
const smokePhase=process.env.DESKTOP_PLAYER_SMOKE_PHASE;
if(smokePhase&&!dataDirectory.includes(path.sep+'.test-data'+path.sep))throw Error('検証用データの保存先を確認してください');
const locked=app.requestSingleInstanceLock();
if(!locked){app.quit();}else{
 let win:BrowserWindow,tray:Tray,store:InstanceType<typeof HistoryStore>,settings:Settings,content:Content;
 let page:Page='learn',revealed=false,manualPaused=false,hidden=false,systemPaused=false,quitting=false;
 let timer:ReturnType<typeof setInterval>,boundsTimer:ReturnType<typeof setTimeout>;
 const settingsFile=path.join(dataDirectory,'settings.json');
 const learningModes:Mode[]=['short','reading','flashcard'];
 const activity=()=>{if(store)store.setActive(!hidden&&!manualPaused&&!systemPaused&&page==='learn'?settings.mode:null);};
 const currentItem=()=>content[settings.mode][settings.indexes[settings.mode]];
 const state=():State=>({mode:settings.mode,page,index:settings.indexes[settings.mode],revealed,paused:manualPaused,hidden,settings,content,summary:store.summary(),dataDirectory});
 const emit=()=>{if(win&&!win.isDestroyed())win.webContents.send('desktop-player:state',state());};
 const saveSettings=()=>writeJson(settingsFile,settings);
 const recordView=()=>store.record('view',settings.mode,currentItem().id);
 function show(){const wasHidden=hidden;hidden=false;activity();if(wasHidden&&page==='learn')recordView();win.showInactive();emit();}
 function hide(){hidden=true;activity();win.hide();emit();}
 function fit(){if(!win||win.isDestroyed())return;const fitted=fitBounds(win.getBounds(),screen.getAllDisplays().map(d=>d.workArea));win.setBounds(fitted);settings.bounds=fitted;saveSettings();}
 function toggleFocus(){
  const b=win.getBounds();
  if(settings.focusMode)settings.focusSize={width:b.width,height:b.height};
  else settings.detailSize={width:b.width,height:b.height};
  settings.focusMode=!settings.focusMode;
  const size=settings.focusMode?(settings.focusSize||{width:b.width,height:Math.max(240,b.height-148)}):(settings.detailSize||{width:b.width,height:b.height+148});
  win.setBounds(fitBounds({...b,...size,x:b.x+b.width-size.width,y:b.y+b.height-size.height},screen.getAllDisplays().map(d=>d.workArea)));
  settings.bounds=win.getBounds();
  if(page!=='learn')recordView();page='learn';activity();saveSettings();updateTray();emit();
 }
 function openPage(next:Page){if(settings.focusMode)toggleFocus();page=next;activity();show();}
 function updateTray(){if(!tray)return;tray.setContextMenu(Menu.buildFromTemplate([
  {label:'Educational Desktop Playerを表示',click:show},{label:'一時非表示',click:hide},{type:'separator'},
  {label:'集中モード',type:'checkbox',checked:settings.focusMode,click:toggleFocus},
  {label:'利用時間を一時停止',type:'checkbox',checked:manualPaused,click:()=>{manualPaused=!manualPaused;activity();updateTray();emit();}},
  {label:'最前面に表示',type:'checkbox',checked:settings.alwaysOnTop,click:()=>{settings.alwaysOnTop=!settings.alwaysOnTop;win.setAlwaysOnTop(settings.alwaysOnTop,'floating');saveSettings();updateTray();emit();}},
  {label:'履歴',click:()=>openPage('history')},{label:'設定',click:()=>openPage('settings')},
  {type:'separator'},{label:'終了',click:()=>app.quit()}
 ]));}
 async function command(c:Command){
  if(!c||typeof c.type!=='string')throw Error('操作が不正です');
  switch(c.type){
   case 'navigate':if(c.step!==1&&c.step!==-1)throw Error('移動方向が不正です');settings.indexes[settings.mode]=(settings.indexes[settings.mode]+c.step+content[settings.mode].length)%content[settings.mode].length;revealed=false;recordView();saveSettings();break;
   case 'mode':if(!learningModes.includes(c.mode))throw Error('モードが不正です');settings.mode=c.mode;page='learn';revealed=false;activity();recordView();saveSettings();break;
   case 'reveal':revealed=!revealed;if(revealed)store.record('reveal',settings.mode,currentItem().id);break;
   case 'page':if(!['learn','settings','history'].includes(c.page))throw Error('画面が不正です');if(page!==c.page&&c.page==='learn')recordView();page=c.page;activity();break;
   case 'pause':manualPaused=!manualPaused;activity();updateTray();break;
   case 'hide':hide();break;
   case 'focus':toggleFocus();break;
   case 'setting':if(c.key==='alwaysOnTop'&&typeof c.value==='boolean'){settings.alwaysOnTop=c.value;win.setAlwaysOnTop(c.value,'floating');}else if(c.key==='fontSize'&&typeof c.value==='number'&&[16,18,20,22].includes(c.value))settings.fontSize=c.value;else throw Error('設定値が不正です');saveSettings();updateTray();break;
   case 'clearHistory':{
    const accepted=smokePhase?true:(await dialog.showMessageBox(win,{type:'warning',title:'履歴を削除',message:'利用履歴をすべて削除しますか？',detail:'この操作は取り消せません。学習コンテンツと設定は残ります。',buttons:['キャンセル','削除する'],defaultId:0,cancelId:0,noLink:true})).response===1;
    if(accepted){store.clear();if(page==='learn')recordView();}break;
   }
   default:throw Error('未対応の操作です');
  }
  emit();return state();
 }
 function trusted(event:Electron.IpcMainInvokeEvent){if(event.sender!==win.webContents||event.senderFrame?.url!==pathToFileURL(path.join(appRoot,'dist/index.html')).href)throw Error('未許可の送信元です');}
 app.on('second-instance',()=>{if(win)show();});
 app.whenReady().then(async()=>{
  content=loadContent(path.join(base,'content')) as Content;
  const raw=readJson(settingsFile,{});
  settings=readSettings(raw,Object.fromEntries(learningModes.map(m=>[m,content[m].length]))) as Settings;
  const area=screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const fallback=bottomRight(area,430,settings.focusMode?392:540);
  const validBounds=raw.bounds&&['x','y','width','height'].every(k=>Number.isFinite(raw.bounds[k]));
  settings.bounds=fitBounds(validBounds?raw.bounds:fallback,screen.getAllDisplays().map(d=>d.workArea));
  store=new HistoryStore(path.join(dataDirectory,'history.json'));store.start();
  const assets=path.join(base,'assets');
  win=new BrowserWindow({...settings.bounds,minWidth:300,minHeight:240,frame:false,transparent:true,backgroundColor:'#00000000',resizable:true,show:false,alwaysOnTop:settings.alwaysOnTop,skipTaskbar:true,icon:path.join(assets,'app.ico'),title:'Educational Desktop Player',webPreferences:{preload:path.join(appRoot,'dist/preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
  // Reapply outer bounds: Windows adds the frameless resize border during construction.
  win.setBounds(settings.bounds!);
  win.setAlwaysOnTop(settings.alwaysOnTop,'floating');
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());win.webContents.session.setPermissionRequestHandler((_w,_p,callback)=>callback(false));
  tray=new Tray(nativeImage.createFromPath(path.join(assets,'tray.png')));tray.setToolTip('Educational Desktop Player — 右下で学ぶ');tray.on('click',show);tray.on('double-click',show);updateTray();
  win.on('close',e=>{if(!quitting){e.preventDefault();hide();}});
  win.on('minimize',()=>hide());
  const rememberBounds=()=>{clearTimeout(boundsTimer);boundsTimer=setTimeout(()=>{if(quitting)return;settings.bounds=win.getBounds();const size={width:settings.bounds.width,height:settings.bounds.height};if(settings.focusMode)settings.focusSize=size;else settings.detailSize=size;saveSettings();},180);};
  win.on('move',rememberBounds);win.on('resize',rememberBounds);
  screen.on('display-added',fit);screen.on('display-removed',fit);screen.on('display-metrics-changed',fit);
  powerMonitor.on('suspend',()=>{systemPaused=true;activity();});powerMonitor.on('resume',()=>{systemPaused=false;activity();});powerMonitor.on('lock-screen',()=>{systemPaused=true;activity();});powerMonitor.on('unlock-screen',()=>{systemPaused=false;activity();});
  ipcMain.handle('desktop-player:get',event=>{trusted(event);return state();});ipcMain.handle('desktop-player:command',(event,c)=>{trusted(event);return command(c);});
  saveSettings();
  timer=setInterval(()=>{store.checkpoint();emit();},5000);
  await win.loadFile(path.join(appRoot,'dist/index.html'));
  if(!smokePhase)win.showInactive();activity();recordView();emit();
  if(smokePhase){await runSmoke({win,phase:smokePhase,command,state,show,hide,fit,quit:()=>app.quit(),output:process.env.DESKTOP_PLAYER_SMOKE_OUTPUT!});}
 }).catch(e=>{fs.writeFileSync(path.join(dataDirectory,'startup-error.log'),String(e.stack||e));if(smokePhase){console.error(e);app.exit(1);}else{dialog.showErrorBox('Educational Desktop Playerを起動できませんでした',String(e.message)+'\n保存データは自動削除していません。');app.quit();}});
 app.on('before-quit',()=>{quitting=true;clearInterval(timer);clearTimeout(boundsTimer);if(store)store.stop();if(win&&!win.isDestroyed()){settings.bounds=win.getBounds();saveSettings();}tray?.destroy();});
}
