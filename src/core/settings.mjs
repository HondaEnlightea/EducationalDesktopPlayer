const modes=['short','reading','flashcard'];
function size(value){
 if(!value||!Number.isFinite(value.width)||!Number.isFinite(value.height))return undefined;
 return {width:Math.max(300,Math.round(value.width)),height:Math.max(240,Math.round(value.height))};
}
export function readSettings(raw,lengths){
 raw=raw&&typeof raw==='object'?raw:{};
 const indexes={short:0,reading:0,flashcard:0};
 for(const mode of modes)if(Number.isInteger(raw.indexes?.[mode])&&raw.indexes[mode]>=0&&raw.indexes[mode]<lengths[mode])indexes[mode]=raw.indexes[mode];
 return {
  alwaysOnTop:typeof raw.alwaysOnTop==='boolean'?raw.alwaysOnTop:true,
  focusMode:typeof raw.focusMode==='boolean'?raw.focusMode:raw.compact===true,
  fontSize:[16,18,20,22].includes(raw.fontSize)?raw.fontSize:18,
  mode:modes.includes(raw.mode)?raw.mode:'short',indexes,
  detailSize:size(raw.detailSize)||size(raw.normalSize),
  focusSize:size(raw.focusSize)||(raw.compact===true?size(raw.bounds):undefined)
 };
}
