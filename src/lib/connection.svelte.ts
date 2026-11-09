import { useConvexClient } from 'convex-svelte';
import { on } from 'svelte/events';

const PROBE_AFTER_MS = 3_000;
const BASE_PROBE_TIMEOUT_MS = 3_000;
const MAX_PROBE_TIMEOUT_MS = 60_000;
/** Forced closes in a row that keep the base probe timeout before it starts doubling. */
const BASE_TIMEOUT_CLOSES = 3;
const HEALTHY_AFTER_MS = 30_000;
/** No status code, which Convex treats as an ordinary close instead of logging an error. */
const CLOSE_NO_STATUS = 1005;

/*
 * The WebSocket Convex should use, from Jairus. Convex only notices a silently dropped socket after 60s without
 * a server message (get-convex/convex-backend#562), and a dropped cellular connection never fires `close`, so a
 * singer's phone could show old words for a minute. This socket asks the server a tiny question (`probe`) when
 * something it sent has gone 3s without any server message. If nothing at all comes back within 3s of the probe
 * going out, it tells Convex the socket closed, so Convex reconnects (and the Reconnecting chip shows) in seconds.
 *
 * - Any server message counts as proof of life, so slow functions never trigger a reconnect.
 * - The probe timeout stays at 3s for the first 3 forced closes in a row, then doubles after each one. It resets
 *   once the new socket has stayed up 30s and answers a probe within 3s, so a slow link can't loop.
 * - The close is reported to Convex right away instead of waiting for the browser, which can't finish a close
 *   handshake over a dead connection. Events the abandoned socket fires later are swallowed.
 */
export function createWatchedWebSocket(probe: () => Promise<unknown>) {
	let forcedCloses = 0;
	const probeTimeoutMs = () =>
		Math.min(
			BASE_PROBE_TIMEOUT_MS * 2 ** Math.max(0, forcedCloses - BASE_TIMEOUT_CLOSES + 1),
			MAX_PROBE_TIMEOUT_MS
		);

	return class WatchedWebSocket extends WebSocket {
		#lastReceivedAt = Date.now();
		#waitingSince: number | undefined;
		#probeStartedAt: number | undefined;
		#probeSentAt: number | undefined;
		#unresponsiveClose: CloseEvent | undefined;

		constructor(url: string | URL, protocols?: string | string[]) {
			super(url, protocols);

			// Registered before Convex sets its handlers, so it runs first.
			const swallowAfterAbandon = (event: Event) => {
				if (this.#unresponsiveClose && event !== this.#unresponsiveClose) {
					event.stopImmediatePropagation();
				}
			};
			on(this, 'error', swallowAfterAbandon);
			on(this, 'close', swallowAfterAbandon);
			on(this, 'message', (event) => {
				swallowAfterAbandon(event);
				this.#lastReceivedAt = Date.now();
				this.#waitingSince = undefined;
			});
			on(
				this,
				'open',
				() => {
					if (forcedCloses > 0)
						setTimeout(() => this.#resetTimeoutIfResponsive(), HEALTHY_AFTER_MS);
				},
				{ once: true }
			);
		}

		/** Only a probe's own round trip counts: on a slow link other replies can arrive late and look quick. */
		#resetTimeoutIfResponsive() {
			if (this.#isAbandoned()) return;
			const startedAt = Date.now();
			void Promise.resolve()
				.then(probe)
				.then(
					() => {
						if (!this.#isAbandoned() && Date.now() - startedAt <= BASE_PROBE_TIMEOUT_MS) {
							forcedCloses = 0;
						}
					},
					() => undefined
				);
		}

		override send(data: Parameters<WebSocket['send']>[0]) {
			super.send(data);
			const now = Date.now();
			if (this.#probeStartedAt !== undefined) this.#probeSentAt ??= now;
			if (this.#waitingSince !== undefined) return;
			this.#waitingSince = now;
			this.#scheduleProbe(now);
		}

		#scheduleProbe(waitingSince: number) {
			setTimeout(
				() => {
					if (this.#waitingSince === waitingSince) void this.#probe();
				},
				Math.max(0, waitingSince + PROBE_AFTER_MS - Date.now())
			);
		}

		#isAbandoned() {
			return this.readyState !== WebSocket.OPEN || this.#unresponsiveClose !== undefined;
		}

		async #probe() {
			if (this.#isAbandoned() || this.#probeStartedAt !== undefined) return;

			const timeoutMs = probeTimeoutMs();
			const probeStartedAt = Date.now();
			this.#probeStartedAt = probeStartedAt;
			this.#probeSentAt = undefined;
			// A failed probe still falls through to the silence check below.
			void Promise.resolve()
				.then(probe)
				.catch(() => undefined);

			try {
				// Convex holds messages while it refreshes auth, so the timeout runs from when the probe goes out.
				while (this.#probeSentAt === undefined || Date.now() - this.#probeSentAt < timeoutMs) {
					const deadline = (this.#probeSentAt ?? Date.now()) + timeoutMs;
					await new Promise((resolve) => setTimeout(resolve, deadline - Date.now()));
					if (this.#isAbandoned()) return;
					if (this.#lastReceivedAt >= probeStartedAt) {
						// Alive, but something sent after that message may still be unanswered.
						if (this.#waitingSince !== undefined) this.#scheduleProbe(this.#waitingSince);
						return;
					}
				}
			} finally {
				this.#probeStartedAt = undefined;
			}

			forcedCloses += 1;
			this.#unresponsiveClose = new CloseEvent('close', {
				code: CLOSE_NO_STATUS,
				reason: 'unresponsive'
			});
			this.close();
			this.dispatchEvent(this.#unresponsiveClose);
		}
	};
}

/** How long the connection has to stay down before it's worth saying, so a blip never flashes a chip. */
const GRACE_MS = 2_000;

/**
 * Whether the Convex connection dropped after working: while it's down, queries go stale and mutations wait.
 * Convex reconnects and resubscribes by itself, so this only says so. Call while a component initialises.
 */
export function useConnection() {
	const client = useConvexClient();
	let reconnecting = $state(false);

	$effect(() => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		const unsubscribe = client.subscribeToConnectionState((state) => {
			if (state.isWebSocketConnected || !state.hasEverConnected) {
				clearTimeout(timer);
				timer = undefined;
				reconnecting = false;
			} else {
				timer ??= setTimeout(() => (reconnecting = true), GRACE_MS);
			}
		});
		return () => {
			unsubscribe();
			clearTimeout(timer);
		};
	});

	return {
		get reconnecting() {
			return reconnecting;
		}
	};
}
