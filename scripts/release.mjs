// Builds a production release and packs it for the VPS.
//
//   node scripts/release.mjs                 -> release/leek-ops-<sha>.tgz
//   node scripts/release.mjs --offline       -> same, deliberately without the online settings
//   node scripts/release.mjs --allow-dirty   -> pack even with uncommitted changes to tracked files
//
// Reads build-time settings from .env.production (git-ignored): VITE_DEBUG_GAME=false and
// VITE_ONLINE_URL (normally the same-origin /online). Refuses to pack when the working tree has
// uncommitted changes, the unit tests fail, the online URL is missing (unless --offline), or the
// bundle still contains debug hooks or anything that looks like a secret key. The release also
// carries the online backend (server/) and its SQL migrations, which vps-install.sh applies.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Strings that only appear with a server-side credential; a bundle holding one hands it to every
 * player. The backend needs no key in the browser at all, so none of these has any business there.
 */
export const SECRET_MARKERS = ['service_role', 'sb_secret_', 'AUTHENTICATOR_PASSWORD', 'POSTGRES_PASSWORD'];

/** The secret markers found in the built JS, as "<chunk>: <marker>". */
export function secretsInChunks(chunks) {
  return chunks.flatMap(({ name, code }) =>
    SECRET_MARKERS.filter(marker => code.includes(marker)).map(marker => `${name}: ${marker}`));
}

const FLAGS = ['--offline', '--allow-dirty'];

function release(argv) {
  // An unknown flag is refused, so a typo such as --ofline cannot silently drop a check.
  const unknown = argv.filter(arg => !FLAGS.includes(arg));
  if (unknown.length) throw new Error(`unknown option(s): ${unknown.join(' ')} (known: ${FLAGS.join(' ')})`);
  const offline = argv.includes('--offline');
  const allowDirty = argv.includes('--allow-dirty');

  const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const run = (command, args) => execFileSync(command, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
  const read = path => readFileSync(join(root, path), 'utf8');

  const env = Object.fromEntries(
    (existsSync(join(root, '.env.production')) ? read('.env.production') : '')
      .split(/\r?\n/).filter(line => line.includes('=') && !line.startsWith('#'))
      .map(line => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]),
  );
  if (env.VITE_DEBUG_GAME !== 'false') throw new Error('.env.production must set VITE_DEBUG_GAME=false');
  const online = Boolean(env.VITE_ONLINE_URL);
  // A release without it builds fine and only shows up as a game whose leaderboard and cloud
  // saves never connect, so leaving it out has to be said out loud.
  if (!online && !offline) throw new Error('.env.production must set VITE_ONLINE_URL (pass --offline to release without it)');

  const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root }).toString().trim();
  // The release is labelled with HEAD, so uncommitted edits would ship under a commit that does
  // not contain them and a rollback to that commit would not reproduce it.
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root }).toString().trim();
  if (dirty && !allowDirty) throw new Error(`working tree has uncommitted changes (pass --allow-dirty to pack anyway):\n${dirty}`);
  if (dirty) console.warn('warning: working tree has uncommitted changes; the release is labelled with HEAD');

  try {
    run('npm', ['test']);
  } catch {
    throw new Error('npm test failed; not packing a release');
  }

  run('npm', ['run', 'build', '--', '--mode', 'production']);

  const assets = join(root, 'dist', 'assets');
  // The entry comes from index.html: lazily loaded libraries get index-* chunk names of their own.
  const entry = readFileSync(join(root, 'dist', 'index.html'), 'utf8').match(/assets\/(index-[^"]+\.js)/)?.[1];
  if (!entry) throw new Error('entry script not found in dist/index.html');
  const entryCode = readFileSync(join(assets, entry), 'utf8');
  // The checks scan every chunk, so nothing hides in a lazily loaded one.
  const chunks = readdirSync(assets).filter(name => name.endsWith('.js'))
    .map(name => ({ name, code: readFileSync(join(assets, name), 'utf8') }));
  const bundle = chunks.map(chunk => chunk.code).join('\n');
  // The debug build registers B / C / L cheat keys (boss, chest, level-up). Quoted, so menu keys
  // such as "keydown-LEFT" do not match.
  for (const key of ['B', 'C', 'L']) {
    if (bundle.includes(`"keydown-${key}"`)) throw new Error(`debug key ${key} found in the production bundle`);
  }
  const secrets = secretsInChunks(chunks);
  if (secrets.length) throw new Error(`secret key material found in the production bundle:\n${secrets.join('\n')}`);
  if (online && !bundle.includes(`"${env.VITE_ONLINE_URL}"`)) throw new Error('online URL missing from the bundle');

  // A broken nginx.conf only shows up as a restart loop on the server; catch it here instead.
  try {
    execFileSync('docker', ['run', '--rm', '-v', `${join(root, 'nginx.conf')}:/etc/nginx/conf.d/default.conf:ro`, 'nginx:alpine', 'nginx', '-t'], { stdio: 'pipe' });
  } catch (error) {
    if (error.code === 'ENOENT') console.warn('warning: docker not found; nginx.conf was not validated');
    else throw new Error(`nginx.conf is invalid:\n${error.stderr}`);
  }

  const manifest = {
    release: 'LEEK OPS',
    version: JSON.parse(read('package.json')).version,
    commit: sha,
    builtUtc: new Date().toISOString(),
    entry,
    sha256: createHash('sha256').update(entryCode).digest('hex'),
    debug: false,
    online,
  };
  writeFileSync(join(root, 'dist', 'release.json'), JSON.stringify(manifest, null, 2) + '\n');

  const stage = join(root, 'release', `leek-ops-${sha}`);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  cpSync(join(root, 'dist'), join(stage, 'dist'), { recursive: true });
  // Server-side files are written with LF endings whatever the Windows checkout did to them:
  // a CRLF shell script fails on Linux with "set: Illegal option -".
  for (const file of ['Dockerfile.prebuilt', 'docker-compose.vps.yml', 'nginx.conf', 'scripts/vps-install.sh'])
    writeFileSync(join(stage, file.split('/').pop()), read(file).replace(/\r\n/g, '\n'));
  // The online backend and its migrations travel with the game, so one deploy updates both.
  const serverFiles = ['server/docker-compose.online.yml', 'server/migrate.sh', 'server/init/00-roles.sh',
    ...readdirSync(join(root, 'supabase', 'migrations')).filter(name => name.endsWith('.sql')).map(name => `supabase/migrations/${name}`)];
  for (const file of serverFiles) {
    const target = join(stage, file.replace(/^supabase\//, ''));
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, read(file).replace(/\r\n/g, '\n'));
  }
  // Relative paths only: GNU tar reads "D:/..." as a remote host.
  const archive = `release/leek-ops-${sha}.tgz`;
  run('tar', ['-czf', archive, '-C', `release/leek-ops-${sha}`, '.']);
  rmSync(stage, { recursive: true, force: true });
  console.log(JSON.stringify({ ...manifest, archive }, null, 2));
}

// Runs only as a script, so the checks above can be imported and tested without packing. Paths
// are compared case-insensitively on Windows, where "c:\" and "C:\" name the same file; a
// mismatch here would make the script exit silently without releasing anything.
const invoked = process.argv[1] && existsSync(process.argv[1]) ? realpathSync(process.argv[1]) : '';
const same = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
if (same(invoked, fileURLToPath(import.meta.url))) release(process.argv.slice(2));
