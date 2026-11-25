# Khan Blocks: rules for working in this repo

Khan Blocks (formerly Neon Duel) is a 1v1 falling-blocks battle game for phones (Mongolian and English), built as a single
`index.html` and wrapped in an Android WebView app (`android/`). Online play uses Supabase (optional:
without `src/config.json` filled in, everything works offline). The owner plans to publish on Google Play
and the App Store. The player-visible name comes from one place, `brandName` in `src/i18n/45-brand.json`
(the build fills `@@brand@@`, texts use `{@brandName}`); the Android package is `com.anaraa.khanblocks`.
Rank titles are khan army ranks (Цэрэг … Их хаан): `TITLES` in `11-ranks.js`, `src/i18n/46-titles.json`
and the SQL `rank_title()`.

## Layout

| Path | What |
| --- | --- |
| `src/index.html` | Page skeleton with build directives (CSP lives here) |
| `src/body.html` | All markup |
| `src/css/NN-name.css` | Styles, joined in name order |
| `src/js/NN-name.js` | Game code, joined in name order into ONE script (shared globals, no modules) |
| `src/i18n/NN-name.json` | UI text `{"en": {...}, "mn": {...}}`, merged in name order |
| `src/assets/` | Fonts, images, sounds (inlined as data URLs by the build) |
| `src/vendor/` | Mable platform shell scripts. Do not edit |
| `index.html` | BUILD OUTPUT, committed (the APK workflow copies it). Never edit by hand |
| `supabase/migrations/` | Database schema and server functions, applied in name order |
| `docs/SUPABASE.md` | How the online part works and how to set it up |

JS file map: `10-profile` (saved profile, translate), `11-ranks` (daily reward, ranks, titles, badges),
`20-cloud` (Supabase client, sync, outbox), `30-rivals` (AI levels, ranked bots), `31-profile-ui`
(profile, ladder, leaderboard dialogs), `40-rules` (board, SRS, attacks, garbage), `41-ai`, `42-input`
(actions), `43-handling` (DAS / ARR / soft drop for held buttons and keys), `44-coach` (admin-only coach
for practice games: best placement search, hint drawing, admin sign-in; see `docs/ADMIN.md`), `50-match` (practice / bot /
online / friend series flow, results), `51-online` (Realtime client, matchmaking, live 1v1), `52-friends`
(friend rooms by code, unranked), `59-skins` (block skins registry, tile styles, previews), `60-render`,
`61-loop`, `62-fx` (sparks, attack orbs, shake, progress bar, celebrations), `63-home` (home screen art),
`64-result` (result screen), `70-controls` (buttons, touch gestures, keyboard), `72-controls-ui` (control
settings dialog), `80-ui` (dialogs, settings, shop, boot).

## How to change things

1. Edit files under `src/` (and `supabase/`, `android/`, `docs/` as needed).
2. `python3 tools/build.py` to rebuild `index.html`. Commit `src/` and `index.html` together.
3. Run the tests (below). Add checks for what you built.

Conventions:
- New features go in new numbered files where that keeps things apart (`src/js/45-feature.js`,
  `src/css/40-feature.css`, `src/i18n/40-feature.json`) rather than growing shared files.
- Every user-facing string goes through `t('key')` with both `mn` and `en` (the build fails if the two
  languages have different keys). Mongolian is the main language: write it naturally, not word-for-word.
- Escape anything a player typed or the server returned before putting it in HTML (`esc(...)`).
- Keep it offline-first: no feature may break when Supabase is not configured or unreachable.
- Server rules (rating, coins, purchases, rewards) are decided by security-definer SQL functions; the
  client only asks. Tables keep row level security with no direct writes. Add a NEW migration file for
  every database change; never rewrite an existing migration.
- No real secrets, keys or payment credentials in the repo. Ads use Google's public test IDs until the
  owner provides real ones; signing keys come from GitHub secrets.
- Do not dispatch GitHub Actions workflows (no APK builds): the owner asks for builds himself.
- Keep the page within its CSP (`src/index.html`): no external scripts, fonts or images.
- Gameplay rules follow TETR.IO Tetra League (SRS, 7-bag, attack table, garbage). Do not use the word
  "Tetris" or the TETR.IO name in anything a player or store visitor sees.

## Tests

    tests/run.sh          build check, browser game tests, SQL tests, two-player online test
    tests/run.sh quick    build check + browser game tests

- `tests/game_test.py`: rules, touch controls, game flows, cloud paths against a fake Supabase.
  Groups can be run alone: `python3 tests/game_test.py rules flows`. Add a group or checks for your work.
  Check state through the game's globals and `t('key')`, not exact wording or pixel positions.
- `supabase/tests/local_test.sql`: every server function, on plain Postgres with a Supabase stand-in.
- `supabase/tests/e2e_online.py`: two browser players against the real SQL with a Realtime stand-in.
- Set `CHROME=/usr/bin/google-chrome` if Playwright's own Chromium is not installed.

## Git

Work on your own branch, push it and open a pull request with a Mongolian description of what changed
and how it was tested. Do not merge; the coordinator reviews and merges. Commit messages in English.
