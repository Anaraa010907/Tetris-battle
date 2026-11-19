-- Khan Blocks: progression. XP and levels, daily missions, the season pass, the new skins and their prices,
-- smaller match coins with a daily cap on self-reported games, and private profile columns.
-- Run after 20261118000000_payments.sql (safe to run again). The game's side: src/js/56-progress.js (XP, levels,
-- missions), 57-pass.js (seasons), 59-skins.js (skins). The rules here repeat the game's exactly; the game counts at
-- once on the phone and these functions decide.
--
--   * Match XP (report_progress): per game [loss, win] practice 15/25, bot 25/40, online 30/50, friend 10/15; a
--     first-to-3 series x2.5; + 1 per 10 pieces (up to 20, or 50 in FT3); never more than 1.5 x min(seconds, pieces).
--     + 40 for the first win of the day with at least 20 pieces. At most 2400 match XP a day (Ulaanbaatar day).
--     One report per (player, ref). Practice and bot reports at most one per 10 seconds; online and friend results
--     come from the server's own online_matches row (winner, ranked, format, duration).
--   * Levels: level L to L+1 takes 100 + 20 (L - 1) XP, up to level 99; each new level pays 25 coins (150 at every
--     tenth level).
--   * Daily missions: three a day (easy, medium, hard; different kinds) from mission_pool; claim_mission pays
--     20/30/50 coins and 40/60/90 XP; reroll_mission once a day. New missions at midnight in Ulaanbaatar.
--   * Season pass: seasons (about six weeks), 30 tiers of 350 season XP (match XP + mission XP). Free track: 25 coins,
--     skins at tiers 10 and 25. Premium track (needs the pass_<season> entitlement): 50 coins, skins at tiers 1, 15, 30.
--     A skin the player already owns pays 100 coins instead.
--   * Skins: skin_price() lists the coin skins; season skins (ids 20-39) are never sold for coins.
--   * Profiles: everyone may read only the display columns (id, username, avatar, rating, wins, losses, theme, level);
--     a player reads their own row through get_my_profile().

-- ---- shared with the other wave-2 migration (keep identical) ----
create table if not exists public.entitlements (
  user_id        uuid        not null references public.profiles (id) on delete cascade,
  sku            text        not null,
  source         text        not null default 'play' check (source in ('play', 'appstore', 'grant')),
  order_id       text,
  purchase_token text        unique,
  granted_at     timestamptz not null default now(),
  revoked_at     timestamptz,
  primary key (user_id, sku)
);
alter table public.entitlements enable row level security;
drop policy if exists "own entitlements" on public.entitlements;
create policy "own entitlements" on public.entitlements for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.entitlements from anon, authenticated;
create or replace function public.has_entitlement(p_user uuid, p_sku text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.entitlements e where e.user_id = p_user and e.sku = p_sku and e.revoked_at is null)
$$;
revoke execute on function public.has_entitlement(uuid, text) from public, anon, authenticated;
-- ---- end of shared block ----

-- ============================================================ profile columns, report log
alter table public.profiles
  add column if not exists xp                integer     not null default 0,
  add column if not exists level             smallint    not null default 1,
  add column if not exists xp_day            date,
  add column if not exists xp_today          integer     not null default 0,
  add column if not exists first_win_day     date,
  add column if not exists last_progress     timestamptz,
  add column if not exists missions          jsonb       not null default '{}',
  add column if not exists pass              jsonb       not null default '{}',
  add column if not exists progress_imported boolean     not null default false;
alter table public.profiles drop constraint if exists profiles_progress;
alter table public.profiles add constraint profiles_progress check (xp >= 0 and xp_today >= 0 and level between 1 and 99);

-- one row per counted match: makes report_progress idempotent per (player, ref)
create table if not exists public.progress_reports (
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  ref        text        not null,
  mode       text        not null check (mode in ('practice', 'bot', 'online', 'friend')),
  won        boolean     not null,
  xp         integer     not null,
  coins      integer     not null default 0,          -- coins for new levels reached with this match
  created_at timestamptz not null default now(),
  primary key (user_id, ref)
);
create index if not exists progress_reports_time on public.progress_reports (user_id, created_at desc);
alter table public.progress_reports enable row level security;
drop policy if exists "own progress reports" on public.progress_reports;
create policy "own progress reports" on public.progress_reports for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.progress_reports from anon, authenticated;

