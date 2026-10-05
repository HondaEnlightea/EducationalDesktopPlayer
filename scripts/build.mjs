import {build} from 'esbuild';
import fs from 'node:fs';
fs.mkdirSync('dist',{recursive:true});
await Promise.all([
 build({entryPoints:['src/main/index.ts'],bundle:true,platform:'node',format:'cjs',external:['electron'],outfile:'dist/main.cjs',target:'node22'}),
 build({entryPoints:['src/main/preload.ts'],bundle:true,platform:'node',format:'cjs',external:['electron'],outfile:'dist/preload.cjs',target:'node22'}),
 build({entryPoints:['src/renderer/App.tsx'],bundle:true,platform:'browser',format:'iife',outfile:'dist/renderer.js',target:'chrome130',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}})
]);
fs.copyFileSync('src/renderer/index.html','dist/index.html');
console.log('Educational Desktop Player build complete');
