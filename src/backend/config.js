/**
 * PASTE YOUR SUPABASE DETAILS HERE
 *
 * Find them in your Supabase dashboard:
 *   Project Settings → API
 *     • Project URL      → URL below
 *     • anon public key  → KEY below
 *
 * Both values are safe to publish — the anon key only grants what your
 * Row Level Security policies allow (public read, owner-only write).
 *
 * While these stay empty the site runs offline from the bundled data
 * files, exactly as it does today.
 */
export const SUPABASE = {
  URL: "https://fkftvudfngcmrtylevnl.supabase.co",
  KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZrZnR2dWRmbmdjbXJ0eWxldm5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NTU5MzYsImV4cCI6MjEwMzMzMTkzNn0.nNmgcDiSIYDkfn4bVoR9CdsojlFxPIunIdG68PAOysI"
};

/** True once the details above are filled in. */
export const isConfigured = () =>
  Boolean(SUPABASE.URL && SUPABASE.KEY);