-- ============================================================ tables shared with the game
-- The same JSON as SEASONS in src/js/57-pass.js and MISSIONS in src/js/56-progress.js (tests/game_test.py compares
-- them). A new season: a NEW migration with its row (and its skins in 59-skins.js and skin ids in the game).
create table if not exists public.seasons (
  id            text       primary key,
  starts        date       not null,                 -- first day (Ulaanbaatar)
  ends          date       not null,                 -- the day after the last day
  free_skins    smallint[] not null,                 -- rewards at free tiers 10 and 25
  premium_skins smallint[] not null                  -- rewards at premium tiers 1, 15 and 30
);
insert into public.seasons (id, starts, ends, free_skins, premium_skins)
select x.id, x.start::date, x."end"::date,
       array(select jsonb_array_elements_text(x.free)::smallint), array(select jsonb_array_elements_text(x.premium)::smallint)
  from jsonb_to_recordset($json$[
  {"id":"s1","start":"2026-11-16","end":"2026-12-28","free":[20,21],"premium":[22,23,24]},
  {"id":"s2","start":"2026-12-28","end":"2027-02-08","free":[25,26],"premium":[27,28,29]}]$json$::jsonb)
       as x(id text, start text, "end" text, free jsonb, premium jsonb)
on conflict (id) do update set starts = excluded.starts, ends = excluded.ends, free_skins = excluded.free_skins, premium_skins = excluded.premium_skins;

create table if not exists public.mission_pool (
  id     text     primary key,
  kind   text     not null,     -- play win lines tspin quad attack pieces ranked friend ft3win hardwin pps combo
  target integer  not null,     -- pps in tenths
  tier   smallint not null check (tier between 0 and 2)
);
insert into public.mission_pool (id, kind, target, tier)
select x.id, x.k, x.n, x.t
  from jsonb_to_recordset($json$[
  {"id":"play3","k":"play","n":3,"t":0},{"id":"lines30","k":"lines","n":30,"t":0},{"id":"quad1","k":"quad","n":1,"t":0},
  {"id":"pieces150","k":"pieces","n":150,"t":0},{"id":"ranked1","k":"ranked","n":1,"t":0},{"id":"attack15","k":"attack","n":15,"t":0},
  {"id":"win2","k":"win","n":2,"t":1},{"id":"lines80","k":"lines","n":80,"t":1},{"id":"tspin1","k":"tspin","n":1,"t":1},
  {"id":"quad3","k":"quad","n":3,"t":1},{"id":"attack40","k":"attack","n":40,"t":1},{"id":"combo4","k":"combo","n":4,"t":1},
  {"id":"pps15","k":"pps","n":15,"t":1},{"id":"friend1","k":"friend","n":1,"t":1},{"id":"ranked3","k":"ranked","n":3,"t":1},
  {"id":"win5","k":"win","n":5,"t":2},{"id":"tspin3","k":"tspin","n":3,"t":2},{"id":"attack100","k":"attack","n":100,"t":2},
  {"id":"pps20","k":"pps","n":20,"t":2},{"id":"ft3win1","k":"ft3win","n":1,"t":2},{"id":"hardwin1","k":"hardwin","n":1,"t":2},
  {"id":"lines200","k":"lines","n":200,"t":2},{"id":"combo7","k":"combo","n":7,"t":2}]$json$::jsonb)
       as x(id text, k text, n integer, t integer)
on conflict (id) do update set kind = excluded.kind, target = excluded.target, tier = excluded.tier;

alter table public.seasons enable row level security;
alter table public.mission_pool enable row level security;
drop policy if exists "seasons are public" on public.seasons;
create policy "seasons are public" on public.seasons for select using (true);
drop policy if exists "missions are public" on public.mission_pool;
create policy "missions are public" on public.mission_pool for select using (true);
revoke insert, update, delete on public.seasons, public.mission_pool from anon, authenticated;

