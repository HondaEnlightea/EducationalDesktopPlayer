import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {HistoryStore,readJson,writeJson} from '../src/core/storage.mjs';
import {fitBounds,bottomRight} from '../src/core/geometry.mjs';
import {loadContent} from '../src/core/content.mjs';
import {markerRuns} from '../src/core/markers.mjs';
import {readSettings} from '../src/core/settings.mjs';
const root=path.resolve('.test-data');fs.mkdirSync(root,{recursive:true});
function fixture(){const dir=fs.mkdtempSync(path.join(root,'core-'));return {dir,file:path.join(dir,'history.json'),clean(){assert.ok(dir.startsWith(root+path.sep));fs.rmSync(dir,{recursive:true});}};}
test('非表示・一時停止区間を除外し、モード別の閲覧と裏面表示を再起動後も保持',()=>{const f=fixture();let now=Date.parse('2026-10-04T10:00:00+09:00');try{const h=new HistoryStore(f.file,()=>now);h.start();h.setActive('short');h.record('view','short','short-001');now+=1000;h.record('reveal','short','short-001');now+=1000;h.setActive(null);now+=50000;assert.equal(h.summary().totalMs,2000);h.setActive('reading');h.record('view','reading','reading-001');now+=3000;h.stop();const loaded=new HistoryStore(f.file,()=>now);assert.equal(loaded.summary().totalMs,5000);assert.equal(loaded.summary().modeMs.short,2000);assert.equal(loaded.summary().modeMs.reading,3000);assert.equal(loaded.summary().modeViews.short,1);assert.equal(loaded.summary().modeReveals.short,1);assert.equal(loaded.summary().sessions[0].endedAt,new Date(now).toISOString());assert.equal(loaded.data.sessions[0].events[0].contentId,'short-001');}finally{f.clean();}});
test('異常終了からの復元で停止時間を追加せず、日をまたぐ時間を正しく按分',()=>{const f=fixture();let now=Date.parse('2026-10-03T23:59:59+09:00');try{const h=new HistoryStore(f.file,()=>now);h.start();h.setActive('flashcard');now+=3000;h.checkpoint();assert.equal(h.summary('2026-10-03').todayMs,1000);assert.equal(h.summary('2026-10-04').todayMs,2000);now+=3600000;const restored=new HistoryStore(f.file,()=>now);assert.equal(restored.summary().totalMs,3000);assert.equal(restored.data.sessions[0].endReason,'interrupted');restored.start();restored.setActive('short');restored.record('view','short','x');restored.clear();assert.equal(restored.summary().totalMs,0);assert.equal(restored.summary().recentEvents.length,0);assert.equal(restored.data.sessions.length,1);}finally{f.clean();}});
test('壊れた保存ファイルを初期化せず、例外と元内容を保持',()=>{const f=fixture();try{fs.writeFileSync(f.file,'not JSON');assert.throws(()=>new HistoryStore(f.file),/元のファイルは変更していません/);assert.equal(fs.readFileSync(f.file,'utf8'),'not JSON');writeJson(f.file,{a:1});assert.deepEqual(readJson(f.file,{}),{a:1});}finally{f.clean();}});
test('切断したモニター・負座標・小さい作業領域でも画面内へ戻す',()=>{const areas=[{x:0,y:0,width:1920,height:1040},{x:-1280,y:0,width:1280,height:984}];assert.deepEqual(bottomRight(areas[0],430,540),{x:1472,y:482,width:430,height:540});assert.equal(fitBounds({x:-1200,y:30,width:430,height:540},areas).x,-1200);const fitted=fitBounds({x:3000,y:2000,width:430,height:540},[areas[0]]);assert.equal(fitted.x,1490);assert.equal(fitted.y,500);assert.deepEqual(fitBounds({x:0,y:0,width:900,height:900},[{x:0,y:0,width:250,height:200}]),{x:0,y:0,width:250,height:200});});
test('教材の文数・ID・汎用カード・マーカー指定を検証',()=>{const c=loadContent('content');assert.equal(c.short.length,100);assert.equal(c.reading[0].sentences.length,3);assert.equal(c.flashcard[0].front.blocks[0].kind,'text');const runs=markerRuns('It works. It lasts.',[{phrase:'It',kind:'reference',occurrence:2}]);assert.equal(runs.filter(r=>r.marker)[0].text,'It');assert.equal(runs[0].text,'It works. ');assert.equal(runs.map(r=>r.text).join(''),'It works. It lasts.');});
test('旧コンパクト設定を集中モードへ移行し、番号・文字サイズ・表示寸法を保持',()=>{
 const lengths={short:2,reading:2,flashcard:3};
 const migrated=readSettings({compact:true,normalSize:{width:468,height:389},bounds:{width:350,height:320},mode:'reading',fontSize:20,indexes:{short:1,reading:1,flashcard:2}},lengths);
 assert.equal(migrated.focusMode,true);assert.equal(migrated.mode,'reading');assert.equal(migrated.fontSize,20);assert.deepEqual(migrated.indexes,{short:1,reading:1,flashcard:2});
 assert.deepEqual(migrated.detailSize,{width:468,height:389});assert.deepEqual(migrated.focusSize,{width:350,height:320});assert.equal('compact' in migrated,false);
 const current=readSettings({...migrated,focusMode:false,compact:true},lengths);assert.equal(current.focusMode,false);
 const invalid=readSettings({fontSize:1,indexes:{short:-1,reading:999},detailSize:{width:NaN,height:999}},lengths);assert.deepEqual(invalid.indexes,{short:0,reading:0,flashcard:0});assert.equal(invalid.fontSize,18);assert.equal(invalid.detailSize,undefined);
});
