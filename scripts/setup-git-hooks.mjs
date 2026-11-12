// Points git at githooks/ (the pre-commit seed check). Runs from `pnpm install` (the prepare script).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
if (existsSync(join(root, '.git'))) {
	try {
		execFileSync('git', ['config', 'core.hooksPath', 'githooks'], { cwd: root, stdio: 'ignore' });
	} catch {
		// Not a git checkout after all, like an unpacked archive.
	}
}