-- coin price of a skin (SKINS in src/js/59-skins.js; tests compare); null: not sold for coins (season skins, unknown)
create or replace function public.skin_price(p_id integer) returns integer
language sql immutable as $$
  select (($json${"0":0,"1":100,"2":100,"3":300,"4":300,"5":300,"6":600,"7":600,"8":600,"9":1200,"10":1200,"11":2500,"12":2500}$json$::jsonb) ->> p_id::text)::integer
$$;

-- ============================================================ rules (the same numbers as the game)
create or replace function public.ub_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Ulaanbaatar')::date $$;

create or replace function public.xp_level(p_xp integer) returns integer
language plpgsql immutable as $$
declare
  l integer := 1;
  rest integer := greatest(coalesce(p_xp, 0), 0);
begin
  while l < 99 and rest >= 100 + 20 * (l - 1) loop
    rest := rest - (100 + 20 * (l - 1));
    l := l + 1;
  end loop;
  return l;
end $$;

create or replace function public.level_coins(p_level integer) returns integer
language sql immutable as $$ select case when p_level % 10 = 0 then 150 else 25 end $$;

create or replace function public.match_xp(p_mode text, p_won boolean, p_ft boolean, p_secs integer, p_pieces integer) returns integer
language sql immutable as $$
  with b as (
    select case p_mode when 'bot' then (case when p_won then 40 else 25 end)
                       when 'online' then (case when p_won then 50 else 30 end)
                       when 'friend' then (case when p_won then 15 else 10 end)
                       else (case when p_won then 25 else 15 end) end as w)
  select greatest(0, least((case when p_ft then (w * 5 + 1) / 2 else w end) + least(case when p_ft then 50 else 20 end, p_pieces / 10),
                           (3 * least(p_secs, p_pieces)) / 2))
    from b
$$;

-- a whole number from a JSON report, 0 when missing or not a number, at most p_max
create or replace function public.json_count(j jsonb, k text, p_max integer) returns integer
language sql immutable as $$
  select case when jsonb_typeof(j -> k) = 'number' then least(greatest(floor((j ->> k)::numeric), 0), p_max)::integer else 0 end
$$;

-- what tier p_tier of a season pays: {"skin": id} or {"coins": n}
create or replace function public.pass_reward(p_season text, p_tier integer, p_premium boolean) returns jsonb
language sql stable set search_path = public as $$
  select case when p_premium and p_tier = any (array[1, 15, 30])
                then jsonb_build_object('skin', s.premium_skins[array_position(array[1, 15, 30], p_tier)])
              when not p_premium and p_tier = any (array[10, 25])
                then jsonb_build_object('skin', s.free_skins[array_position(array[10, 25], p_tier)])
              else jsonb_build_object('coins', case when p_premium then 50 else 25 end) end
    from seasons s where s.id = p_season
$$;

-- three missions for a day: one per tier, each of a different kind
create or replace function public.new_missions(p_day date) returns jsonb
language plpgsql volatile set search_path = public as $$
declare
  list jsonb := '[]';
  kinds text[] := '{}';
  m mission_pool;
begin
  for t in 0..2 loop
    select * into m from mission_pool where tier = t and not (kind = any (kinds)) order by random() limit 1;
    list := list || jsonb_build_array(jsonb_build_object('id', m.id, 'p', 0, 'c', false));
    kinds := kinds || m.kind;
  end loop;
  return jsonb_build_object('day', p_day::text, 'rr', false, 'list', list);
end $$;

-- Locks the player's row and starts a new day when the date changed (daily XP count, missions).
create or replace function public.progress_day(p_user uuid) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  me profiles;
  today date := ub_today();
begin
  select * into me from profiles where id = p_user for update;
  if not found then return null; end if;
  if me.xp_day is distinct from today or coalesce(me.missions ->> 'day', '') <> today::text then
    update profiles
       set xp_today = case when xp_day = today then xp_today else 0 end,
           xp_day = today,
           missions = case when missions ->> 'day' = today::text then missions else new_missions(today) end
     where id = p_user
    returning * into me;
  end if;
  return me;
