-- Neon Duel: accounts, ranks, match history, leaderboard and (prepared) online matchmaking.
-- Run once in the Supabase SQL editor, or with `supabase db push`.
--
-- Rules for the client:
--   * Everything competitive (rating, wins, losses, coins, owned themes, daily streak) changes only
--     through the security-definer functions below. Tables have row level security and no write policies.
--   * Rating uses Elo against the opponent's rating: K = 24 for a single game, 40 for an FT3 series.
--   * Ranks: letters D..X from the rating (same thresholds as the game), grouped into wrestling titles (цол).

-- ============================================================ profiles
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text        not null,
  avatar      text        not null default '👑',
  rating      integer     not null default 1000,
  wins        integer     not null default 0,
  losses      integer     not null default 0,
  coins       integer     not null default 0,
  theme       smallint    not null default 0,
  owned       smallint[]  not null default '{0}',
  streak      integer     not null default 0,
  last_claim  date,
  imported    boolean     not null default false,
  last_report timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_username_len check (char_length(username) between 3 and 16),
  constraint profiles_username_chars check (username !~ '[[:cntrl:]<>"\\]'),
  constraint profiles_avatar check (avatar in ('👑', '◈', '☾', '⚡')),
  constraint profiles_numbers check (rating >= 0 and wins >= 0 and losses >= 0 and coins >= 0 and streak >= 0),
  constraint profiles_theme_owned check (theme = any (owned))
);
create unique index if not exists profiles_username_lower on public.profiles (lower(username));
create index if not exists profiles_rating on public.profiles (rating desc);

-- ============================================================ match history
create table if not exists public.matches (
  id            bigint generated always as identity primary key,
  user_id       uuid        not null references public.profiles (id) on delete cascade,
  kind          text        not null check (kind in ('ai', 'bot', 'online')),
  format        text        not null check (format in ('single', 'ft3')),
  opponent      text        not null,
  opponent_id   uuid        references public.profiles (id) on delete set null,
  won           boolean     not null,
  score_me      smallint    not null,
  score_foe     smallint    not null,
  rating_before integer     not null,
  rating_after  integer     not null,
  coins         integer     not null default 0,
  stats         jsonb       not null default '{}',
  created_at    timestamptz not null default now()
);
create index if not exists matches_user_time on public.matches (user_id, created_at desc);

-- ============================================================ online play (prepared for realtime 1v1)
create table if not exists public.match_queue (
  user_id   uuid primary key references public.profiles (id) on delete cascade,
  rating    integer     not null,
  format    text        not null check (format in ('single', 'ft3')),
  joined_at timestamptz not null default now()
);

create table if not exists public.online_matches (
  id          uuid primary key default gen_random_uuid(),
  player_a    uuid        not null references public.profiles (id) on delete cascade,
  player_b    uuid        not null references public.profiles (id) on delete cascade,
  format      text        not null check (format in ('single', 'ft3')),
  target      smallint    not null,
  seed        bigint      not null,
  score_a     smallint    not null default 0,
  score_b     smallint    not null default 0,
  game        smallint    not null default 1,
  status      text        not null default 'active' check (status in ('active', 'finished', 'abandoned')),
  winner      uuid        references public.profiles (id) on delete set null,
  seen_a      timestamptz not null default now(),
  seen_b      timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  finished_at timestamptz,
  constraint online_matches_players check (player_a <> player_b)
);
create index if not exists online_matches_a on public.online_matches (player_a, status);
create index if not exists online_matches_b on public.online_matches (player_b, status);

-- ============================================================ rank helpers (same thresholds as the game)
create or replace function public.rank_letter(r integer) returns text
language sql immutable as $$
  select case
    when r >= 2000 then 'X'  when r >= 1850 then 'U'  when r >= 1700 then 'SS'
    when r >= 1600 then 'S+' when r >= 1500 then 'S'  when r >= 1400 then 'S-'
    when r >= 1325 then 'A+' when r >= 1250 then 'A'  when r >= 1175 then 'A-'
    when r >= 1100 then 'B+' when r >= 1025 then 'B'  when r >= 950  then 'B-'
    when r >= 875  then 'C+' when r >= 800  then 'C'  when r >= 725  then 'C-'
    when r >= 650  then 'D+' else 'D' end
$$;

