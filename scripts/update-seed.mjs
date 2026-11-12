import { execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

// Re-exports seed.zip from this worktree's dev deployment and rewrites seed-schema.json to match. Edit the data in
// the app (or the Convex dashboard) first; everything in the deployment goes into the seed, so keep it synthetic.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const seedPath = join(root, 'seed.zip');
const pendingSeedPath = join(root, 'seed.zip.next');
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'link-up-lyrics-seed-update-'));
const exportedSeedPath = join(temporaryDirectory, 'seed.zip');

try {
	const branch = execFileSync('git', ['branch', '--show-current'], {
		cwd: root,
		encoding: 'utf8'
	}).trim();
	if (!branch || ['main', 'master'].includes(branch)) {
		throw new Error('Run seed:update from a feature branch worktree');
	}
	// The deployment this worktree develops against (selected by scripts/setup-dev-deployment.mjs).
	const deployment = parseEnv(await readFile(join(root, '.env.local'), 'utf8')).CONVEX_DEPLOYMENT;
	if (!deployment?.startsWith('dev:')) {
		throw new Error('.env.local selects no Convex dev deployment; run `. scripts/worktree-setup.sh` first');
	}

	execFileSync('pnpm', ['exec', 'convex', 'export', '--path', exportedSeedPath], {
		cwd: root,
		stdio: 'inherit'
	});

	// Importing an empty table costs about as much as a full one, so they're left out. `convex import
	// --replace-all` still clears tables that are missing from the seed.
	const entries = execFileSync('unzip', ['-l', exportedSeedPath], { encoding: 'utf8' })
		.split('\n')
		.map((line) => line.trim().split(/\s+/))
		.filter((columns) => columns.length === 4 && /^\d+$/.test(columns[0]))
		.map(([size, , , path]) => ({ size: Number(size), path }));
	const emptyTables = entries
		.filter(({ size, path }) => size === 0 && path.endsWith('/documents.jsonl'))
		.map(({ path }) => dirname(path))
		.filter((table) => basename(table) !== '_tables');
	const emptyTableEntries = entries
		.map(({ path }) => path)
		.filter((path) => emptyTables.includes(dirname(path)));
	if (emptyTableEntries.length > 0) {
		execFileSync('zip', ['-q', '-d', exportedSeedPath, ...emptyTableEntries]);
	}

	await copyFile(exportedSeedPath, pendingSeedPath);
	await rename(pendingSeedPath, seedPath);
	execFileSync('pnpm', ['run', '--silent', 'seed:check', '--write'], { cwd: root, stdio: 'inherit' });
	console.log(`Updated seed.zip and seed-schema.json from ${deployment}`);
} finally {
	await rm(temporaryDirectory, { recursive: true, force: true });
	await rm(pendingSeedPath, { force: true });
}