end $$;

-- XP to the player's level and the running season; new levels pay coins. Returns those coins.
create or replace function public.grant_xp(p_user uuid, p_xp integer) returns integer
language plpgsql security definer set search_path = public as $$
declare
  me profiles;
  se seasons;
  lv integer;
  v_coins integer := 0;
  sp jsonb;
begin
  if coalesce(p_xp, 0) <= 0 then return 0; end if;
  select * into me from profiles where id = p_user for update;
  lv := xp_level(me.xp + p_xp);
  for l in xp_level(me.xp) + 1 .. lv loop v_coins := v_coins + level_coins(l); end loop;
  select * into se from seasons where ub_today() >= starts and ub_today() < ends order by starts limit 1;
  if found then
    sp := coalesce(me.pass -> se.id, '{"xp":0,"f":[],"p":[]}');
    sp := jsonb_set(sp, '{xp}', to_jsonb(coalesce((sp ->> 'xp')::integer, 0) + p_xp));
  end if;
  update profiles
     set xp = xp + p_xp, level = lv, coins = coins + v_coins,
         pass = case when se.id is null then pass else jsonb_set(pass, array[se.id], sp) end,
         updated_at = now()
   where id = p_user;
  return v_coins;
end $$;

revoke execute on function public.progress_day(uuid), public.grant_xp(uuid, integer), public.new_missions(date),
  public.pass_reward(text, integer, boolean) from public, anon, authenticated;

-- ============================================================ functions for the client
-- A finished match: XP, first win, missions, level, season. p_ref: the online match id, or a client id for practice
-- and bot games. p_stats: {time, pieces, lines, tspins, quads, attack, combo, diff, ft, day}.
create or replace function public.report_progress(p_ref text, p_mode text, p_won boolean, p_stats jsonb default '{}')
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  me profiles;
  m online_matches;
  today date := ub_today();
  st jsonb := coalesce(p_stats, '{}');
  v_mode text := p_mode;
  won boolean := coalesce(p_won, false);
  ft boolean := coalesce(st ->> 'ft' = 'true', false);
  secs integer := json_count(st, 'time', 2700);
  pieces integer;
  v_lines integer; tspins integer; quads integer; v_attack integer; combo integer;
  diff integer := case when jsonb_typeof(st -> 'diff') = 'number' then (st ->> 'diff')::numeric::integer else -1 end;
  xp integer;
  first integer := 0;
  gain integer;
  v_coins integer;
  ms jsonb;
  list jsonb;
  item jsonb;
  mp mission_pool;
  prog integer;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_ref is null or p_ref !~ '^[A-Za-z0-9-]{8,64}$' then raise exception 'bad_ref'; end if;
  me := progress_day(auth.uid());
  if me.id is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if exists (select 1 from progress_reports where user_id = me.id and ref = p_ref) then return me; end if;   -- counted already
  if v_mode in ('online', 'friend') then
    -- the server's row decides: winner, ranked or friendly, format, how long it took
    if p_ref !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'bad_ref'; end if;
    select * into m from online_matches where id = p_ref::uuid;
    if not found or me.id not in (m.player_a, m.player_b) then raise exception 'not_your_match'; end if;
    if m.status = 'active' then raise exception 'not_finished'; end if;
    if m.status <> 'finished' then raise exception 'bad_match'; end if;                  -- abandoned: no result, no XP
    won := m.winner = me.id;
    v_mode := case when m.ranked then 'online' else 'friend' end;
    ft := m.format = 'ft3';
    secs := least(secs, floor(extract(epoch from m.finished_at - m.created_at))::integer);
  elsif v_mode in ('practice', 'bot') then
    if me.last_progress is not null and now() - me.last_progress < interval '10 seconds' then raise exception 'too_fast'; end if;
    secs := least(secs, case when ft then 2700 else 900 end);
  else
    raise exception 'bad_mode';
  end if;
  -- the numbers, cut to what can happen in that time
  pieces := least(json_count(st, 'pieces', 4000), 5 * secs + 10);
  v_lines := least(json_count(st, 'lines', 4000), pieces);
  tspins := least(json_count(st, 'tspins', 4000), pieces);
  quads := least(json_count(st, 'quads', 4000), pieces);
  v_attack := least(json_count(st, 'attack', 20000), 5 * pieces + 10);
  combo := least(json_count(st, 'combo', 4000), pieces);
  xp := match_xp(v_mode, won, ft, secs, pieces);
  if won and pieces >= 20 and me.first_win_day is distinct from today then first := 40; end if;
  gain := least(xp + first, greatest(0, 2400 - me.xp_today));
  -- today's missions (a report kept offline until another day counts XP only)
  ms := me.missions;
  if st ->> 'day' = today::text then
    list := ms -> 'list';
    for i in 0 .. jsonb_array_length(list) - 1 loop
      item := list -> i;
      select * into mp from mission_pool where id = item ->> 'id';
      if not found or (item ->> 'c')::boolean or (item ->> 'p')::integer >= mp.target then continue; end if;
      prog := (item ->> 'p')::integer;
      prog := case mp.kind
        when 'pps' then case when pieces >= 30 then greatest(prog, (pieces * 10) / greatest(secs, 1)) else prog end
        when 'combo' then greatest(prog, combo)
        else prog + case mp.kind
          when 'play' then 1 when 'win' then won::integer when 'lines' then v_lines when 'tspin' then tspins
          when 'quad' then quads when 'attack' then v_attack when 'pieces' then pieces
          when 'ranked' then (v_mode in ('bot', 'online'))::integer when 'friend' then (v_mode = 'friend')::integer
          when 'ft3win' then (won and ft)::integer when 'hardwin' then (won and v_mode = 'practice' and diff = 2)::integer
          else 0 end end;
      list := jsonb_set(list, array[i::text, 'p'], to_jsonb(least(prog, mp.target)));
    end loop;
    ms := jsonb_set(ms, '{list}', list);
  end if;
  update profiles
     set missions = ms, xp_today = xp_today + gain,
         first_win_day = case when first > 0 then today else first_win_day end,
         last_progress = case when v_mode in ('practice', 'bot') then now() else last_progress end,
         updated_at = now()
   where id = me.id;
  v_coins := grant_xp(me.id, gain);
  insert into progress_reports (user_id, ref, mode, won, xp, coins) values (me.id, p_ref, v_mode, won, gain, v_coins);
  select * into me from profiles where id = me.id;
  return me;
