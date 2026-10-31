import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

if (process.platform !== 'darwin') throw new Error('iOS simulator builds require macOS with Xcode.');
const config = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
const derived = path.resolve('.cache', 'ios-builds');
const destination = path.resolve('.cache', 'apps', 'app-simulator.app');
const args = [
  '-project', 'ios/App/App.xcodeproj', '-scheme', 'App', '-configuration', 'Debug',
  '-sdk', 'iphonesimulator', '-destination', 'generic/platform=iOS Simulator',
  '-derivedDataPath', derived, 'CODE_SIGNING_ALLOWED=NO', 'build',
];
const result = spawnSync('xcodebuild', args, { cwd: process.cwd(), stdio: 'inherit', windowsHide: true });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const builtApp = path.join(derived, 'Build', 'Products', 'Debug-iphonesimulator', 'App.app');
if (!existsSync(path.join(builtApp, 'Info.plist')) || !existsSync(path.join(builtApp, 'public', 'allgo-build.json'))) throw new Error('Xcode completed without the expected simulator app bundle and AllGo metadata.');
const cacheRoot = path.resolve('.cache');
if (!destination.startsWith(`${cacheRoot}${path.sep}`)) throw new Error('Unexpected simulator artifact path.');
rmSync(destination, { recursive: true, force: true });
mkdirSync(path.dirname(destination), { recursive: true });
cpSync(builtApp, destination, { recursive: true });
console.log(`Built ${config.appName} (${config.appId}) simulator app at ${destination}`);

