// Builds a production release and packs it for the VPS.
//
//   node scripts/release.mjs            -> release/leek-ops-<sha>.tgz
//
// Reads build-time settings from .env.production (git-ignored): VITE_DEBUG_GAME=false and the
// public Supabase URL / publishable key. Refuses to pack a build that still contains debug
// hooks or, when Supabase is configured, one that lacks the online adapter's settings.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const run = (command, args) => execFileSync(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
const read = path => readFileSync(join(root, path), 'utf8');

const env = Object.fromEntries(
  (existsSync(join(root, '.env.production')) ? read('.env.production') : '')
    .split(/\r?\n/).filter(line => line.includes('=') && !line.startsWith('#'))
    .map(line => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]),
);
if (env.VITE_DEBUG_GAME !== 'false') throw new Error('.env.production must set VITE_DEBUG_GAME=false');

const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root }).toString().trim();
const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root }).toString().trim();
if (dirty) console.warn('warning: working tree has uncommitted changes; the release is labelled with HEAD');

run('npm', ['run', 'build', '--', '--mode', 'production']);

const assets = join(root, 'dist', 'assets');
// The entry comes from index.html: lazily loaded libraries get index-* chunk names of their own.
const entry = readFileSync(join(root, 'dist', 'index.html'), 'utf8').match(/assets\/(index-[^"]+\.js)/)?.[1];
if (!entry) throw new Error('entry script not found in dist/index.html');
const entryCode = readFileSync(join(assets, entry), 'utf8');
// The checks scan every chunk, so nothing hides in a lazily loaded one.
const bundle = readdirSync(assets).filter(name => name.endsWith('.js'))
  .map(name => readFileSync(join(assets, name), 'utf8')).join('\n');
// The debug build registers B / C / L cheat keys (boss, chest, level-up). Quoted, so menu keys
// such as "keydown-LEFT" do not match.
for (const key of ['B', 'C', 'L']) {
  if (bundle.includes(`"keydown-${key}"`)) throw new Error(`debug key ${key} found in the production bundle`);
}
const online = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY);
if (online && !bundle.includes(env.VITE_SUPABASE_URL)) throw new Error('Supabase URL missing from the bundle');

// A broken nginx.conf only shows up as a restart loop on the server; catch it here instead.
try {
  execFileSync('docker', ['run', '--rm', '-v', `${join(root, 'nginx.conf')}:/etc/nginx/conf.d/default.conf:ro`, 'nginx:alpine', 'nginx', '-t'], { stdio: 'pipe' });
} catch (error) {
  if (error.code === 'ENOENT') console.warn('warning: docker not found; nginx.conf was not validated');
  else throw new Error(`nginx.conf is invalid:\n${error.stderr}`);
}

const release = {
  release: 'LEEK OPS',
  version: JSON.parse(read('package.json')).version,
  commit: sha,
  builtUtc: new Date().toISOString(),
  entry,
  sha256: createHash('sha256').update(entryCode).digest('hex'),
  debug: false,
  online,
};
writeFileSync(join(root, 'dist', 'release.json'), JSON.stringify(release, null, 2) + '\n');

const stage = join(root, 'release', `leek-ops-${sha}`);
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });
cpSync(join(root, 'dist'), join(stage, 'dist'), { recursive: true });
// Server-side files are written with LF endings whatever the Windows checkout did to them:
// a CRLF shell script fails on Linux with "set: Illegal option -".
for (const file of ['Dockerfile.prebuilt', 'docker-compose.vps.yml', 'nginx.conf', 'scripts/vps-install.sh'])
  writeFileSync(join(stage, file.split('/').pop()), read(file).replace(/\r\n/g, '\n'));
// Relative paths only: GNU tar reads "D:/..." as a remote host.
const archive = `release/leek-ops-${sha}.tgz`;
run('tar', ['-czf', archive, '-C', `release/leek-ops-${sha}`, '.']);
rmSync(stage, { recursive: true, force: true });
console.log(JSON.stringify({ ...release, archive }, null, 2));