end $$;

create or replace function public.claim_mission(p_slot integer) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  me profiles;
  item jsonb;
  mp mission_pool;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  me := progress_day(auth.uid());
  if me.id is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_slot is null or p_slot not between 0 and 2 then raise exception 'bad_slot'; end if;
  item := me.missions -> 'list' -> p_slot;
  select * into mp from mission_pool where id = item ->> 'id';
  if not found then raise exception 'bad_slot'; end if;
  if (item ->> 'c')::boolean then raise exception 'already_claimed'; end if;
  if (item ->> 'p')::integer < mp.target then raise exception 'not_done'; end if;
  update profiles
     set missions = jsonb_set(missions, array['list', p_slot::text, 'c'], 'true'),
         coins = coins + (array[20, 30, 50])[mp.tier + 1], updated_at = now()
   where id = me.id;
  perform grant_xp(me.id, (array[40, 60, 90])[mp.tier + 1]);           -- mission XP is outside the daily match XP cap
  select * into me from profiles where id = me.id;
  return me;
end $$;

create or replace function public.reroll_mission(p_slot integer) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  me profiles;
  item jsonb;
  mp mission_pool;
  nm mission_pool;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  me := progress_day(auth.uid());
  if me.id is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_slot is null or p_slot not between 0 and 2 then raise exception 'bad_slot'; end if;
  if (me.missions ->> 'rr')::boolean then raise exception 'already_rerolled'; end if;
  item := me.missions -> 'list' -> p_slot;
  if (item ->> 'c')::boolean then raise exception 'already_claimed'; end if;
  select * into mp from mission_pool where id = item ->> 'id';
  select * into nm from mission_pool
   where tier = mp.tier
     and kind not in (select p.kind from jsonb_array_elements(me.missions -> 'list') e join mission_pool p on p.id = e ->> 'id')
   order by random() limit 1;
  if not found then raise exception 'no_mission'; end if;
  update profiles
     set missions = jsonb_set(jsonb_set(missions, array['list', p_slot::text], jsonb_build_object('id', nm.id, 'p', 0, 'c', false)), '{rr}', 'true'),
         updated_at = now()
   where id = me.id
  returning * into me;
  return me;
