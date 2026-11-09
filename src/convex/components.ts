import { HOUR, MINUTE, RateLimiter } from '@convex-dev/rate-limiter';
import { Presence } from '@convex-dev/presence';
import { components } from './_generated/api';

/* Transactional, sharded limits. The live view is public by design, so it's the main thing to protect. §3. */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
	createSong: { kind: 'token bucket', rate: 60, period: HOUR, capacity: 20 },
	invite: { kind: 'token bucket', rate: 30, period: HOUR, capacity: 10 },
	/* Per tab. A tab beats every 10s. */
	liveHeartbeat: { kind: 'token bucket', rate: 30, period: MINUTE, capacity: 10 },
	/* Per room, so made-up tab ids can't flood one: a full room of 500 beats 3,000 times a minute. */
	liveRoomHeartbeat: {
		kind: 'token bucket',
		rate: 6000,
		period: MINUTE,
		capacity: 1000,
		shards: 10
	}
});

/* Who's watching a live session right now: a count, never a roster. §15. */
export const presence = new Presence(components.presence);
