// Supabase Edge Function: checks a Google Play purchase token and grants the purchase once.
// Called by the app (src/js/55-store.js) with the player's session; all logic is in ../_shared/play.mjs.
// Deploy and secrets: docs/MONETIZATION.md (supabase functions deploy verify-purchase).
import { createVerifyHandler } from '../_shared/play.mjs';

Deno.serve(createVerifyHandler({ env: (name: string) => Deno.env.get(name), fetch, now: () => Date.now() }));