end $$;

create or replace function public.claim_pass_tier(p_season text, p_tier integer, p_premium boolean) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  me profiles;
  sp jsonb;
  track text := case when p_premium then 'p' else 'f' end;
  r jsonb;
  skin smallint;
begin
  select * into me from profiles where id = auth.uid() for update;
  if not found then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_season is null or not exists (select 1 from seasons where id = p_season) then raise exception 'bad_season'; end if;
  if p_tier is null or p_tier not between 1 and 30 then raise exception 'bad_tier'; end if;
  sp := coalesce(me.pass -> p_season, '{"xp":0,"f":[],"p":[]}');
  if coalesce((sp ->> 'xp')::integer, 0) < p_tier * 350 then raise exception 'not_reached'; end if;
  if coalesce(sp -> track, '[]') @> to_jsonb(p_tier) then raise exception 'already_claimed'; end if;
  if coalesce(p_premium, false) and not has_entitlement(me.id, 'pass_' || p_season) then raise exception 'no_pass'; end if;
  r := pass_reward(p_season, p_tier, coalesce(p_premium, false));
  skin := (r ->> 'skin')::smallint;
  sp := jsonb_set(sp, array[track], coalesce(sp -> track, '[]') || to_jsonb(p_tier));
  update profiles
     set pass = jsonb_set(pass, array[p_season], sp),
         owned = case when skin is not null and not (skin = any (owned)) then array_append(owned, skin) else owned end,
         coins = coins + case when skin is null then (r ->> 'coins')::integer when skin = any (owned) then 100 else 0 end,
         updated_at = now()
   where id = me.id
  returning * into me;
  return me;
end $$;

-- First time on a phone with offline progress: its XP and the running season's XP, once, capped.
create or replace function public.import_progress(p_xp integer, p_season text, p_season_xp integer) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  me profiles;
  v_xp integer := least(greatest(coalesce(p_xp, 0), 0), 6000);
  se seasons;
begin
  select * into me from profiles where id = auth.uid() for update;
  if not found then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if me.progress_imported or me.xp > 0 then return me; end if;
  select * into se from seasons where id = p_season and ub_today() >= starts and ub_today() < ends;
  update profiles
     set xp = v_xp, level = xp_level(v_xp), progress_imported = true,
         pass = case when se.id is null then pass
                     else jsonb_set(pass, array[se.id], jsonb_build_object('xp', least(greatest(coalesce(p_season_xp, 0), 0), v_xp), 'f', '[]'::jsonb, 'p', '[]'::jsonb)) end,
         updated_at = now()
   where id = me.id
  returning * into me;
  return me;
end $$;

-- Returns the player's whole row (the only way to read the private columns), with today's missions.
create or replace function public.get_my_profile() returns public.profiles
language plpgsql security definer set search_path = public as $$
declare me profiles;
begin
  me := progress_day(auth.uid());
  if me.id is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  return me;
end $$;

-- ============================================================ shop: every coin skin, season skins only from the pass
create or replace function public.buy_theme(p_theme integer) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  me profiles;
  price integer;
begin
  select * into me from profiles where id = auth.uid() for update;
  if not found then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_theme is null or p_theme not between 0 and 39 then raise exception 'bad_theme'; end if;
  if not (p_theme = any (me.owned)) then
    price := skin_price(p_theme);
    if price is null then
      if exists (select 1 from seasons where p_theme = any (free_skins || premium_skins)) then raise exception 'not_for_sale'; end if;
      raise exception 'bad_theme';
    end if;
    if me.coins < price then raise exception 'not_enough_coins'; end if;
    update profiles set coins = coins - price, owned = array_append(owned, p_theme::smallint) where id = me.id;
  end if;
  update profiles set theme = p_theme, updated_at = now() where id = me.id returning * into me;
  return me;
