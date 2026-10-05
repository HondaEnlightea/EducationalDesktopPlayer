import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadContent} from '../src/core/content.mjs';
import {markerRuns} from '../src/core/markers.mjs';
test('200教材の対訳・解説・台帳・重複・既存IDを監査',()=>{
 const content=loadContent('content');
 const catalog=JSON.parse(fs.readFileSync('content/curriculum.json','utf8'));
 assert.equal(catalog.items.length,200);
 const texts=new Set();
 for(const mode of ['short','reading']){
  assert.equal(content[mode].length,100);
  assert.deepEqual(content[mode].slice(0,2).map(item=>item.id),[mode+'-001',mode+'-002']);
  const entries=catalog.items.filter(item=>item.mode===mode);
  assert.deepEqual(entries.map(entry=>entry.id),content[mode].map(item=>item.id));
  assert.equal(new Set(entries.filter(entry=>!entry.retained).map(entry=>entry.topic)).size,14);
  for(const item of content[mode]){
   const text=item.sentences.map(sentence=>sentence.english).join(' ');
   assert.ok(!texts.has(text),'duplicate '+item.id);texts.add(text);
   for(const sentence of item.sentences){
    assert.ok(sentence.english.trim().length>10);
    assert.match(sentence.japanese,/[ぁ-んァ-ヶ一-龠]/);
    const runs=markerRuns(sentence.english,sentence.markers);
    assert.equal(runs.map(run=>run.text).join(''),sentence.english);
    assert.equal(runs.filter(run=>run.marker).length,sentence.markers.length,item.id+' unresolved marker');
    for(const marker of sentence.markers)assert.ok(marker.explanation?.trim().length>10);
   }
   assert.ok(item.sentences.some(sentence=>sentence.markers.length),item.id+' missing explanation');
   if(mode==='reading' && !['reading-001','reading-002'].includes(item.id))assert.ok(item.note?.length>15);
  }
 }
});
