export type Mode='short'|'reading'|'flashcard';
export type Page='learn'|'settings'|'history';
export type MarkerKind='term'|'connector'|'reference';
export interface Marker {phrase:string;kind:MarkerKind;explanation?:string;occurrence?:number}
export interface Sentence {english:string;japanese:string;markers:Marker[]}
export interface TextItem {id:string;category:string;sentences:Sentence[];note?:string}
export interface Block {kind:'text'|'math';text:string}
export interface CardItem {id:string;category:string;front:{blocks:Block[]};back:{blocks:Block[]};note?:string;tags?:string[]}
export interface Content {short:TextItem[];reading:TextItem[];flashcard:CardItem[]}
export interface Settings {alwaysOnTop:boolean;focusMode:boolean;fontSize:number;mode:Mode;indexes:Record<Mode,number>;bounds?:{x:number;y:number;width:number;height:number};detailSize?:{width:number;height:number};focusSize?:{width:number;height:number}}
export interface Summary {todayMs:number;totalMs:number;modeMs:Record<Mode,number>;modeViews:Record<Mode,number>;modeReveals:Record<Mode,number>;recent:string|null;recentEvents:{type:string;mode:Mode;contentId:string;at:string}[];sessions:{id:string;startedAt:string;endedAt:string|null;endReason?:string;activeMs:number;views:number;reveals:number}[]}
export interface State {mode:Mode;page:Page;index:number;revealed:boolean;paused:boolean;hidden:boolean;settings:Settings;content:Content;summary:Summary;dataDirectory:string}
export type Command={type:'navigate';step:1|-1}|{type:'mode';mode:Mode}|{type:'reveal'}|{type:'page';page:Page}|{type:'pause'}|{type:'hide'}|{type:'focus'}|{type:'setting';key:'alwaysOnTop'|'fontSize';value:boolean|number}|{type:'clearHistory'};
export interface DesktopPlayerApi {getState():Promise<State>;command(command:Command):Promise<State>;onState(callback:(state:State)=>void):()=>void}
declare global {interface Window {desktopPlayer:DesktopPlayerApi}}
