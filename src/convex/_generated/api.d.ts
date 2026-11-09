/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as components_ from "../components.js";
import type * as constants from "../constants.js";
import type * as forms_song from "../forms/song.js";
import type * as functions from "../functions.js";
import type * as init from "../init.js";
import type * as migrations from "../migrations.js";
import type * as model_access from "../model/access.js";
import type * as model_song from "../model/song.js";
import type * as model_user from "../model/user.js";
import type * as seed from "../seed.js";
import type * as song from "../song.js";
import type * as song_edit from "../song_edit.js";
import type * as user from "../user.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  components: typeof components_;
  constants: typeof constants;
  "forms/song": typeof forms_song;
  functions: typeof functions;
  init: typeof init;
  migrations: typeof migrations;
  "model/access": typeof model_access;
  "model/song": typeof model_song;
  "model/user": typeof model_user;
  seed: typeof seed;
  song: typeof song;
  song_edit: typeof song_edit;
  user: typeof user;
  validators: typeof validators;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  presence: import("@convex-dev/presence/_generated/component.js").ComponentApi<"presence">;
};
