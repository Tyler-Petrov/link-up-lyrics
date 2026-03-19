import { query } from "./_generated/server";
import { v } from "convex/values";

export const getSong = query({
    args: {
        songId: v.id("lyricLine"),
    },
    handler: async ({ db }, { songId }) => {
        const song = await db.get(songId);
        song?.characters.at(0)?.chord.key
    },
});