end $$;

-- One-time import of offline progress into a fresh account, with caps (coin skins only; season skins come from the pass).
create or replace function public.import_local(p_rating integer, p_wins integer, p_losses integer, p_coins integer, p_owned integer[])
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare me profiles;
begin
  select * into me from profiles where id = auth.uid() for update;
  if not found then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if me.imported or me.wins + me.losses > 0 then return me; end if;
  update profiles
     set rating = least(greatest(coalesce(p_rating, 1000), 0), 1400),
         wins = least(greatest(coalesce(p_wins, 0), 0), 500),
         losses = least(greatest(coalesce(p_losses, 0), 0), 500),
         coins = least(greatest(coalesce(p_coins, 0), 0), 2000),
         owned = array(select distinct x::smallint from unnest(coalesce(p_owned, '{}') || array[0]) x where skin_price(x) is not null order by 1),
         imported = true, updated_at = now()
   where id = me.id
  returning * into me;
  return me;
end $$;

-- ============================================================ match coins: 30 / 10 (FT3 75 / 20), self-reported games capped
-- Same as in 20261115000000_ranked_online.sql except the coins: smaller (the economy in docs/PROGRESSION.md), and at
-- most 600 coins a day (Ulaanbaatar) from practice and bot games, which the phone reports itself, now that coins can
-- also be bought.
create or replace function public.report_match(
  p_kind text, p_opponent text, p_opponent_rating integer, p_format text,
  p_won boolean, p_score_me integer, p_score_foe integer, p_stats jsonb default '{}')
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  me profiles;
  target integer := case when p_format = 'ft3' then 3 else 1 end;
  k numeric := case when p_format = 'ft3' then 40 else 24 end;
  ranked boolean := p_kind = 'bot';          -- 'ai' is practice
  delta integer := 0;
  reward integer;
  earned integer;
begin
  select * into me from profiles where id = auth.uid() for update;
  if not found then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_kind not in ('ai', 'bot') or p_format not in ('single', 'ft3') then raise exception 'bad_match'; end if;
  if p_won and (p_score_me <> target or p_score_foe not between 0 and target - 1)
     or not p_won and (p_score_foe <> target or p_score_me not between 0 and target - 1) then
    raise exception 'bad_score';
  end if;
  if me.last_report is not null and now() - me.last_report < interval '10 seconds' then
    raise exception 'too_fast';
  end if;
  if ranked then
    -- ranked bots are picked close to the player's own rating
    if p_opponent_rating is null or p_opponent_rating not between 500 and 2200
       or abs(p_opponent_rating - me.rating) > 250 then
      raise exception 'bad_opponent';
    end if;
    if me.rating < 1400 then
      delta := round(k * ((case when p_won then 1 else 0 end)
                          - 1 / (1 + power(10, (p_opponent_rating - me.rating) / 400.0))));
    end if;
  end if;
  reward := case when p_format = 'ft3' then (case when p_won then 75 else 20 end)
                 else (case when p_won then 30 else 10 end) end;
  select coalesce(sum(coins), 0) into earned from matches
   where user_id = me.id and kind in ('ai', 'bot') and created_at >= (ub_today()::timestamp at time zone 'Asia/Ulaanbaatar');
  reward := least(reward, greatest(0, 600 - earned));
  insert into matches (user_id, kind, format, opponent, won, score_me, score_foe, rating_before, rating_after, coins, stats)
  values (me.id, p_kind, p_format, left(p_opponent, 24), p_won, p_score_me, p_score_foe,
          me.rating, greatest(0, me.rating + delta), reward, coalesce(p_stats, '{}'));
  update profiles
     set rating = greatest(0, rating + delta),
         wins = wins + (case when ranked and p_won then 1 else 0 end),
         losses = losses + (case when ranked and not p_won then 1 else 0 end),
         coins = coins + reward,
         last_report = now(), updated_at = now()
   where id = me.id
  returning * into me;
  return me;
