// Build process only: resource editing can briefly race Windows executable scanning.
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const resources = ['release', 'release-next'].map(folder => path.join(root, folder, 'win-unpacked', 'Educational Desktop Player.exe').toLowerCase());
const writeFile = fs.writeFile;
fs.writeFile = async function(file, ...arguments_) {
 const resource = typeof file === 'string' && resources.includes(path.resolve(file).toLowerCase());
 for (let attempt = 0; ; attempt++) {
  try { return await writeFile.call(fs, file, ...arguments_); }
  catch (error) {
   if (!resource || error.code !== 'EBUSY' || attempt >= 20) throw error;
   if (attempt === 0) process.stderr.write('Windows temporarily locked the executable; retrying resource write.\n');
   await new Promise(resolve => setTimeout(resolve, Math.min(300 + attempt * 100, 1000)));
  }
 }
};
