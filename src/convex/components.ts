import { HOUR, MINUTE, RateLimiter } from '@convex-dev/rate-limiter';
import { Presence } from '@convex-dev/presence';
import { components } from './_generated/api';

/* Transactional, sharded limits. The live view is public by design, so it's the main thing to protect. §3. */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
	createSong: { kind: 'token bucket', rate: 60, period: HOUR, capacity: 20 },
	invite: { kind: 'token bucket', rate: 30, period: HOUR, capacity: 10 },
	liveHeartbeat: { kind: 'token bucket', rate: 30, period: MINUTE, capacity: 10, shards: 4 }
});

/* Who's watching a live session right now: a count, never a roster. §15. */
export const presence = new Presence(components.presence);
