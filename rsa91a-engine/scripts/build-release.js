// Packages the runnable app (no tests, no node_modules) into dist/RSA91A-Engine-<version>.zip
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const { version } = require(path.join(root, 'package.json'));
const name = 'RSA91A-Engine-' + version;
const stage = path.join(root, 'dist', name);
fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });

const include = ['index.html', 'css', 'js', 'README.md', 'LICENSE.txt', 'THIRD_PARTY_NOTICES.md'];
for (const item of include) fs.cpSync(path.join(root, item), path.join(stage, item), { recursive: true });

execFileSync('zip', ['-rq', name + '.zip', name], { cwd: path.join(root, 'dist') });
console.log('Built dist/' + name + '.zip');
