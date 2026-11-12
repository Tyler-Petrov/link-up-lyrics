/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as billing from "../billing.js";
import type * as ccli from "../ccli.js";
import type * as client_reload from "../client_reload.js";
import type * as components_ from "../components.js";
import type * as connection from "../connection.js";
import type * as constants from "../constants.js";
import type * as dev from "../dev.js";
import type * as forms_ccli from "../forms/ccli.js";
import type * as forms_invitation from "../forms/invitation.js";
import type * as forms_jam_session from "../forms/jam_session.js";
import type * as forms_song from "../forms/song.js";
import type * as functions from "../functions.js";
import type * as http from "../http.js";
import type * as init from "../init.js";
import type * as invitation from "../invitation.js";
import type * as jam_session from "../jam_session.js";
import type * as live from "../live.js";
import type * as migrations from "../migrations.js";
import type * as model_access from "../model/access.js";
import type * as model_billing from "../model/billing.js";
import type * as model_jam_session from "../model/jam_session.js";
import type * as model_song from "../model/song.js";
import type * as model_user from "../model/user.js";
import type * as seed from "../seed.js";
import type * as shared_chart_arrangement from "../shared/chart/arrangement.js";
import type * as shared_chart_chords from "../shared/chart/chords.js";
import type * as shared_chart_index from "../shared/chart/index.js";
import type * as shared_chart_lines from "../shared/chart/lines.js";
import type * as shared_chart_order from "../shared/chart/order.js";
import type * as shared_chart_paste from "../shared/chart/paste.js";
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
  billing: typeof billing;
  ccli: typeof ccli;
  client_reload: typeof client_reload;
  components: typeof components_;
  connection: typeof connection;
  constants: typeof constants;
  dev: typeof dev;
  "forms/ccli": typeof forms_ccli;
  "forms/invitation": typeof forms_invitation;
  "forms/jam_session": typeof forms_jam_session;
  "forms/song": typeof forms_song;
  functions: typeof functions;
  http: typeof http;
  init: typeof init;
  invitation: typeof invitation;
  jam_session: typeof jam_session;
  live: typeof live;
  migrations: typeof migrations;
  "model/access": typeof model_access;
  "model/billing": typeof model_billing;
  "model/jam_session": typeof model_jam_session;
  "model/song": typeof model_song;
  "model/user": typeof model_user;
  seed: typeof seed;
  "shared/chart/arrangement": typeof shared_chart_arrangement;
  "shared/chart/chords": typeof shared_chart_chords;
  "shared/chart/index": typeof shared_chart_index;
  "shared/chart/lines": typeof shared_chart_lines;
  "shared/chart/order": typeof shared_chart_order;
  "shared/chart/paste": typeof shared_chart_paste;
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
