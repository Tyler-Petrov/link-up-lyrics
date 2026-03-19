import { v } from "convex/values";
import * as constants from "../convex/constants";

export function convexTagValidator<const ConstantName extends keyof typeof constants>(constantName: ConstantName) {
    return v.union(...constants[constantName].map(type => {
        return v.literal(type.tag as (typeof constants)[ConstantName][number]['tag'])
    }));
}