import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

if (process.platform !== 'darwin') throw new Error('iOS artifact inspection requires macOS with plutil.');
const config = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
const artifact = path.resolve('.cache', 'apps', 'app-simulator.app');
const plistPath = path.join(artifact, 'Info.plist');
if (!existsSync(path.join(artifact, 'public', 'allgo-build.json'))) throw new Error('Expected simulator app bundle and embedded AllGo metadata.');
const readPlist = key => execFileSync('plutil', ['-extract', key, 'raw', '-o', '-', plistPath], { encoding: 'utf8' }).trim();
if (readPlist('CFBundleIdentifier') !== config.appId) throw new Error('Built iOS bundle identifier does not match this app workspace.');
if (readPlist('CFBundleDisplayName') !== config.appName) throw new Error('Built iOS display name does not match this app workspace.');
console.log(`Verified ${config.appName} (${config.appId}) iOS simulator artifact.`);
