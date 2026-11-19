// Supabase Edge Function: takes back refunded, charged-back or cancelled Google Play purchases.
// Run once a day by Supabase Cron with the x-cron-secret header; all logic is in ../_shared/play.mjs.
// Deploy, secrets and the schedule: docs/MONETIZATION.md (supabase functions deploy voided-purchases --no-verify-jwt).
import { createVoidedHandler } from '../_shared/play.mjs';

Deno.serve(createVoidedHandler({ env: (name: string) => Deno.env.get(name), fetch, now: () => Date.now() }));
