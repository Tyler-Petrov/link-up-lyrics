import { v, type VObject, type VString } from "convex/values";
import { defineSchema, defineTable } from "convex/server";
import * as constants from "./constants";
import { convexTagValidator } from "../lib/validators";

export default defineSchema({
    jamSession: defineTable({
        name: v.string(),
    }),
    song: defineTable({
        name: v.string(),
    }),
    lyricLine: defineTable({
        songId: v.id("song"),
        characters: v.array(v.object({
            letter: v.string(),
            chord: v.union(
                ...constants.Keys.map(key => {
                    return v.object({
                        key: v.literal(key.tag),
                        accidentals: convexTagValidator("Accidentals"),
                    })
                })
            ),
        }))
    })
});