end $$;

-- Same as in 20261116000000_friend_rooms.sql except the coins of a ranked series (30 / 10, FT3 75 / 20).
create or replace function public.finish_online(m public.online_matches, p_winner uuid) returns public.online_matches
language plpgsql security definer set search_path = public as $$
declare
  a profiles; b profiles;
  k numeric := case when m.format = 'ft3' then 40 else 24 end;
  ea numeric; da integer; db integer;
  win_a boolean := p_winner = m.player_a;
  reward_w integer := case when m.format = 'ft3' then 75 else 30 end;
  reward_l integer := case when m.format = 'ft3' then 20 else 10 end;
begin
  if not m.ranked then
    select * into a from profiles where id = m.player_a;
    select * into b from profiles where id = m.player_b;
    insert into matches (user_id, kind, format, opponent, opponent_id, won, score_me, score_foe, rating_before, rating_after, coins)
    values (a.id, 'friend', m.format, b.username, b.id, win_a, m.score_a, m.score_b, a.rating, a.rating, 0),
           (b.id, 'friend', m.format, a.username, a.id, not win_a, m.score_b, m.score_a, b.rating, b.rating, 0);
    update online_matches set status = 'finished', winner = p_winner, finished_at = now() where id = m.id returning * into m;
    return m;
  end if;
  select * into a from profiles where id = m.player_a for update;
  select * into b from profiles where id = m.player_b for update;
  ea := 1 / (1 + power(10, (b.rating - a.rating) / 400.0));
  da := round(k * ((case when win_a then 1 else 0 end) - ea));
  db := round(k * ((case when win_a then 0 else 1 end) - (1 - ea)));
  update profiles set rating = greatest(0, rating + da), wins = wins + (case when win_a then 1 else 0 end),
         losses = losses + (case when win_a then 0 else 1 end), coins = coins + (case when win_a then reward_w else reward_l end),
         updated_at = now() where id = a.id;
  update profiles set rating = greatest(0, rating + db), wins = wins + (case when win_a then 0 else 1 end),
         losses = losses + (case when win_a then 1 else 0 end), coins = coins + (case when win_a then reward_l else reward_w end),
         updated_at = now() where id = b.id;
  insert into matches (user_id, kind, format, opponent, opponent_id, won, score_me, score_foe, rating_before, rating_after, coins)
  values (a.id, 'online', m.format, b.username, b.id, win_a, m.score_a, m.score_b, a.rating, greatest(0, a.rating + da),
          case when win_a then reward_w else reward_l end),
         (b.id, 'online', m.format, a.username, a.id, not win_a, m.score_b, m.score_a, b.rating, greatest(0, b.rating + db),
          case when win_a then reward_l else reward_w end);
  update online_matches set status = 'finished', winner = p_winner, finished_at = now() where id = m.id returning * into m;
  return m;
end $$;
revoke execute on function public.finish_online(public.online_matches, uuid) from public, anon, authenticated;

revoke execute on function public.report_progress(text, text, boolean, jsonb), public.claim_mission(integer), public.reroll_mission(integer),
  public.claim_pass_tier(text, integer, boolean), public.import_progress(integer, text, integer) from public, anon;
grant execute on function public.report_progress(text, text, boolean, jsonb), public.claim_mission(integer), public.reroll_mission(integer),
  public.claim_pass_tier(text, integer, boolean), public.import_progress(integer, text, integer) to authenticated;

-- ============================================================ privacy: only display columns are public
-- "profiles are public" used to expose every column (coins, streak, timestamps...). Reads by others need only these:
-- the opponent card (51-online.js: username, avatar, rating, wins, losses) and the leaderboard view (security_invoker:
-- id, username, avatar, rating, wins, losses). A player's own row comes from get_my_profile() and the other
-- functions, which run as their owner. New columns stay private unless granted here.
revoke select on public.profiles from anon, authenticated;
grant select (id, username, avatar, rating, wins, losses, theme, level) on public.profiles to anon, authenticated;
