# Edge Functions

These are symlinks. The functions are written in `src/backend/functions/`,
alongside the rest of the backend; the Supabase CLI only deploys from this
directory, so each one is linked here rather than copied — a copy would
drift from the original the first time either changed.

To deploy:

    npx supabase functions deploy translate

`GROQ_API_KEY` is already set on the project and shared by both functions.
