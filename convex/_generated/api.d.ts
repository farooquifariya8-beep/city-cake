/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assistant from "../assistant.js";
import type * as auth from "../auth.js";
import type * as cities from "../cities.js";
import type * as favorites from "../favorites.js";
import type * as images from "../images.js";
import type * as ingest from "../ingest.js";
import type * as itineraries from "../itineraries.js";
import type * as lib_categories from "../lib/categories.js";
import type * as lib_cities from "../lib/cities.js";
import type * as lib_curatedImages from "../lib/curatedImages.js";
import type * as lib_landmarks from "../lib/landmarks.js";
import type * as lib_osm from "../lib/osm.js";
import type * as lib_planner from "../lib/planner.js";
import type * as places from "../places.js";
import type * as planner from "../planner.js";
import type * as routes from "../routes.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  assistant: typeof assistant;
  auth: typeof auth;
  cities: typeof cities;
  favorites: typeof favorites;
  images: typeof images;
  ingest: typeof ingest;
  itineraries: typeof itineraries;
  "lib/categories": typeof lib_categories;
  "lib/cities": typeof lib_cities;
  "lib/curatedImages": typeof lib_curatedImages;
  "lib/landmarks": typeof lib_landmarks;
  "lib/osm": typeof lib_osm;
  "lib/planner": typeof lib_planner;
  places: typeof places;
  planner: typeof planner;
  routes: typeof routes;
  users: typeof users;
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
  auth: import("@convex-dev/auth/_generated/component.js").ComponentApi<"auth">;
  authPassword: import("@convex-dev/auth/components/password/_generated/component.js").ComponentApi<"authPassword">;
  authUsername: import("@convex-dev/auth/components/username/_generated/component.js").ComponentApi<"authUsername">;
};
