/*
 * Development data: three public-domain hymns in each user's library. Idempotent (skips a title the user
 * already has), and internal so it only runs by hand:
 *
 *   pnpm exec convex run seed:hymns                 # every user (up to 100)
 *   pnpm exec convex run seed:hymns '{"email":"you@example.com"}'
 *
 * "Blessed Assurance" repeats its chorus by reference; "Holy, Holy, Holy" has an intro and a turnaround
 * interlude; "Amazing Grace" groups its verses two lines at a time.
 */
import { v } from 'convex/values';
import { parseSongText } from '#convex/shared/chart/index.js';
import { internalMutation } from './functions';
import { insertParsedSong } from './model/song';

const hymnSeeds = [
	{
		title: 'Amazing Grace',
		artist: 'John Newton',
		songwriters: ['John Newton'],
		copyrightLine: 'Words: John Newton, 1779. Public domain.',
		groupEvery: 2,
		text: `{key: G}
[G]Amazing [G7]grace, how [C]sweet the [G]sound
That [G]saved a [Em]wretch like [D]me
I [G]once was [G7]lost, but [C]now am [G]found
Was [Em]blind, but [D]now I [G]see

'Twas [G]grace that [G7]taught my [C]heart to [G]fear
And [G]grace my [Em]fears re[D]lieved
How [G]precious [G7]did that [C]grace ap[G]pear
The [Em]hour I [D]first be[G]lieved

Through [G]many [G7]dangers, [C]toils and [G]snares
I [G]have al[Em]ready [D]come
'Tis [G]grace hath [G7]brought me [C]safe thus [G]far
And [Em]grace will [D]lead me [G]home`
	},
	{
		title: 'Blessed Assurance',
		artist: 'Fanny Crosby',
		songwriters: ['Fanny Crosby', 'Phoebe Knapp'],
		copyrightLine: 'Words: Fanny Crosby, 1873. Music: Phoebe Knapp, 1873. Public domain.',
		groupEvery: 0,
		text: `{key: D}
Verse 1
[D]Blessed as[G]surance, [D]Jesus is mine
O what a [A]foretaste of [E7]glory di[A]vine
[D]Heir of sal[G]vation, [D]purchase of God
[G]Born of His [D]Spirit, [A7]washed in His [D]blood

Chorus
[D]This is my [G]story, [D]this is my song
Praising my [E7]Savior [A]all the day long
[D]This is my [G]story, [D]this is my song
[G]Praising my [D]Savior [A7]all the day [D]long

Verse 2
[D]Perfect sub[G]mission, [D]perfect delight
Visions of [A]rapture now [E7]burst on my [A]sight
[D]Angels de[G]scending [D]bring from above
[G]Echoes of [D]mercy, [A7]whispers of [D]love

Chorus

Verse 3
[D]Perfect sub[G]mission, [D]all is at rest
I in my [A]Savior am [E7]happy and [A]blest
[D]Watching and [G]waiting, [D]looking above
[G]Filled with His [D]goodness, [A7]lost in His [D]love

Chorus`
	},
	{
		title: 'Holy, Holy, Holy',
		artist: 'Reginald Heber',
		songwriters: ['Reginald Heber', 'John Bacchus Dykes'],
		copyrightLine: 'Words: Reginald Heber, 1826. Music: John B. Dykes, 1861. Public domain.',
		groupEvery: 2,
		text: `{key: D}
Intro
[D] [G] [A] [D]

Verse 1
[D]Holy, holy, [Bm]holy! [G]Lord God Al[D]mighty!
[D]Early in the [Bm]morning our [E7]song shall rise to [A]Thee
[D]Holy, holy, [Bm]holy! [G]Merciful and [D]mighty!
[G]God in three [D]Persons, [A7]blessed Trini[D]ty!

Turnaround
[G] [D] [A7] [D]

Verse 2
[D]Holy, holy, [Bm]holy! [G]All the saints a[D]dore Thee
[D]Casting down their [Bm]golden crowns a[E7]round the glassy [A]sea
[D]Cherubim and [Bm]seraphim [G]falling down be[D]fore Thee
[G]Which wert, and [D]art, and [A7]evermore shalt [D]be

Turnaround

Verse 3
[D]Holy, holy, [Bm]holy! [G]Lord God Al[D]mighty!
[D]All Thy works shall [Bm]praise Thy name in [E7]earth and sky and [A]sea
[D]Holy, holy, [Bm]holy! [G]Merciful and [D]mighty!
[G]God in three [D]Persons, [A7]blessed Trini[D]ty!`
	}
];

export const hymns = internalMutation({
	args: { email: v.optional(v.string()) },
	handler: async (ctx, { email }) => {
		const users = email
			? await ctx.db
					.query('User')
					.withIndex('by_email', (q) => q.eq('email', email.toLowerCase()))
					.take(1)
			: await ctx.db.query('User').take(100);
		let created = 0;
		for (const user of users) {
			const existing = await ctx.db
				.query('Song')
				.withIndex('by_ownerId_and_updatedEpoch', (q) => q.eq('ownerId', user._id))
				.take(1000);
			for (const hymn of hymnSeeds) {
				if (existing.some((song) => song.title === hymn.title)) continue;
				const parsed = parseSongText(hymn.text);
				if (hymn.groupEvery) {
					for (const block of parsed.blocks) {
						block.lines.forEach((line, index) => {
							line.startsGroup = index > 0 && index % hymn.groupEvery === 0;
						});
					}
				}
				await insertParsedSong(ctx, user._id, parsed, {
					title: hymn.title,
					artist: hymn.artist,
					copyrightSourceTag: 'publicDomain',
					songwriters: hymn.songwriters,
					copyrightLine: hymn.copyrightLine
				});
				created++;
			}
		}
		return { users: users.length, created };
	}
});
