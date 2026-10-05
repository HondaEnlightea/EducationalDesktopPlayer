import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code==='ENOENT')return structuredClone(fallback);throw Error(`保存ファイルを読み込めません: ${path.basename(file)}。元のファイルは変更していません。`);}}
export function writeJson(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify(value,null,2),'utf8');fs.renameSync(temp,file);}
export const modes=['short','reading','flashcard'];
function validateHistory(data){if(data.schemaVersion!==1||!Array.isArray(data.sessions))throw Error('履歴の形式が不正です。元ファイルを確認してください。');for(const s of data.sessions){if(typeof s.id!=='string'||!Number.isFinite(Date.parse(s.startedAt))||!Array.isArray(s.segments)||!Array.isArray(s.events)||(s.endedAt!==null&&!Number.isFinite(Date.parse(s.endedAt))))throw Error('履歴セッションの形式が不正です。元ファイルは変更していません。');for(const seg of s.segments)if(!modes.includes(seg.mode)||!Number.isFinite(seg.start)||!Number.isFinite(seg.end)||seg.end<seg.start)throw Error('履歴の利用区間が不正です。元ファイルは変更していません。');for(const e of s.events)if(!modes.includes(e.mode)||!['view','reveal'].includes(e.type)||typeof e.contentId!=='string'||!Number.isFinite(Date.parse(e.at)))throw Error('履歴イベントの形式が不正です。元ファイルは変更していません。');}}
export class HistoryStore {
 constructor(file,clock=Date.now){this.file=file;this.clock=clock;this.data=readJson(file,{schemaVersion:1,sessions:[]});validateHistory(this.data);this.session=null;this.activeMode=null;this.since=null;
  for(const s of this.data.sessions)if(!s.endedAt){s.endedAt=s.lastSeenAt||s.startedAt;s.endReason='interrupted';}this.save();}
 start(){if(this.session)return;const at=new Date(this.clock()).toISOString();this.session={id:randomUUID(),startedAt:at,endedAt:null,lastSeenAt:at,segments:[],events:[]};this.data.sessions.push(this.session);this.save();}
 accrue(now){if(this.session&&this.activeMode&&this.since!==null&&now>this.since)this.session.segments.push({mode:this.activeMode,start:this.since,end:now});if(this.activeMode)this.since=now;if(this.session)this.session.lastSeenAt=new Date(now).toISOString();}
 setActive(mode){if(mode!==null&&!modes.includes(mode))throw Error('モードが不正です');if(!this.session)this.start();this.accrue(this.clock());this.activeMode=mode;this.since=mode?this.clock():null;this.save();}
 record(type,mode,contentId){if(!['view','reveal'].includes(type)||!modes.includes(mode)||typeof contentId!=='string')throw Error('記録が不正です');if(!this.session)this.start();this.session.events.push({type,mode,contentId,at:new Date(this.clock()).toISOString()});this.checkpoint();}
 checkpoint(){this.accrue(this.clock());this.save();}
 save(){writeJson(this.file,this.data);}
 stop(reason='quit'){if(!this.session)return;this.accrue(this.clock());this.session.endedAt=new Date(this.clock()).toISOString();this.session.endReason=reason;this.activeMode=null;this.since=null;this.session=null;this.save();}
 clear(){const active=this.activeMode;this.data={schemaVersion:1,sessions:[]};this.session=null;this.activeMode=null;this.since=null;this.start();this.setActive(active);}
 snapshot(){const d=structuredClone(this.data);const now=this.clock();if(this.session&&this.activeMode&&this.since!==null&&now>this.since){const s=d.sessions.find(s=>s.id===this.session.id);s.segments.push({mode:this.activeMode,start:this.since,end:now});}return d;}
 summary(day=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo'}).format(new Date(this.clock()))){const d=this.snapshot();const dayStart=Date.parse(day+'T00:00:00+09:00'),dayEnd=dayStart+86400000;const totals={todayMs:0,totalMs:0,modeMs:Object.fromEntries(modes.map(m=>[m,0])),modeViews:Object.fromEntries(modes.map(m=>[m,0])),modeReveals:Object.fromEntries(modes.map(m=>[m,0])),recent:null,recentEvents:[],sessions:[]};
  const events=[];for(const s of d.sessions){let activeMs=0;for(const seg of s.segments){const ms=Math.max(0,seg.end-seg.start);activeMs+=ms;totals.totalMs+=ms;totals.modeMs[seg.mode]+=ms;totals.todayMs+=Math.max(0,Math.min(seg.end,dayEnd)-Math.max(seg.start,dayStart));}for(const e of s.events){(e.type==='view'?totals.modeViews:totals.modeReveals)[e.mode]++;events.push(e);}totals.sessions.push({id:s.id,startedAt:s.startedAt,endedAt:s.endedAt,endReason:s.endReason,activeMs,views:s.events.filter(e=>e.type==='view').length,reveals:s.events.filter(e=>e.type==='reveal').length});}
  totals.recentEvents=events.slice(-30).reverse();totals.recent=events.at(-1)?.at||null;totals.sessions.reverse();return totals;}
}
