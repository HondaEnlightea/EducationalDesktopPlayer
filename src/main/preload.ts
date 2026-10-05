import {contextBridge,ipcRenderer} from 'electron';
import type {Command,State} from '../shared/types';
contextBridge.exposeInMainWorld('desktopPlayer',{
 getState:()=>ipcRenderer.invoke('desktop-player:get'),
 command:(command:Command)=>ipcRenderer.invoke('desktop-player:command',command),
 onState:(callback:(state:State)=>void)=>{const listener=(_event:unknown,state:State)=>callback(state);ipcRenderer.on('desktop-player:state',listener);return ()=>ipcRenderer.removeListener('desktop-player:state',listener);}
});
