// The tables, fields and validators seed.zip was exported against. A schema change means the seed may no longer
// import, so the pre-commit hook fails until `pnpm seed:update` re-exports the seed and rewrites this snapshot.
//
// Usage: tsx scripts/seed-schema.ts [--write]
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import schema from '../src/convex/schema';

const snapshotPath = join(dirname(fileURLToPath(import.meta.url)), '../seed-schema.json');

const current: Record<string, unknown> = Object.fromEntries(
	Object.entries(schema.tables)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([name, table]) => [name, table.validator.json])
);

if (process.argv.includes('--write')) {
	await writeFile(snapshotPath, JSON.stringify(current, null, 2) + '\n');
	process.exit(0);
}

const saved: Record<string, unknown> = JSON.parse(await readFile(snapshotPath, 'utf8'));
const changed = [...new Set([...Object.keys(saved), ...Object.keys(current)])]
	.filter((name) => JSON.stringify(saved[name]) !== JSON.stringify(current[name]))
	.sort();

if (changed.length > 0) {
	console.error(`
✖ Commit blocked: the Convex schema changed since seed.zip was exported.

  Changed tables: ${changed.join(', ')}

  New worktrees import seed.zip, so it has to match src/convex/schema.ts.
  Run any migrations on this worktree's dev deployment, then:

      pnpm seed:update

  That re-exports seed.zip and rewrites seed-schema.json.
  Stage both files and commit again.
`);
	process.exit(1);
}
