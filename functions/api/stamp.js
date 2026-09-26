/**
 * The shop's change stamp, shared by every visitor.
 *
 * GET /api/stamp  ->  [{ "at": "<when products, categories or deals last changed>" }]
 *
 * Every page asks for the stamp when it opens and again while it stays
 * open, to know whether its prices are still current. Asked of Supabase
 * directly, that was one read per visitor per minute, and it was the
 * largest part of the database's egress. Kept here for 30 seconds, the
 * database is asked about twice a minute however many people are
 * shopping, and a change still reaches an open page within two minutes.
 */
import { kept } from "../../src/backend/edge-cache.js";

export const onRequestGet = context =>
  kept(context, "shop_version?select=at&id=eq.1", 30);
