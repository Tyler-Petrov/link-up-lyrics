/*
 * CCLI: the church's license number on the User row, and the per-date usage report from SongUsage rows that
 * live sessions record (model/jam_session.ts). The report is what the church owes CCLI for small-group
 * nights, which otherwise never gets reported. §18.4, §18.9.
 */
import { v } from 'convex/values';
import { authQuery, valibotMutation } from './functions';
import { ccliLicenseSchema } from './forms/ccli';
import { epoch } from './validators';

export const updateLicenseNumber = valibotMutation({
	schema: ccliLicenseSchema,
	handler: async (ctx, { ccliLicenseNumber }) => {
		await ctx.db.patch('User', ctx.user._id, {
			ccliLicenseNumber: ccliLicenseNumber || undefined
		});
		return null;
	}
});

/**
 * Songs shown in sessions the caller hosted between two times, oldest first. Title and CCLI number are as
 * they were when shown; artist and copyright line come from the song now, and are missing if it's deleted.
 */
export const usage = authQuery({
	args: { fromEpoch: epoch(), toEpoch: epoch() },
	handler: async (ctx, { fromEpoch, toEpoch }) => {
		const rows = await ctx.db
			.query('SongUsage')
			.withIndex('by_ownerId_and_usedEpoch', (q) =>
				q.eq('ownerId', ctx.user._id).gte('usedEpoch', fromEpoch).lt('usedEpoch', toEpoch)
			)
			.take(2000);
		const songs = new Map(
			await Promise.all(
				[...new Set(rows.map((row) => row.songId))].map(
					async (id) => [id, await ctx.db.get('Song', id)] as const
				)
			)
		);
		const sessions = new Map(
			await Promise.all(
				[...new Set(rows.map((row) => row.jamSessionId))].map(
					async (id) => [id, await ctx.db.get('JamSession', id)] as const
				)
			)
		);
		return rows.map((row) => {
			const song = songs.get(row.songId);
			return {
				_id: row._id,
				usedEpoch: row.usedEpoch,
				title: row.title,
				artist: song?.artist,
				ccliSongNumber: row.ccliSongNumber,
				copyrightSourceTag: song?.copyrightSourceTag,
				copyrightLine: song?.copyrightLine,
				jamSessionName: sessions.get(row.jamSessionId)?.name ?? 'Deleted session'
			};
		});
	}
});
