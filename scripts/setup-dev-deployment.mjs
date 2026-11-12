import { execFileSync, spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

// Gives the current feature branch its own Convex dev deployment, which expires on its own, and brings it to
// a usable state: functions pushed, seed.zip imported, migrations run, and .env.local holding everything
// `pnpm dev` needs. New deployments get the project's default dev environment variables (`convex env default
// list --type dev`), which are also where the secrets in .env.local come from.
//
// scripts/worktree-setup.sh runs this once per worktree. Running it again is a deliberate reset: the seed
// replaces the deployment's data.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envFile = join(root, '.env.local');
// `pnpm dev` refuses to start until this exists, so it is written only after every step below has succeeded.
const readyMarker = join(root, '.convex-deployment-ready');

function convex(args, { capture = false } = {}) {
	return execFileSync('pnpm', ['exec', 'convex', ...args], {
		cwd: root,
		encoding: 'utf8',
		stdio: ['ignore', capture ? 'pipe' : 'inherit', 'inherit']
	});
}

const branch = execFileSync('git', ['branch', '--show-current'], {
	cwd: root,
	encoding: 'utf8'
}).trim();
if (!branch || ['main', 'master'].includes(branch)) {
	throw new Error(
		'Check out a feature branch first; main and a detached HEAD get no Convex deployment.'
	);
}
// Fully qualified so the CLI can resolve it before .env.local selects anything.
const reference = `home-maintenance-solution:link-up-lyrics-fd369:dev/${branch
	.toLowerCase()
	.replaceAll(/[^a-z0-9-]+/g, '-')
	.slice(0, 60)}`;
await rm(readyMarker, { force: true });
console.log(`Convex deployment for this branch: ${reference}`);

const selection = spawnSync('pnpm', ['exec', 'convex', 'deployment', 'select', reference], {
	cwd: root,
	encoding: 'utf8'
});
if (selection.status === 0) {
	process.stdout.write(selection.stdout);
} else if (/not found/i.test(selection.stderr + selection.stdout)) {
	convex([
		'deployment',
		'create',
		reference,
		'--type',
		'dev',
		'--select',
		'--expiration',
		'in 14 days'
	]);
} else {
	process.stderr.write(selection.stderr + selection.stdout);
	process.exit(selection.status ?? 1);
}

convex(['dev', '--once']);

// The seed lands after the push so its indexes are written along with the documents. Document IDs encode their
// table's number, so the import keeps the seed's numbering; a table added to the schema after the seed was
// exported gets a number from the push that may belong to a seed table, so those tables are listed in the
// import as empty, under numbers past the seed's.
console.log('Importing seed.zip...');
const temporaryDirectory = await mkdtemp(join(tmpdir(), 'link-up-lyrics-seed-'));
try {
	const seedPath = join(temporaryDirectory, 'seed.zip');
	await copyFile(join(root, 'seed.zip'), seedPath);
	const seedTables = execFileSync('unzip', ['-p', seedPath, '_tables/documents.jsonl'], {
		encoding: 'utf8'
	})
		.trim()
		.split('\n')
		.map((line) => JSON.parse(line));
	const seedTableNames = new Set(seedTables.map((table) => table.name));
	const missingTables = convex(['data'], { capture: true })
		.trim()
		.split('\n')
		.filter((name) => name && !seedTableNames.has(name));
	if (missingTables.length > 0) {
		console.log(`Adding tables missing from the seed: ${missingTables.join(', ')}`);
		let nextTableNumber = Math.max(...seedTables.map((table) => table.id)) + 1;
		const tableList = [
			...seedTables,
			...missingTables.map((name) => ({ name, id: nextTableNumber++ }))
		];
		await mkdir(join(temporaryDirectory, '_tables'));
		await writeFile(
			join(temporaryDirectory, '_tables/documents.jsonl'),
			tableList.map((table) => JSON.stringify(table)).join('\n') + '\n'
		);
		for (const name of missingTables) {
			await mkdir(join(temporaryDirectory, name));
			await writeFile(join(temporaryDirectory, name, 'documents.jsonl'), '');
		}
		execFileSync(
			'zip',
			[
				'-q',
				seedPath,
				'_tables/documents.jsonl',
				...missingTables.map((name) => `${name}/documents.jsonl`)
			],
			{ cwd: temporaryDirectory }
		);
	}
	convex(['import', '--replace-all', '-y', seedPath]);
} finally {
	await rm(temporaryDirectory, { recursive: true, force: true });
}

convex(['run', 'init']);

// The secrets the frontend and `pnpm dev` need, from the deployment's environment (the project's defaults), so
// there is one place to change them. The public Clerk key is committed in .env.development.
let environment = await readFile(envFile, 'utf8');
for (const name of ['CLERK_SECRET_KEY', 'WORKTREE_PROXY_SECRET']) {
	const value = convex(['env', 'get', name], { capture: true }).trim();
	if (!value)
		throw new Error(`${name} isn't set; add it with \`convex env default set --type dev\``);
	const line = `${name}=${value}`;
	const pattern = new RegExp(`^${name}=.*$`, 'm');
	environment = pattern.test(environment)
		? environment.replace(pattern, line)
		: `${environment.trimEnd()}\n${line}\n`;
}
await writeFile(envFile, environment, { mode: 0o600 });

await writeFile(readyMarker, `${reference}\n`);
console.log(`\n${reference} is ready at ${parseEnv(environment).PUBLIC_CONVEX_URL}`);
console.log('Run `pnpm dev`, then `pnpm dev sign-in` for a sign-in link.');
