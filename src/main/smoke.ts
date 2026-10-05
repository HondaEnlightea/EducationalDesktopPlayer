import type {BrowserWindow} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import type {Command, State} from '../shared/types';
interface Context {win:BrowserWindow;phase:string;command:(c:Command)=>Promise<State>;state:()=>State;show:()=>void;hide:()=>void;fit:()=>void;quit:()=>void;output:string}
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
export async function runSmoke(c:Context){
 const {win}=c;fs.mkdirSync(c.output,{recursive:true});
 const js=(code:string)=>win.webContents.executeJavaScript(code);
 async function dom(condition:string){const start=Date.now();while(Date.now()-start<5000){if(await js(condition))return;await wait(35);}throw Error('Renderer timeout: '+condition);}
 async function settled(){await dom("document.querySelector('[data-testid=lesson]')?.dataset.transition==='idle' && !document.querySelector('[data-testid=reveal]').disabled");}
 async function click(id:string,delay=80){await js(`document.querySelector('[data-testid="${id}"]').click()`);await wait(delay);}
 async function key(code:string){win.webContents.sendInputEvent({type:'keyDown',keyCode:code});win.webContents.sendInputEvent({type:'keyUp',keyCode:code});await wait(70);}
 async function capture(name:string){await wait(120);fs.writeFileSync(path.join(c.output,name+'.png'),(await win.webContents.capturePage()).toPNG());}
 async function media(value:string){await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value}]});}
 const checks:string[]=[];
 try{
  await dom("!!document.querySelector('[data-testid=reveal]')");
  assert.equal(win.isFocused(),false);checks.push('startup does not take focus');
  win.showInactive();await wait(150);assert.equal(win.isFocused(),false);
  win.webContents.debugger.attach('1.3');await media('no-preference');
  if(c.phase==='first'){
   assert.equal(c.state().mode,'short');assert.equal(c.state().revealed,false);
   assert.equal(c.state().content.short.length,100);assert.equal(c.state().content.reading.length,100);
   assert.equal(await js("!!document.querySelector('[data-testid=translation]')"),false);
   assert.equal(await js("document.querySelector('[data-testid=reveal]').textContent"),'解説');
   assert.equal(await js("Math.abs(document.querySelector('[data-testid=reveal]').getBoundingClientRect().width-document.querySelector('[data-testid=next]').getBoundingClientRect().width)<1"),true);
   await click('reveal');await dom("!!document.querySelector('[data-testid=translation]')");assert.equal(c.state().summary.modeReveals.short,1);
   const translation=await js("(()=>{const e=document.querySelector('.translation');const s=getComputedStyle(e);return {font:s.fontSize,color:s.color,opacity:s.opacity}})()");
   assert.equal(translation.font,'16px');assert.equal(translation.color,'rgb(38, 60, 54)');assert.equal(translation.opacity,'1');
   await click('next',20);await dom("document.querySelector('[data-testid=lesson]').dataset.transition==='active'");
   const animation=await js("({outgoing:document.querySelector('.outgoing').getAnimations()[0].animationName,incoming:document.querySelector('.incoming').getAnimations()[0].animationName,frames:document.querySelector('.outgoing').getAnimations()[0].effect.getKeyframes().map(x=>x.transform)})");
   assert.equal(animation.outgoing,'card-out-forward');assert.equal(animation.incoming,'card-in-forward');assert.ok(animation.frames.some((x:string)=>x.includes('16px')));assert.ok(animation.frames.some((x:string)=>x.includes('-112%')));
   win.focus();win.webContents.focus();await wait(80);await key('Right');
   await settled();assert.equal(c.state().index,1);assert.equal(c.state().revealed,false);
   checks.push('equal action buttons, bounce/slide animation and navigation lock');
   await key('Left');await settled();assert.equal(c.state().index,0);
   await key('Down');await dom("!!document.querySelector('.current [data-testid=translation]')");assert.equal(c.state().revealed,true);
   const detailBounds=win.getBounds();await key('Up');await dom("!!document.querySelector('.focus-mode')");
   assert.equal(c.state().settings.focusMode,true);assert.ok(win.getBounds().height<detailBounds.height);
   assert.equal(await js("!!document.querySelector('.titlebar,.mode-tabs,.lesson-meta,[data-testid=history],[data-testid=settings]')"),false);
   assert.equal(await js("document.querySelector('[data-testid=focus-toggle]').getBoundingClientRect().right > document.documentElement.clientWidth-42"),true);
   await key('Right');await settled();assert.equal(c.state().index,1);assert.equal(c.state().revealed,false);
   await key('Down');await settled();assert.equal(c.state().revealed,true);
   await key('Up');await dom("!!document.querySelector('.titlebar')");
   for(const field of ['width','height'] as const)assert.ok(Math.abs(win.getBounds()[field]-detailBounds[field])<=2,'restored detail '+field);
   checks.push('native arrows, focus hides chrome and restores detail size');
   await click('mode-reading');await settled();
   assert.equal(await js("document.querySelectorAll('.current .english').length"),1);
   assert.equal(await js("document.querySelector('.current .reading-english').textContent"),c.state().content.reading[0].sentences.map(s=>s.english).join(' '));
   await key('Down');await dom("document.querySelectorAll('.current mark').length===2");
   assert.equal(await js("document.querySelectorAll('.current .translation').length"),1);
   assert.equal(await js("document.querySelector('.current .translation').textContent"),c.state().content.reading[0].sentences.map(s=>s.japanese).join(''));
   const separator=await js("({before:getComputedStyle(document.querySelector('.reading-english')).marginBottom,after:getComputedStyle(document.querySelector('.reading-translation')).paddingTop})");
   assert.equal(separator.before,'6px');assert.equal(separator.after,'5px');
   checks.push('100 items per mode, dark 16px translation and half separator spacing');
   await capture('reading');
   await click('focus-toggle');await dom("!!document.querySelector('.focus-mode')");await wait(220);await capture('focus-reading');
   await click('focus-toggle');await dom("!!document.querySelector('.titlebar')");
   checks.push('reading English/translation blocks and markers in both views');
   await c.command({type:'navigate',step:-1});await settled();assert.equal(c.state().index,99);
   await dom("document.querySelector('[data-testid=position]').textContent==='100 / 100'");
   await c.command({type:'reveal'});await dom("!!document.querySelector('.current .translation')");await capture('reading-100');
   await c.command({type:'navigate',step:1});await settled();assert.equal(c.state().index,0);
   await c.command({type:'mode',mode:'short'});await c.command({type:'navigate',step:-1});await c.command({type:'navigate',step:-1});await settled();assert.equal(c.state().index,99);
   await c.command({type:'reveal'});await dom("!!document.querySelector('.current .translation')");await capture('short-100');
   await c.command({type:'navigate',step:1});await settled();assert.equal(c.state().index,0);
   checks.push('last short/reading item renders translation and wraps to first');
   await click('mode-flashcard');await settled();await dom("document.querySelector('.current [data-testid=card-body]').textContent==='maintain'");
   await key('Down');await dom("document.querySelector('.current [data-testid=card-body]').textContent==='維持する、保つ'");
   await key('Right');await settled();assert.equal(c.state().index,1);
   checks.push('generic card front/back and keyboard navigation');
   await media('reduce');await key('Right');await settled();assert.equal(c.state().index,2);
   assert.equal(await js("!!document.querySelector('.outgoing')"),false);
   await key('Left');await settled();assert.equal(c.state().index,1);await media('no-preference');checks.push('reduced motion changes content without sliding');
   await c.command({type:'pause'});const paused=c.state().summary.totalMs;await wait(100);assert.equal(c.state().summary.totalMs,paused);await c.command({type:'pause'});checks.push('manual pause stops time');
   c.hide();const hidden=c.state().summary.totalMs;await wait(100);assert.equal(c.state().summary.totalMs,hidden);assert.equal(win.isVisible(),false);c.show();assert.equal(win.isFocused(),false);checks.push('hide/show pauses time and avoids focus');
   await c.command({type:'page',page:'history'});await dom("!!document.querySelector('.history table')");const inHistory=c.state().summary.totalMs;await wait(100);assert.equal(c.state().summary.totalMs,inHistory);checks.push('history view excludes learning time');
   await c.command({type:'page',page:'settings'});await dom("!!document.querySelector('select')");
   assert.equal(await js("document.body.textContent.includes('コンパクト')"),false);
   win.focus();win.webContents.focus();await js("document.querySelector('select').focus()");await key('Up');assert.equal(c.state().page,'settings');assert.equal(c.state().settings.focusMode,false);checks.push('settings input retains native arrow handling');
   await c.command({type:'setting',key:'alwaysOnTop',value:false});assert.equal(win.isAlwaysOnTop(),false);await c.command({type:'setting',key:'alwaysOnTop',value:true});assert.equal(win.isAlwaysOnTop(),true);
   win.setBounds({x:100000,y:100000,width:430,height:540});c.fit();assert.ok(win.getBounds().x<100000&&win.getBounds().y<100000);checks.push('offscreen recovery and pin setting');
   await c.command({type:'setting',key:'fontSize',value:20});await c.command({type:'page',page:'learn'});await settled();
   await click('focus-toggle');await dom("!!document.querySelector('.focus-mode')");
   win.setBounds({...win.getBounds(),width:360,height:280});c.fit();await wait(250);await capture('focus-flashcard');
   assert.equal(await js("Math.abs(document.querySelector('[data-testid=reveal]').getBoundingClientRect().width-document.querySelector('[data-testid=next]').getBoundingClientRect().width)<1"),true);
   checks.push('focus layout, custom size and persistent settings');
  }else{
   const s=c.state();assert.equal(s.mode,'flashcard');assert.equal(s.index,1);assert.equal(s.settings.fontSize,20);assert.equal(s.settings.focusMode,true);assert.equal('compact' in s.settings,false);assert.ok(s.summary.sessions.some(x=>x.endedAt));assert.ok(s.summary.modeViews.reading>0);assert.ok(s.summary.modeReveals.short>0);
   assert.equal(await js("!!document.querySelector('.titlebar,.mode-tabs,.lesson-meta')"),false);
   const first=JSON.parse(fs.readFileSync(path.join(c.output,'first.json'),'utf8'));const bounds=win.getBounds();for(const field of ['x','y','width','height'] as const)assert.ok(Math.abs(bounds[field]-first.state.settings.bounds[field])<=2,'persisted '+field);
   checks.push('history/index/focus/custom bounds/settings survive restart');
   await c.command({type:'page',page:'history'});await c.command({type:'clearHistory'});const cleared=c.state().summary;assert.equal(cleared.totalMs,0);assert.equal(cleared.recentEvents.length,0);assert.equal(cleared.sessions.length,1);checks.push('fixture history deletion leaves settings/content');
  }
  win.webContents.debugger.detach();
  fs.writeFileSync(path.join(c.output,c.phase+'.json'),JSON.stringify({passed:true,checks,state:c.state()},null,2));c.quit();
 }catch(error){fs.writeFileSync(path.join(c.output,c.phase+'.json'),JSON.stringify({passed:false,error:String(error),checks,bounds:win.getBounds(),state:c.state()},null,2));throw error;}
}
