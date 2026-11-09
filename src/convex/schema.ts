import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import {
	characterValidator,
	convexTagValidator,
	discriminatedUnionItem,
	epoch
} from './validators';

/*
 * The whole plan's schema (v3 + Tyler's brief), so feature work rarely edits it. New or removed fields land
 * as v.optional first: Convex validates existing documents against the schema. Ordered children use
 * fractional `order` numbers (#lib/order), so an insert anywhere writes exactly one row.
 */
export default defineSchema({
	/* Mirror of the Clerk user, upserted from the auth identity (model/user.ts). Clerk stays the source of truth. */
	User: defineTable({
		clerkUserId: v.string(),
		name: v.string(),
		/* Matched against JamSessionMember.invitedEmail when someone is invited before they have an account. */
		email: v.optional(v.string()),
		imageUrl: v.optional(v.string()),
		/* Billing, mirrored from Clerk Billing. Server checks read these, never the client's token. §13. */
		planTag: convexTagValidator('SubscriptionPlans'),
		paymentStatusTag: convexTagValidator('PaymentStatuses'),
		pastDueSinceEpoch: v.optional(epoch()),
		graceEndsEpoch: v.optional(epoch()), // pinned at failure, not recomputed
		paymentFailureReason: v.optional(v.string()),
		/* Comped access, granted by us and independent of Clerk. §13.2. */
		compedUntilEpoch: v.optional(epoch()),
		compReason: v.optional(v.string()),
		ccliLicenseNumber: v.optional(v.string())
	})
		.index('by_clerkUserId', ['clerkUserId'])
		.index('by_email', ['email']),

	Song: defineTable({
		title: v.string(),
		artist: v.optional(v.string()),
		ownerId: v.id('User'),
		originalKeyTag: v.optional(convexTagValidator('MusicalKeys')),
		capo: v.optional(v.number()),
		// No visibilityTag: no sharing in v1, so access is computed (model/access.ts). §4.5.
		copyrightSourceTag: convexTagValidator('CopyrightSources'),
		ccliSongNumber: v.optional(v.string()),
		copyrightLine: v.optional(v.string()),
		songwriters: v.array(v.string()),
		/* Bumped by a trigger whenever the song, a section or a line changes (functions.ts). */
		updatedEpoch: epoch()
	})
		.index('by_ownerId_and_updatedEpoch', ['ownerId', 'updatedEpoch'])
		.searchIndex('search_title', { searchField: 'title', filterFields: ['ownerId'] }),

	/*
	 * A block: a named group of lines ("Verse 1", "Chorus"). A repeat carries `repeatOfId` and no lines of
	 * its own; it renders the source's lines and groups, so a fix lands everywhere. `order` shares one
	 * space with the song's loose lines (parentRef Song). §4.1–4.2.
	 */
	SongSection: defineTable({
		songId: v.id('Song'),
		name: v.string(),
		kindTag: convexTagValidator('SongSectionKinds'),
		order: v.number(),
		repeatOfId: v.optional(v.id('SongSection'))
	})
		.index('by_songId_and_order', ['songId', 'order'])
		.index('by_repeatOfId', ['repeatOfId']),

	SongLine: defineTable({
		parentRef: v.union(discriminatedUnionItem('Song'), discriminatedUnionItem('SongSection')),
		/* Denormalised, written with parentRef. For cascade delete and orphan audits, not rendering. */
		songId: v.id('Song'),
		order: v.number(),
		kindTag: convexTagValidator('SongLineKinds'),
		characters: v.array(characterValidator),
		/*
		 * This line starts a new line group (what the leader advances through live). Groups are derived
		 * (#lib/chart groupArrangement): a block's first line always starts one, and a block with no
		 * markers is one group. Groups never cross a block.
		 */
		startsGroup: v.optional(v.boolean())
	})
		.index('by_parentRef_and_order', ['parentRef', 'order'])
		.index('by_songId', ['songId']),

	/* Reading (post-v1) is designed, not built. §4.4. */

	JamSession: defineTable({
		name: v.string(),
		ownerId: v.id('User'),
		isLive: v.boolean(),
		/* Focus = (setlist item, group index). One QR follows the leader through the set. §14. */
		focusedItemId: v.optional(v.id('JamSessionItem')),
		focusedGroupIndex: v.optional(v.number()),
		focusedEpoch: v.optional(epoch())
	}).index('by_ownerId', ['ownerId']),
	// No slug: the document _id is the share link. No connectedCount: presence derives it.

	JamSessionItem: defineTable({
		jamSessionId: v.id('JamSession'),
		/* A discriminated ref, not songId: widening to Reading later revalidates every row unchanged. */
		contentRef: discriminatedUnionItem('Song'),
		order: v.number(),
		transposeSemitones: v.number()
	})
		.index('by_jamSessionId_and_order', ['jamSessionId', 'order'])
		.index('by_contentRef', ['contentRef']),

	/* An invited account holder — the people playing. §14.2. */
	JamSessionMember: defineTable({
		jamSessionId: v.id('JamSession'),
		/* userId when they had an account at invite time; otherwise invitedEmail, claimed when their */
		/* User row is created (trigger in functions.ts). */
		userId: v.optional(v.id('User')),
		invitedEmail: v.optional(v.string()),
		statusTag: convexTagValidator('MembershipStatuses'),
		roleTag: convexTagValidator('JamSessionRoles'),
		invitedByUserId: v.id('User'),
		invitedEpoch: epoch(),
		respondedEpoch: v.optional(epoch())
	})
		.index('by_jamSessionId_and_statusTag', ['jamSessionId', 'statusTag'])
		.index('by_jamSessionId_and_userId', ['jamSessionId', 'userId'])
		.index('by_userId_and_statusTag', ['userId', 'statusTag'])
		.index('by_invitedEmail', ['invitedEmail']),

	/*
	 * One row per song shown in a live session, for the church's CCLI usage report (per-date CSV). The
	 * song's CCLI fields are copied in, so the report stays right if the song is edited or deleted. §18.4.
	 */
	SongUsage: defineTable({
		ownerId: v.id('User'), // the session owner, whose church reports it
		jamSessionId: v.id('JamSession'),
		songId: v.id('Song'),
		title: v.string(),
		ccliSongNumber: v.optional(v.string()),
		usedEpoch: epoch()
	})
		.index('by_ownerId_and_usedEpoch', ['ownerId', 'usedEpoch'])
		.index('by_jamSessionId_and_usedEpoch', ['jamSessionId', 'usedEpoch'])
});
