// Prints a five-minute sign-in link for the local dev site, so an agent (or you) can sign in without Google.
// Usage: node scripts/sign-in.mjs [email] [success path]
// Signs in as Tyler unless given someone else's email; whoever it is must have signed in with Google before (sign-in
// tokens need an email on the account, and Clerk's dev instance can't add one: it's Google only). The link opens
// /sign-in-token/<token>, which signs in with Clerk and goes on to the success path. Set SIGN_IN_ORIGIN when the
// dev server isn't on http://localhost:5173. Like Jairus's scripts/sign-in-as-system.ts.
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [email = 'tylerpetrov16@gmail.com', successPath = '/'] = process.argv.slice(2);
const origin = process.env.SIGN_IN_ORIGIN ?? 'http://localhost:5173';

const envFile = join(dirname(fileURLToPath(import.meta.url)), '../.env.local');
if (existsSync(envFile)) process.loadEnvFile(envFile);
const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) fail('CLERK_SECRET_KEY is missing from .env.local');
// Only Clerk's development instance: a link into production would sign in as a real person.
if (!secretKey.startsWith('sk_test_')) fail('CLERK_SECRET_KEY is not a development (sk_test_) key');
if (!successPath.startsWith('/') || successPath.startsWith('//'))
	fail('The success path must start with /');

const [user] = await clerk('GET', `/users?email_address=${encodeURIComponent(email)}`);
if (!user) fail(`No one has signed in as ${email} yet`);
const { token } = await clerk('POST', '/sign_in_tokens', {
	user_id: user.id,
	expires_in_seconds: 5 * 60
});

const url = new URL(`/sign-in-token/${token}`, origin);
url.searchParams.set('url', successPath);
console.log(`Sign-in link for ${email} (expires in 5 minutes):\n${url}`);

/** Clerk's Backend API, with the dev instance's secret key. */
async function clerk(method, path, body) {
	const response = await fetch(`https://api.clerk.com/v1${path}`, {
		method,
		headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
		body: body && JSON.stringify(body)
	});
	const result = await response.json();
	if (!response.ok)
		fail(`Clerk ${method} ${path} failed: ${JSON.stringify(result.errors ?? result)}`);
	return result;
}

/** @param {string} message */
function fail(message) {
	console.error(message);
	process.exit(1);
}
