-- Neon Duel: play with a friend by code (unranked). Run after 20261115000000_ranked_online.sql (safe to run again).
--
--   * create_room(format) opens a room with a 6-character code (letters and digits without 0/O, 1/I/L),
--     valid for 10 minutes. A player has at most one open room: opening another closes the old one.
--   * The creator polls room_status(code): null while waiting, the match once a friend has joined.
--   * join_room(code) pairs the joiner with the creator in an online_matches row with ranked = false.
--     From there the live game is the same as a ranked one (ping_match, report_online_game,
--     claim_abandoned, leave_unstarted, forfeit_online).
--   * A friendly (unranked) series changes no rating, wins, losses or coins. Each player gets a history row
--     with kind 'friend' (rating_after = rating_before, no coins); the leaderboard and records only read
--     profiles, so these rows count nowhere.
--   * rematch_room(match): after a friendly series, the first player to ask opens a room only the other
--     player may join; the second player to ask joins it.
--   * cancel_room() closes the caller's open room (and releases a friend who joined at that same moment).

alter table public.online_matches add column if not exists ranked boolean not null default true;

alter table public.matches drop constraint if exists matches_kind_check;
alter table public.matches add constraint matches_kind_check check (kind in ('ai', 'bot', 'online', 'friend'));

create table if not exists public.friend_rooms (
  code       text        primary key,
  creator    uuid        not null references public.profiles (id) on delete cascade,
  invitee    uuid        references public.profiles (id) on delete cascade,    -- a rematch: only this player may join
  prev_match uuid        references public.online_matches (id) on delete cascade,
  format     text        not null check (format in ('single', 'ft3')),
  status     text        not null default 'open' check (status in ('open', 'taken', 'closed')),
  match_id   uuid        references public.online_matches (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes'
);
create unique index if not exists friend_rooms_one_open on public.friend_rooms (creator) where status = 'open';
create index if not exists friend_rooms_prev on public.friend_rooms (prev_match) where prev_match is not null;

alter table public.friend_rooms enable row level security;
drop policy if exists "creators see their rooms" on public.friend_rooms;
create policy "creators see their rooms" on public.friend_rooms for select to authenticated using (creator = auth.uid());
revoke insert, update, delete on public.friend_rooms from anon, authenticated;

-- ============================================================ helpers (not callable by players)
-- 6 characters from 31 (no 0, O, 1, I, L), drawn from gen_random_uuid()'s random bytes.
create or replace function public.new_room_code() returns text
language plpgsql volatile set search_path = public as $$
declare
  abc constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  b bytea := uuid_send(gen_random_uuid());
  s text := '';
begin
  for i in 0..5 loop
    s := s || substr(abc, 1 + get_byte(b, i) % 31, 1);
  end loop;
  return s;
end $$;

create or replace function public.open_friend_room(p_creator uuid, p_format text, p_invitee uuid, p_prev uuid, p_life interval)
returns public.friend_rooms
language plpgsql security definer set search_path = public as $$
declare r friend_rooms;
begin
  perform 1 from profiles where id = p_creator for update;     -- one room at a time per player, even on a double tap
  update friend_rooms set status = 'closed' where creator = p_creator and status = 'open';
  delete from friend_rooms where expires_at < now() - interval '1 day';
  for tries in 1..20 loop
    begin
      insert into friend_rooms (code, creator, invitee, prev_match, format, expires_at)
      values (new_room_code(), p_creator, p_invitee, p_prev, p_format, now() + p_life)
      returning * into r;
      return r;
    exception when unique_violation then
      null;                                                     -- the code is taken: draw another
    end;
  end loop;
  raise exception 'no_code';
end $$;

-- The joiner meets the creator: an unranked series, the creator hosts (player A).
create or replace function public.pair_room(r public.friend_rooms, p_joiner uuid) returns public.online_matches
language plpgsql security definer set search_path = public as $$
declare m online_matches;
begin
  delete from match_queue where user_id in (r.creator, p_joiner);
  insert into online_matches (player_a, player_b, format, target, seed, ranked)
  values (r.creator, p_joiner, r.format, case when r.format = 'ft3' then 3 else 1 end, floor(random() * 2147483647), false)
  returning * into m;
  update friend_rooms set status = 'taken', match_id = m.id where code = r.code;
  return m;
end $$;

revoke execute on function public.new_room_code(), public.open_friend_room(uuid, text, uuid, uuid, interval),
  public.pair_room(public.friend_rooms, uuid) from public, anon, authenticated;

-- ============================================================ functions for the client
create or replace function public.create_room(p_format text) returns public.friend_rooms
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from profiles where id = auth.uid()) then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_format is null or p_format not in ('single', 'ft3') then raise exception 'bad_format'; end if;
  delete from match_queue where user_id = auth.uid();          -- not searching for a ranked match at the same time
  return open_friend_room(auth.uid(), p_format, null, null, interval '10 minutes');
end $$;

-- The creator's poll: null while the room waits, the match once a friend has joined.
create or replace function public.room_status(p_code text) returns public.online_matches
language plpgsql security definer set search_path = public as $$
declare
  r friend_rooms;
  m online_matches;
begin
  select * into r from friend_rooms where code = upper(p_code);
  if not found or r.creator is distinct from auth.uid() then raise exception 'not_your_room'; end if;
  if r.status = 'taken' then
    select * into m from online_matches where id = r.match_id;
    if found and m.status = 'active' then return m; end if;
    raise exception 'room_expired';                             -- the friend gave up before the creator came back
  end if;
  if r.status <> 'open' or r.expires_at <= now() then raise exception 'room_expired'; end if;
  return null;
end $$;

create or replace function public.join_room(p_code text) returns public.online_matches
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  r friend_rooms;
  m online_matches;