create or replace function public.rank_title(r integer) returns text
language sql immutable as $$
  select case
    when r >= 2000 then 'Даян аварга' when r >= 1850 then 'Аварга' when r >= 1700 then 'Арслан'
    when r >= 1400 then 'Гарьд'       when r >= 1175 then 'Заан'   when r >= 950  then 'Харцага'
    when r >= 725  then 'Начин'       else 'Шинэ бөх' end
$$;

-- ============================================================ new user -> profile
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text := left(trim(coalesce(new.raw_user_meta_data ->> 'username', '')), 11);
  name text;
  tries integer := 0;
begin
  if char_length(base) < 3 or base ~ '[[:cntrl:]<>"\\]' then base := 'NOMAD'; end if;
  name := base;
  while exists (select 1 from profiles where lower(username) = lower(name)) loop
    name := base || lpad(floor(random() * 10000)::int::text, 4, '0');
    tries := tries + 1;
    exit when tries > 25;
  end loop;
  insert into profiles (id, username) values (new.id, name);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================ row level security
alter table public.profiles       enable row level security;
alter table public.matches        enable row level security;
alter table public.match_queue    enable row level security;
alter table public.online_matches enable row level security;

drop policy if exists "profiles are public" on public.profiles;
create policy "profiles are public" on public.profiles for select using (true);

drop policy if exists "own matches" on public.matches;
create policy "own matches" on public.matches for select to authenticated using (user_id = auth.uid());

drop policy if exists "own queue entry" on public.match_queue;
create policy "own queue entry" on public.match_queue for select to authenticated using (user_id = auth.uid());

drop policy if exists "players see their online matches" on public.online_matches;
create policy "players see their online matches" on public.online_matches for select to authenticated
  using (auth.uid() in (player_a, player_b));

-- Writes happen only through the functions below.
revoke insert, update, delete on public.profiles, public.matches, public.match_queue, public.online_matches from anon, authenticated;

-- ============================================================ leaderboard (placed players only)
create or replace view public.leaderboard with (security_invoker = true) as
  select p.id, p.username, p.avatar, p.rating, p.wins, p.losses,
         public.rank_letter(p.rating) as letter, public.rank_title(p.rating) as title,
         rank() over (order by p.rating desc) as position
  from public.profiles p
  where p.wins + p.losses >= 5;
grant select on public.leaderboard to anon, authenticated;

-- ============================================================ functions for the client
create or replace function public.get_my_profile() returns public.profiles
language plpgsql security definer set search_path = public as $$
declare me profiles;
begin
  select * into me from profiles where id = auth.uid();
  if not found then raise exception 'not_signed_in' using errcode = '28000'; end if;
  return me;
end $$;

create or replace function public.my_position() returns integer
language sql security definer set search_path = public as $$
  select case when p.wins + p.losses < 5 then null
              else (select count(*)::int + 1 from profiles o where o.wins + o.losses >= 5 and o.rating > p.rating) end
  from profiles p where p.id = auth.uid()
$$;

create or replace function public.set_profile(p_username text, p_avatar text, p_theme integer)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare me profiles;
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  update profiles
     set username = coalesce(nullif(trim(p_username), ''), username),
         avatar = coalesce(p_avatar, avatar),
         theme = case when p_theme is not null and p_theme = any (owned) then p_theme else theme end,
         updated_at = now()
   where id = auth.uid()
  returning * into me;
  return me;
exception
  when unique_violation then raise exception 'username_taken' using errcode = '23505';
  when check_violation then raise exception 'bad_profile' using errcode = '23514';
end $$;

-- Result of a game against the built-in AI or a quick-match bot (online games use report_online_game).
create or replace function public.report_match(
  p_kind text, p_opponent text, p_opponent_rating integer, p_format text,
  p_won boolean, p_score_me integer, p_score_foe integer, p_stats jsonb default '{}')
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  me profiles;
  target integer := case when p_format = 'ft3' then 3 else 1 end;
  k numeric := case when p_format = 'ft3' then 40 else 24 end;
  expected numeric;
  delta integer;
  reward integer;
