-- Neon Duel: ranked online play. Run after 20261113000000_neon_duel_init.sql (safe to run again).
--
--   * "Rank" matches pair players who hold the same title (цол). The longer someone waits, the wider
--     the search: one title further every 15 seconds, and any format after 20 seconds.
--   * Rank points come from ranked matches only. Games against the built-in AI are practice: coins, no rank.
--   * When nobody is around the game offers a labelled bot. Bot wins give rank points only below 1400
--     (Гарьд); from there up the ladder is for real players.

create or replace function public.title_index(r integer) returns integer
language sql immutable as $$
  select case when r >= 2000 then 7 when r >= 1850 then 6 when r >= 1700 then 5 when r >= 1400 then 4
              when r >= 1175 then 3 when r >= 950  then 2 when r >= 725  then 1 else 0 end
$$;

-- A queue entry stays valid only while its owner keeps polling.
alter table public.match_queue add column if not exists seen_at timestamptz not null default now();

-- ============================================================ practice and bot results
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
  reward := case when p_format = 'ft3' then (case when p_won then 150 else 40 end)
                 else (case when p_won then 60 else 20 end) end;
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

-- ============================================================ matchmaking by title
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
    if old.created_at > now() - interval '20 seconds' then
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

-- ============================================================ results of online games
-- A player reports their own top-out for a given game of the series; the opponent gets the point.
-- Only the loser reports, so a dishonest client can only hurt itself. The game number makes the
-- report idempotent: if both players top out at once, the first report decides the game.
drop function if exists public.report_online_game(uuid);
create or replace function public.report_online_game(p_match uuid, p_game integer) returns public.online_matches
language plpgsql security definer set search_path = public as $$
declare m online_matches;
begin
  select * into m from online_matches where id = p_match for update;
  if not found or auth.uid() not in (m.player_a, m.player_b) then raise exception 'not_your_match'; end if;
  if m.status <> 'active' or p_game is distinct from m.game then return m; end if;
  if auth.uid() = m.player_a then
    update online_matches set score_b = score_b + 1, game = game + 1, seen_a = now() where id = m.id returning * into m;
  else
    update online_matches set score_a = score_a + 1, game = game + 1, seen_b = now() where id = m.id returning * into m;
  end if;
  if m.score_a >= m.target then return finish_online(m, m.player_a); end if;
  if m.score_b >= m.target then return finish_online(m, m.player_b); end if;
  return m;
end $$;
revoke execute on function public.report_online_game(uuid, integer) from public, anon;
grant execute on function public.report_online_game(uuid, integer) to authenticated;

-- An opponent who never connected: the match is dropped without a result (after 12 seconds).
-- An opponent who went silent for 30 seconds: the remaining player takes the series.
create or replace function public.claim_abandoned(p_match uuid) returns public.online_matches
language plpgsql security definer set search_path = public as $$
declare
  m online_matches;
  their_seen timestamptz;
begin
  select * into m from online_matches where id = p_match for update;
  if not found or auth.uid() not in (m.player_a, m.player_b) then raise exception 'not_your_match'; end if;
  if m.status <> 'active' then return m; end if;
  their_seen := case when auth.uid() = m.player_a then m.seen_b else m.seen_a end;
  if their_seen = m.created_at and m.score_a + m.score_b = 0 then
    if now() - m.created_at > interval '12 seconds' then
      update online_matches set status = 'abandoned', finished_at = now() where id = m.id returning * into m;
      return m;
    end if;
  elsif now() - their_seen > interval '30 seconds' then
    return finish_online(m, auth.uid());
  end if;
  raise exception 'opponent_active';
end $$;

-- A player whose own live connection never opened steps out of a match that has not started; no result.
create or replace function public.leave_unstarted(p_match uuid) returns public.online_matches
language plpgsql security definer set search_path = public as $$
declare m online_matches;
begin
  select * into m from online_matches where id = p_match for update;
  if not found or auth.uid() not in (m.player_a, m.player_b) then raise exception 'not_your_match'; end if;
  if m.status = 'active' and m.score_a + m.score_b = 0
     and (case when auth.uid() = m.player_a then m.seen_a else m.seen_b end) = m.created_at then
    update online_matches set status = 'abandoned', finished_at = now() where id = m.id returning * into m;
  end if;
  return m;
end $$;
revoke execute on function public.leave_unstarted(uuid) from public, anon;
grant execute on function public.leave_unstarted(uuid) to authenticated;