begin
  if not exists (select 1 from profiles where id = me) then raise exception 'not_signed_in' using errcode = '28000'; end if;
  select * into r from friend_rooms where code = c for update;
  if not found then raise exception 'room_not_found'; end if;
  if r.creator = me then raise exception 'own_room'; end if;
  if r.status = 'taken' then
    select * into m from online_matches where id = r.match_id;
    if found and m.player_b = me and m.status = 'active' then return m; end if;   -- a retry after a lost answer
    raise exception 'room_taken';
  end if;
  if r.status <> 'open' or r.expires_at <= now() then raise exception 'room_expired'; end if;
  if r.invitee is not null and r.invitee <> me then raise exception 'room_taken'; end if;
  return pair_room(r, me);
end $$;

create or replace function public.cancel_room() returns void
language plpgsql security definer set search_path = public as $$
begin
  update friend_rooms set status = 'closed' where creator = auth.uid() and status = 'open';
  -- A friend who joined in the same moment is released at once instead of waiting for the no-show timeout.
  update online_matches o set status = 'abandoned', finished_at = now()
    from friend_rooms r
   where r.creator = auth.uid() and r.status = 'taken' and r.match_id = o.id
     and o.status = 'active' and o.score_a + o.score_b = 0 and o.seen_a = o.created_at;
end $$;

-- After a friendly series: the first to ask waits (null), the second joins and gets the new match.
create or replace function public.rematch_room(p_match uuid) returns public.online_matches
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  old online_matches;
  r friend_rooms;
  m online_matches;
begin
  select * into old from online_matches where id = p_match for update;      -- both players' calls queue up here
  if not found or me is null or me not in (old.player_a, old.player_b) then raise exception 'not_your_match'; end if;
  if old.ranked or old.status <> 'finished' then raise exception 'bad_match'; end if;
  select * into r from friend_rooms where prev_match = p_match order by created_at desc limit 1 for update;
  if found and r.status = 'taken' then
    select * into m from online_matches where id = r.match_id;
    if found and m.status = 'active' then return m; end if;
    raise exception 'room_expired';
  end if;
  if found and r.status = 'open' and r.expires_at > now() then
    if r.creator = me then return null; end if;                 -- still waiting for the other player
    return pair_room(r, me);
  end if;
  if old.finished_at < now() - interval '5 minutes' then raise exception 'room_expired'; end if;
  perform open_friend_room(me, old.format, case when me = old.player_a then old.player_b else old.player_a end,
                           p_match, interval '3 minutes');
  return null;
end $$;

revoke execute on function public.create_room(text), public.room_status(text), public.join_room(text),
  public.cancel_room(), public.rematch_room(uuid) from public, anon;
grant execute on function public.create_room(text), public.room_status(text), public.join_room(text),
  public.cancel_room(), public.rematch_room(uuid) to authenticated;

-- ============================================================ results: friendly series count nowhere
-- Same as in the first migration for ranked series; an unranked one only stores history rows.
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

-- ============================================================ ranked search ignores friendly series
-- Same as in 20261115000000_ranked_online.sql, except that only a fresh RANKED series is handed back as
-- "the other player's search just paired us"; an unfinished friendly series is given up like a stale one.
create or replace function public.find_match(p_format text) returns public.online_matches
language plpgsql security definer set search_path = public as $$
declare
  me profiles;
  opp match_queue;
  m online_matches;
  old online_matches;
  my_wait numeric;
  opp_wait numeric;
  fmt text;
begin
  select * into me from profiles where id = auth.uid();
  if not found then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_format not in ('single', 'ft3') then raise exception 'bad_format'; end if;

  for old in
    select * from online_matches
     where status = 'active' and me.id in (player_a, player_b)
     order by created_at desc
     for update
  loop
    if old.ranked and old.created_at > now() - interval '20 seconds' then
      return old;                              -- the other player's search just paired us
    end if;
    -- An older series this player is no longer in: searching again gives it up.
    if old.score_a + old.score_b = 0
       and (case when me.id = old.player_a then old.seen_a else old.seen_b end) = old.created_at then
      update online_matches set status = 'abandoned', finished_at = now() where id = old.id;   -- never started
    else
      perform finish_online(old, case when me.id = old.player_a then old.player_b else old.player_a end);
    end if;
  end loop;

  delete from match_queue where seen_at < now() - interval '15 seconds';
  select extract(epoch from now() - joined_at) into my_wait from match_queue where user_id = me.id;
  my_wait := coalesce(my_wait, 0);

  select q.* into opp from match_queue q
   where q.user_id <> me.id
     and abs(title_index(q.rating) - title_index(me.rating))
         <= floor(greatest(extract(epoch from now() - q.joined_at), my_wait) / 15)
     and (q.format = p_format or greatest(extract(epoch from now() - q.joined_at), my_wait) > 20)
   order by abs(title_index(q.rating) - title_index(me.rating)), (q.format <> p_format), q.joined_at
   limit 1
   for update skip locked;
  if found then
    opp_wait := extract(epoch from now() - opp.joined_at);
    fmt := case when opp_wait >= my_wait then opp.format else p_format end;   -- the longer wait picks the format
    delete from match_queue where user_id in (opp.user_id, me.id);
    insert into online_matches (player_a, player_b, format, target, seed)
    values (opp.user_id, me.id, fmt, case when fmt = 'ft3' then 3 else 1 end, floor(random() * 2147483647))
    returning * into m;
    return m;
  end if;

  insert into match_queue (user_id, rating, format) values (me.id, me.rating, p_format)
  on conflict (user_id) do update set rating = excluded.rating, format = excluded.format, seen_at = now();
  return null;
end $$;