begin
  select * into me from profiles where id = auth.uid() for update;
  if not found then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_kind not in ('ai', 'bot') or p_format not in ('single', 'ft3') then raise exception 'bad_match'; end if;
  if p_opponent_rating not between 800 and 1300 then raise exception 'bad_opponent'; end if;
  if p_won and (p_score_me <> target or p_score_foe not between 0 and target - 1)
     or not p_won and (p_score_foe <> target or p_score_me not between 0 and target - 1) then
    raise exception 'bad_score';
  end if;
  if me.last_report is not null and now() - me.last_report < interval '10 seconds' then
    raise exception 'too_fast';
  end if;
  expected := 1 / (1 + power(10, (p_opponent_rating - me.rating) / 400.0));
  delta := round(k * ((case when p_won then 1 else 0 end) - expected));
  reward := case when p_format = 'ft3' then (case when p_won then 150 else 40 end)
                 else (case when p_won then 60 else 20 end) end;
  insert into matches (user_id, kind, format, opponent, won, score_me, score_foe, rating_before, rating_after, coins, stats)
  values (me.id, p_kind, p_format, left(p_opponent, 24), p_won, p_score_me, p_score_foe,
          me.rating, greatest(0, me.rating + delta), reward, coalesce(p_stats, '{}'));
  update profiles
     set rating = greatest(0, rating + delta),
         wins = wins + (case when p_won then 1 else 0 end),
         losses = losses + (case when p_won then 0 else 1 end),
         coins = coins + reward,
         last_report = now(), updated_at = now()
   where id = me.id
  returning * into me;
  return me;
end $$;

create or replace function public.claim_daily() returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  me profiles;
  today date := (now() at time zone 'Asia/Ulaanbaatar')::date;
  new_streak integer;
begin
  select * into me from profiles where id = auth.uid() for update;
  if not found then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if me.last_claim = today then raise exception 'already_claimed'; end if;
  new_streak := case when me.last_claim = today - 1 then me.streak + 1 else 1 end;
  update profiles
     set streak = new_streak, last_claim = today, coins = coins + least(7, new_streak) * 10, updated_at = now()
   where id = me.id
  returning * into me;
  return me;
end $$;

create or replace function public.buy_theme(p_theme integer) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare me profiles;
begin
  select * into me from profiles where id = auth.uid() for update;
  if not found then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_theme not in (0, 1, 2) then raise exception 'bad_theme'; end if;
  if not (p_theme = any (me.owned)) then
    if me.coins < 100 then raise exception 'not_enough_coins'; end if;
    update profiles set coins = coins - 100, owned = array_append(owned, p_theme::smallint) where id = me.id;
  end if;
  update profiles set theme = p_theme, updated_at = now() where id = me.id returning * into me;
  return me;
end $$;

-- One-time import of offline progress into a fresh account, with caps.
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
         owned = array(select distinct x::smallint from unnest(coalesce(p_owned, '{}') || array[0]) x where x in (0, 1, 2) order by 1),
         imported = true, updated_at = now()
   where id = me.id
  returning * into me;
  return me;
end $$;

-- Removes the player's account and everything tied to it (required by app stores).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- ------------------------------------------------------------ online matchmaking (prepared)
-- Join the queue or get paired with someone close in rating. The window widens by 10 rating points
-- per second the other player has waited. Returns the new match, or null while waiting.
create or replace function public.find_match(p_format text) returns public.online_matches
language plpgsql security definer set search_path = public as $$
declare
  me profiles;
  opp match_queue;
  m online_matches;
begin
  select * into me from profiles where id = auth.uid();
  if not found then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_format not in ('single', 'ft3') then raise exception 'bad_format'; end if;
  select * into m from online_matches
   where status = 'active' and me.id in (player_a, player_b) and created_at > now() - interval '30 minutes'
   order by created_at desc limit 1;
  if found then return m; end if;
  select * into opp from match_queue q
   where q.user_id <> me.id and q.format = p_format
     and abs(q.rating - me.rating) <= 150 + extract(epoch from now() - q.joined_at) * 10
   order by q.joined_at
   limit 1
   for update skip locked;
  if found then
    delete from match_queue where user_id in (opp.user_id, me.id);
    insert into online_matches (player_a, player_b, format, target, seed)
    values (opp.user_id, me.id, p_format, case when p_format = 'ft3' then 3 else 1 end, floor(random() * 2147483647))
    returning * into m;
    return m;
  end if;
  insert into match_queue (user_id, rating, format) values (me.id, me.rating, p_format)
  on conflict (user_id) do update set rating = excluded.rating, format = excluded.format;
  return null;
end $$;

create or replace function public.cancel_queue() returns void
language sql security definer set search_path = public as $$
  delete from match_queue where user_id = auth.uid()
$$;

-- Applies the end of an online series to both players.
create or replace function public.finish_online(m public.online_matches, p_winner uuid) returns public.online_matches
language plpgsql security definer set search_path = public as $$
declare
  a profiles; b profiles;
  k numeric := case when m.format = 'ft3' then 40 else 24 end;
  ea numeric; da integer; db integer;
  win_a boolean := p_winner = m.player_a;
  reward_w integer := case when m.format = 'ft3' then 150 else 60 end;
  reward_l integer := case when m.format = 'ft3' then 40 else 20 end;
begin
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

-- A player reports their own top-out; the opponent gets the point. Only the loser reports, so a
-- dishonest client can only hurt itself.
create or replace function public.report_online_game(p_match uuid) returns public.online_matches
language plpgsql security definer set search_path = public as $$
declare m online_matches;
begin
  select * into m from online_matches where id = p_match for update;
  if not found or auth.uid() not in (m.player_a, m.player_b) then raise exception 'not_your_match'; end if;
  if m.status <> 'active' then return m; end if;
  if auth.uid() = m.player_a then
    update online_matches set score_b = score_b + 1, game = game + 1 where id = m.id returning * into m;
  else
    update online_matches set score_a = score_a + 1, game = game + 1 where id = m.id returning * into m;
  end if;
  if m.score_a >= m.target then return finish_online(m, m.player_a); end if;
  if m.score_b >= m.target then return finish_online(m, m.player_b); end if;
  return m;
end $$;

-- Heartbeat while playing online (every ~10 s).
create or replace function public.ping_match(p_match uuid) returns public.online_matches
language plpgsql security definer set search_path = public as $$
declare m online_matches;
begin
  update online_matches
     set seen_a = case when auth.uid() = player_a then now() else seen_a end,
         seen_b = case when auth.uid() = player_b then now() else seen_b end
   where id = p_match and auth.uid() in (player_a, player_b)
  returning * into m;
  if not found then raise exception 'not_your_match'; end if;
  return m;
end $$;

-- If the opponent has been silent for 30 seconds, the remaining player takes the series.
create or replace function public.claim_abandoned(p_match uuid) returns public.online_matches
language plpgsql security definer set search_path = public as $$
declare m online_matches;
begin
  select * into m from online_matches where id = p_match for update;
  if not found or auth.uid() not in (m.player_a, m.player_b) then raise exception 'not_your_match'; end if;
  if m.status <> 'active' then return m; end if;
  if auth.uid() = m.player_a and now() - m.seen_b > interval '30 seconds' then return finish_online(m, m.player_a); end if;
  if auth.uid() = m.player_b and now() - m.seen_a > interval '30 seconds' then return finish_online(m, m.player_b); end if;
  raise exception 'opponent_active';
end $$;

-- Leaving an online series loses it.
create or replace function public.forfeit_online(p_match uuid) returns public.online_matches
language plpgsql security definer set search_path = public as $$
declare m online_matches;
begin
  select * into m from online_matches where id = p_match for update;
  if not found or auth.uid() not in (m.player_a, m.player_b) then raise exception 'not_your_match'; end if;
  if m.status <> 'active' then return m; end if;
  return finish_online(m, case when auth.uid() = m.player_a then m.player_b else m.player_a end);
end $$;

-- Only signed-in players may call the game functions.
revoke execute on function public.get_my_profile(), public.my_position(), public.set_profile(text, text, integer),
  public.report_match(text, text, integer, text, boolean, integer, integer, jsonb), public.claim_daily(),
  public.buy_theme(integer), public.import_local(integer, integer, integer, integer, integer[]),
  public.find_match(text), public.cancel_queue(), public.report_online_game(uuid), public.forfeit_online(uuid),
  public.delete_my_account(), public.ping_match(uuid), public.claim_abandoned(uuid)
  from public, anon;
grant execute on function public.get_my_profile(), public.my_position(), public.set_profile(text, text, integer),
  public.report_match(text, text, integer, text, boolean, integer, integer, jsonb), public.claim_daily(),
  public.buy_theme(integer), public.import_local(integer, integer, integer, integer, integer[]),
  public.find_match(text), public.cancel_queue(), public.report_online_game(uuid), public.forfeit_online(uuid),
  public.delete_my_account(), public.ping_match(uuid), public.claim_abandoned(uuid)
  to authenticated;

-- Players get live updates when they are paired or a series ends.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'online_matches') then
    alter publication supabase_realtime add table public.online_matches;
  end if;
end $$;
