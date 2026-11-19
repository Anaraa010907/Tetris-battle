-- Exercises both migrations on plain Postgres (after local_stub.sql). Every check raises on failure.
\set ON_ERROR_STOP on
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), false); end $$;
create or replace function pg_temp.expect(ok boolean, what text) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;
create or replace function pg_temp.rating(u uuid) returns integer language sql as $$ select rating from public.profiles where id = u $$;
-- runs q and expects an error whose message is like err
create or replace function pg_temp.raises(q text, err text, what text) returns void language plpgsql as $$
begin
  begin execute q;
  exception when others then
    if sqlerrm like err then raise notice 'ok: %', what; return; end if;
    raise exception 'FAILED: % (got: %)', what, sqlerrm;
  end;
  raise exception 'FAILED: % (no error)', what;
end $$;
\set u1 '''11111111-1111-1111-1111-111111111111'''
\set u2 '''22222222-2222-2222-2222-222222222222'''
\set u3 '''33333333-3333-3333-3333-333333333333'''
\set u4 '''44444444-4444-4444-4444-444444444444'''

insert into auth.users (id, raw_user_meta_data) values
  (:u1, '{"username":"Анар"}'), (:u2, '{}'), (:u3, '{"username":"анар"}'), (:u4, '{"username":"<x>"}');

select pg_temp.expect((select username from profiles where id = :u1) = 'Анар', 'profile created with the requested name');
select pg_temp.expect((select username from profiles where id = :u2) = 'NOMAD', 'default name');
select pg_temp.expect((select username ~ '^анар[0-9]{4}$' from profiles where id = :u3), 'duplicate name (any case) gets a number');
select pg_temp.expect((select username ~ '^NOMAD' from profiles where id = :u4), 'unsafe name replaced');
select pg_temp.expect(rank_letter(1000) = 'B-' and rank_title(1000) = 'Зуут' and rank_letter(2100) = 'X' and rank_title(600) = 'Цэрэг' and rank_title(2100) = 'Их хаан' and rank_title(1400) = 'Түмэн', 'rank helpers');
select pg_temp.expect(title_index(600) = 0 and title_index(1000) = 2 and title_index(1399) = 3 and title_index(1400) = 4 and title_index(2500) = 7, 'title index');

-- ---------------------------------------------------------------- practice and bot results (player 1)
set role authenticated;
select pg_temp.as_user(:u1);
select pg_temp.expect((select rating from get_my_profile()) = 1000, 'get_my_profile');
select pg_temp.expect((select rating = 1000 and wins = 0 and losses = 0 and coins = 30 from report_match('ai', 'NOVA', 1250, 'single', true, 1, 0, '{"pps":1.2}')), 'practice win: coins only, no rank or record');
do $$ begin perform report_match('bot', 'Kairo', 1010, 'single', true, 1, 0); raise exception 'no rate limit';
exception when others then if sqlerrm <> 'too_fast' then raise; end if; raise notice 'ok: rate limit'; end $$;
reset role; update profiles set last_report = null; set role authenticated;
do $$ begin perform report_match('bot', 'Kairo', 1010, 'ft3', true, 2, 0); raise exception 'bad score accepted';
exception when others then if sqlerrm <> 'bad_score' then raise; end if; raise notice 'ok: score validated'; end $$;
do $$ begin perform report_match('bot', 'Kairo', 1500, 'single', true, 1, 0); raise exception 'far bot accepted';
exception when others then if sqlerrm <> 'bad_opponent' then raise; end if; raise notice 'ok: ranked bot must be near the player rating'; end $$;
select pg_temp.expect((select rating = 1012 and wins = 1 and coins = 60 from report_match('bot', 'Kairo', 1010, 'single', true, 1, 0)), 'ranked bot win near own rating: +12 RP');
do $$ begin update profiles set rating = 3000 where id = auth.uid(); raise exception 'direct update allowed';
exception when insufficient_privilege then raise notice 'ok: no direct writes'; end $$;
do $$ begin insert into matches (user_id, kind, format, opponent, won, score_me, score_foe, rating_before, rating_after)
  values (auth.uid(), 'ai', 'single', 'x', true, 1, 0, 1, 9999); raise exception 'direct insert allowed';
exception when insufficient_privilege then raise notice 'ok: no direct match inserts'; end $$;

select pg_temp.expect((select coins = 70 and streak = 1 from claim_daily()), 'daily bonus +10');
reset role; update profiles set coins = coins + 60 where id = :u1; set role authenticated;   -- 130 coins for the theme checks
do $$ begin perform claim_daily(); raise exception 'claimed twice';
exception when others then if sqlerrm <> 'already_claimed' then raise; end if; raise notice 'ok: daily once per day'; end $$;
select pg_temp.expect((select theme = 1 and coins = 30 and owned = '{0,1}' from buy_theme(1)), 'theme bought for 100 coins');
do $$ begin perform buy_theme(2); raise exception 'bought without coins';
exception when others then if sqlerrm <> 'not_enough_coins' then raise; end if; raise notice 'ok: theme needs 100 coins'; end $$;
select pg_temp.expect((select wins = 1 and not imported from import_local(1400, 99, 0, 5000, '{1,2}')), 'import ignored after ranked games');
select pg_temp.expect((select username = 'Хаан' and avatar = '⚡' and theme = 1 from set_profile('Хаан', '⚡', 2)), 'rename + avatar (unowned theme ignored)');
do $$ begin perform set_profile('NOMAD', null, null); raise exception 'duplicate name allowed';
exception when others then if sqlerrm <> 'username_taken' then raise; end if; raise notice 'ok: unique names'; end $$;
select pg_temp.expect((select count(*) = 2 from matches), 'player sees only own matches');

-- ---------------------------------------------------------------- import and the bot cap (player 2)
select pg_temp.as_user(:u2);
select pg_temp.expect((select rating = 1400 and wins = 6 and coins = 2000 and owned = '{0,1,2}' and imported from import_local(1800, 6, 2, 9999, '{2,40,1}')), 'one-time import with caps');
select pg_temp.expect((select rating = 1400 from import_local(1000, 0, 0, 0, '{}')), 'import only once');
select pg_temp.expect((select rating = 1400 and wins = 7 and coins = 2075 from report_match('bot', 'Vega', 1390, 'ft3', true, 3, 1)), 'bot wins give no RP from 1400 up');
select pg_temp.expect((select count(*) = 1 from leaderboard), 'leaderboard shows placed players');
select pg_temp.expect(my_position() = 1, 'position on leaderboard');
select pg_temp.as_user(:u1);
select pg_temp.expect(my_position() is null, 'unplaced player has no position');

-- ---------------------------------------------------------------- matchmaking by title
select pg_temp.as_user(:u2);                                   -- Түмэн (1400)
select pg_temp.expect((select m.id is null from find_match('single') m), 'first player waits in queue');
select pg_temp.as_user(:u1);                                   -- Харцага (1012)
select pg_temp.expect((select m.id is null from find_match('single') m), 'a different title is not paired at first');
select pg_temp.as_user(:u3);                                   -- Харцага (1000)
select pg_temp.expect((select m.player_a = :u1 and m.player_b = :u3 and m.target = 1 from find_match('single') m), 'same title is paired, ahead of the earlier Түмэн');
select pg_temp.expect((select count(*) = 1 from online_matches), 'players see their match');
select pg_temp.as_user(:u1);
select pg_temp.expect((select m.player_b = :u3 from find_match('single') m), 'waiting player gets the same match');
select pg_temp.as_user(:u2);
select pg_temp.expect((select count(*) = 0 from online_matches), 'others cannot see the match');
do $$ begin perform report_online_game((select id from online_matches limit 1), 1); raise exception 'outsider reported';
exception when others then if sqlerrm <> 'not_your_match' then raise; end if; raise notice 'ok: only players report'; end $$;

-- widening: after 31 s in the queue, two titles away and the other format are accepted
reset role; update match_queue set joined_at = now() - interval '31 seconds' where user_id = :u2; set role authenticated;
select pg_temp.as_user(:u4);                                   -- Харцага (1000), wants FT3
select pg_temp.expect((select m.player_a = :u2 and m.format = 'single' and m.target = 1 from find_match('ft3') m), 'long wait widens title and format; the longer wait picks the format');

-- no-show: player 2 never connects, player 4 did
select pg_temp.expect((select seen_b > created_at from ping_match((select id from online_matches where player_a = :u2))), 'heartbeat');
do $$ begin perform claim_abandoned((select id from online_matches where player_b = auth.uid())); raise exception 'claimed too early';
exception when others then if sqlerrm <> 'opponent_active' then raise; end if; raise notice 'ok: cannot claim right away'; end $$;
reset role;
update online_matches set created_at = created_at - interval '20 seconds', seen_a = seen_a - interval '20 seconds' where player_a = :u2;
set role authenticated;
select pg_temp.expect((select status = 'abandoned' and winner is null from claim_abandoned((select id from online_matches where player_b = auth.uid()))), 'no-show match is dropped');
reset role;
select pg_temp.expect(pg_temp.rating(:u2) = 1400 and pg_temp.rating(:u4) = 1000, 'no-show changes no ratings');
set role authenticated;

-- single game: the loser reports, a second report for the same game is ignored
select pg_temp.as_user(:u3);
select pg_temp.expect((select status = 'finished' and winner = :u1 and score_a = 1 from report_online_game((select id from online_matches where player_b = auth.uid()), 1)), 'loser reports, series ends');
select pg_temp.as_user(:u1);
select pg_temp.expect((select status = 'finished' and winner = :u1 and score_b = 0 from report_online_game((select id from online_matches where player_a = auth.uid() and player_b = :u3), 1)), 'late report for a decided game is ignored');
reset role;
select pg_temp.expect(pg_temp.rating(:u1) = 1024 and pg_temp.rating(:u3) = 988, 'online Elo applied to both players');
select pg_temp.expect((select count(*) = 2 from matches where kind = 'online'), 'online history rows');
select pg_temp.expect((select wins = 2 from profiles where id = :u1) and (select losses = 1 from profiles where id = :u3), 'online record');
set role authenticated;

-- FT3: both top out in game 1 -> the first report decides it; then a disconnect ends the series
select pg_temp.as_user(:u1);
select pg_temp.expect((select m.id is null from find_match('ft3') m), 'ft3 queue');
select pg_temp.as_user(:u3);
select pg_temp.expect((select m.target = 3 and m.player_a = :u1 from find_match('ft3') m), 'ft3 match created');
select pg_temp.as_user(:u1);
select pg_temp.expect((select score_b = 1 and game = 2 and status = 'active' from report_online_game((select id from online_matches where status = 'active'), 1)), 'game 1 goes to the opponent of the first reporter');
select pg_temp.as_user(:u3);
select pg_temp.expect((select score_a = 0 and score_b = 1 and game = 2 from report_online_game((select id from online_matches where status = 'active'), 1)), 'second report for game 1 changes nothing');
select pg_temp.expect((select seen_b > created_at from ping_match((select id from online_matches where status = 'active'))), 'ping');
do $$ begin perform claim_abandoned((select id from online_matches where status = 'active')); raise exception 'claimed while opponent active';
exception when others then if sqlerrm <> 'opponent_active' then raise; end if; raise notice 'ok: cannot claim an active opponent'; end $$;
reset role; update online_matches set seen_a = now() - interval '1 minute' where status = 'active'; set role authenticated;
select pg_temp.expect((select status = 'finished' and winner = :u3 from claim_abandoned((select id from online_matches where status = 'active'))), 'silent player loses the series');

-- a stale series is given up when its player searches again
select pg_temp.as_user(:u1);
select pg_temp.expect((select m.id is null from find_match('single') m), 'queue again');
select pg_temp.as_user(:u3);
select pg_temp.expect((select m.id is not null from find_match('single') m), 'paired again');
select pg_temp.expect((select seen_b > created_at from ping_match((select id from online_matches where status = 'active'))), 'player 3 connected');
reset role; update online_matches set created_at = created_at - interval '1 minute', seen_a = seen_a - interval '1 minute' where status = 'active'; set role authenticated;
select pg_temp.expect((select m.id is null from find_match('single') m), 'searching again with a stale series: back in the queue');
reset role;
select pg_temp.expect((select status = 'finished' and winner = :u1 and score_a + score_b = 0 from online_matches order by finished_at desc nulls last limit 1), 'the stale series went to the opponent');
delete from match_queue;
-- stale queue entries are ignored
insert into match_queue (user_id, rating, format, seen_at) values (:u4, 1000, 'single', now() - interval '1 minute');
set role authenticated;
select pg_temp.as_user(:u1);
select pg_temp.expect((select m.id is null from find_match('single') m), 'a player who stopped searching is not paired');
select cancel_queue();
reset role;
select pg_temp.expect((select count(*) = 0 from match_queue), 'cancel_queue');

-- stepping out before the match starts
set role authenticated;
select pg_temp.as_user(:u1);
select pg_temp.expect((select m.id is null from find_match('single') m), 'queue for the leave test');
select pg_temp.as_user(:u3);
select pg_temp.expect((select m.id is not null from find_match('single') m), 'paired for the leave test');
select pg_temp.expect((select status = 'abandoned' from leave_unstarted((select id from online_matches where status = 'active'))), 'a player who never connected can step out without a result');
select pg_temp.as_user(:u1);
select pg_temp.expect((select m.id is null from find_match('single') m), 'queue once more');
select pg_temp.as_user(:u3);
select pg_temp.expect((select m.id is not null from find_match('single') m), 'paired once more');
select pg_temp.expect((select seen_b > created_at from ping_match((select id from online_matches where status = 'active'))), 'connected');
select pg_temp.expect((select status = 'active' from leave_unstarted((select id from online_matches where status = 'active'))), 'a connected player cannot step out for free');
select pg_temp.expect((select status = 'finished' and winner = :u1 from forfeit_online((select id from online_matches where status = 'active'))), 'giving up loses the series');
reset role;

-- ---------------------------------------------------------------- friend rooms (unranked)
reset role;
select pg_temp.expect((select count(*) > 0 and bool_and(ranked) from online_matches), 'matchmaking series are ranked (Elo checks above ran with friend rooms installed)');
create temp table fr_before as select id, rating, wins, losses, coins from profiles;
create or replace function pg_temp.unchanged(u uuid) returns boolean language sql as $$
  select p.rating = b.rating and p.wins = b.wins and p.losses = b.losses and p.coins = b.coins
  from public.profiles p join fr_before b using (id) where p.id = u $$;
set role authenticated;
select pg_temp.as_user(:u1);
select code as c0 from create_room('ft3') \gset
select code as c1 from create_room('single') \gset
select pg_temp.expect(:'c1' ~ '^[A-HJKMNP-Z2-9]{6}$' and :'c0' ~ '^[A-HJKMNP-Z2-9]{6}$', 'room code: 6 characters, no 0/O/1/I/L');
select pg_temp.expect((select count(*) = 1 from friend_rooms where status = 'open') and (select status = 'closed' from friend_rooms where code = :'c0'), 'one open room per player: a new room closes the old one');
select pg_temp.expect((select expires_at between now() + interval '9 minutes' and now() + interval '11 minutes' and format = 'single' from friend_rooms where code = :'c1'), 'room expires after 10 minutes');
select pg_temp.expect((select m.id is null from room_status(:'c1') m), 'room_status: null while waiting');
select pg_temp.raises('select create_room(''ft5'')', 'bad_format', 'room format validated');
select pg_temp.raises(format('select join_room(%L)', :'c1'), 'own_room', 'cannot join your own room');
select pg_temp.as_user(:u3);
select pg_temp.expect((select count(*) = 0 from friend_rooms), 'others cannot read the room');
select pg_temp.raises(format('select room_status(%L)', :'c1'), 'not_your_room', 'only the creator polls the room');
select pg_temp.raises('select join_room(''QQQQQQ'')', 'room_not_found', 'wrong code');
select pg_temp.raises(format('select join_room(%L)', :'c0'), 'room_expired', 'a closed room cannot be joined');
select id as fm from join_room(lower(substr(:'c1', 1, 3)) || ' - ' || lower(substr(:'c1', 4))) \gset
select pg_temp.expect((select player_a = :u1 and player_b = :u3 and not ranked and target = 1 and status = 'active' from online_matches where id = :'fm'), 'join (lower case, spaces, dash): unranked match, the creator hosts');
select pg_temp.expect((select m.id = :'fm' from join_room(:'c1') m), 'joining again returns the same match');
select pg_temp.as_user(:u2);
select pg_temp.raises(format('select join_room(%L)', :'c1'), 'room_taken', 'a room takes only one joiner');
select pg_temp.as_user(:u1);
select pg_temp.expect((select m.id = :'fm' from room_status(:'c1') m), 'the creator''s poll returns the match');
select pg_temp.as_user(:u3);
select pg_temp.expect((select status = 'finished' and winner = :u1 from report_online_game(:'fm', 1)), 'friendly game played to a result');
reset role;
select pg_temp.expect(pg_temp.unchanged(:u1) and pg_temp.unchanged(:u3), 'friendly result: no rating, wins, losses or coins');
select pg_temp.expect((select count(*) = 2 and bool_and(rating_after = rating_before and coins = 0) from matches where kind = 'friend'), 'friendly history rows (kind friend, no rating change, no coins)');
set role authenticated;
select pg_temp.as_user(:u1);
select pg_temp.raises(format('select room_status(%L)', :'c1'), 'room_expired', 'a finished room is over');
-- rematch: the first to ask waits, the second joins
select pg_temp.as_user(:u3);
select pg_temp.expect((select m.id is null from rematch_room(:'fm') m), 'rematch: first player waits');
select pg_temp.expect((select m.id is null from rematch_room(:'fm') m), 'rematch: still waiting');
select pg_temp.as_user(:u2);
select pg_temp.raises(format('select rematch_room(%L)', :'fm'), 'not_your_match', 'only the two players can rematch');
select pg_temp.as_user(:u1);
select id as rm from rematch_room(:'fm') \gset
select pg_temp.expect((select player_a = :u3 and player_b = :u1 and not ranked and status = 'active' from online_matches where id = :'rm'), 'rematch: second player joins a new unranked match');
select pg_temp.as_user(:u3);
select pg_temp.expect((select m.id = :'rm' from rematch_room(:'fm') m), 'rematch: the waiting player gets the same match');
select pg_temp.expect((select seen_a > created_at from ping_match(:'rm')), 'rematch: heartbeat');
select pg_temp.as_user(:u1);
select pg_temp.expect((select status = 'finished' and winner = :u3 from forfeit_online(:'rm')), 'giving up a friendly match');
reset role;
select pg_temp.expect(pg_temp.unchanged(:u1) and pg_temp.unchanged(:u3), 'giving up a friendly match changes nothing');
update online_matches set finished_at = now() - interval '6 minutes' where id = :'rm';
set role authenticated;
select pg_temp.raises(format('select rematch_room(%L)', :'rm'), 'room_expired', 'no rematch long after the series');
-- expiry, cancel, and a cancel that crosses a join
select pg_temp.as_user(:u2);
select code as c2 from create_room('single') \gset
reset role; update friend_rooms set expires_at = now() - interval '1 second' where code = :'c2'; set role authenticated;
select pg_temp.raises(format('select room_status(%L)', :'c2'), 'room_expired', 'the creator learns the code expired');
select pg_temp.as_user(:u3);
select pg_temp.raises(format('select join_room(%L)', :'c2'), 'room_expired', 'expired code');
select pg_temp.as_user(:u2);
select code as c3 from create_room('single') \gset
select cancel_room();
select pg_temp.as_user(:u3);
select pg_temp.raises(format('select join_room(%L)', :'c3'), 'room_expired', 'cancelled room cannot be joined');
select pg_temp.as_user(:u2);
select code as c4 from create_room('ft3') \gset
select pg_temp.as_user(:u3);
select id as xm from join_room(:'c4') \gset
select pg_temp.as_user(:u2);
select cancel_room();
reset role;
select pg_temp.expect((select status = 'abandoned' and winner is null from online_matches where id = :'xm'), 'cancel right after a join releases the friend without a result');
set role authenticated;
-- ranked search does not pick up a friendly series
select pg_temp.as_user(:u2);
select code as c5 from create_room('single') \gset
select pg_temp.as_user(:u3);
select id as ym from join_room(:'c5') \gset
select pg_temp.expect((select m.id is null from find_match('single') m), 'a fresh friendly series is not taken as a ranked pairing');
reset role;
select pg_temp.expect((select status = 'abandoned' from online_matches where id = :'ym'), 'searching ranked gives up the unstarted friendly series');
select pg_temp.expect(pg_temp.unchanged(:u2) and pg_temp.unchanged(:u3), 'friend rooms changed no profile');
delete from match_queue;
set role authenticated;
select pg_temp.as_user(:u1);
select pg_temp.raises('insert into friend_rooms (code, creator, format) values (''ZZZZZ2'', auth.uid(), ''single'')', 'permission denied%', 'no direct room inserts');
select pg_temp.raises('select new_room_code()', 'permission denied%', 'helper functions are not callable by players');
select pg_temp.raises('select finish_online(o, auth.uid()) from online_matches o limit 1', 'permission denied%', 'finish_online is not callable by players');
reset role;

-- account deletion
set role authenticated;
select pg_temp.as_user(:u4);
select delete_my_account();
reset role;
select pg_temp.expect(not exists (select 1 from profiles where id = :u4) and not exists (select 1 from auth.users where id = :u4), 'delete_my_account removes user and profile');

-- anon cannot call game functions
set role anon;
do $$ begin perform report_match('ai', 'NOVA', 1000, 'single', true, 1, 0); raise exception 'anon reported';
exception when insufficient_privilege then raise notice 'ok: anon blocked'; end $$;
do $$ begin perform report_online_game(gen_random_uuid(), 1); raise exception 'anon reported online';
exception when insufficient_privilege then raise notice 'ok: anon blocked from online reports'; end $$;
select pg_temp.raises('select create_room(''single'')', 'permission denied%', 'anon cannot open a friend room');
select pg_temp.raises('select join_room(''ABCDEF'')', 'permission denied%', 'anon cannot join a friend room');
reset role;

-- ================================================================ payments and ads (20261118000000_payments.sql)
-- (the payments agent's section; kept in one block, placed before the final echo so it still means all passed)
reset role;
grant usage on schema public to service_role;                  -- as on Supabase: the Edge Function's role
\set p1 '''55555555-5555-5555-5555-555555555555'''
\set p2 '''66666666-6666-6666-6666-666666666666'''
insert into auth.users (id, raw_user_meta_data) values (:p1, '{"username":"Худалдан"}'), (:p2, '{"username":"Сэргээх"}');
select pg_temp.expect(sku_kind('coins_small') = 'coins' and sku_kind('remove_ads') = 'entitlement' and sku_kind('pass_s1') = 'entitlement'
  and sku_kind('pass_S1') is null and sku_kind('gems') is null and sku_coins('coins_medium') = 1200 and sku_coins('coins_large') = 3500, 'pay: product table');
set role authenticated;
select pg_temp.as_user(:p1);
select pg_temp.raises(format('select record_purchase(%L, ''coins_small'', ''tok-coins-0001'', ''GPA.1'', now())', :p1), 'permission denied%', 'pay: players cannot record purchases');
select pg_temp.raises('select revoke_purchase(''tok-coins-0001'')', 'permission denied%', 'pay: players cannot revoke purchases');
select pg_temp.raises(format('select has_entitlement(%L, ''remove_ads'')', :p1), 'permission denied%', 'pay: has_entitlement is not callable by players');
select pg_temp.expect((select e->'skus' = '[]'::jsonb and not (e->>'paid')::boolean and (e->'ads'->>'free_coins')::int = 0
  and (e->'limits'->>'free_coins')::int = 5 from my_entitlements() e), 'pay: my_entitlements, nothing yet');
reset role;
-- the verify-purchase Edge Function (service role) records purchases it has checked with Google Play
set role service_role;
select pg_temp.expect((select r->>'status' = 'granted' and (r->>'coins')::int = 500 and (r->'profile'->>'coins')::int = 500 and (r->>'paid')::boolean
  and r->'skus' = '[]'::jsonb from record_purchase(:p1, 'coins_small', 'tok-coins-0001', 'GPA.0001', now()) r), 'pay: coin pack adds its coins');
select pg_temp.expect((select r->>'status' = 'already' and (r->>'coins')::int = 0 and (r->'profile'->>'coins')::int = 500
  from record_purchase(:p1, 'coins_small', 'tok-coins-0001', 'GPA.0001', now()) r), 'pay: the same token again grants nothing');
select pg_temp.raises(format('select record_purchase(%L, ''coins_small'', ''tok-coins-0001'', ''GPA.0001'', now())', :p2), 'token_used', 'pay: a coin token cannot be used by another account');
select pg_temp.raises(format('select record_purchase(%L, ''coins_medium'', ''tok-coins-0001'', ''GPA.0001'', now())', :p1), 'token_mismatch', 'pay: a token belongs to one product');
select pg_temp.raises(format('select record_purchase(%L, ''gems'', ''tok-gems-00001'', null, now())', :p1), 'bad_sku', 'pay: unknown products are refused');
select pg_temp.raises(format('select record_purchase(%L, ''coins_small'', ''short'', null, now())', :p1), 'bad_token', 'pay: token checked');
select pg_temp.expect((select r->>'status' = 'granted' and r->'skus' = '["remove_ads"]'::jsonb and (r->'profile'->>'coins')::int = 500
  from record_purchase(:p1, 'remove_ads', 'tok-noads-0001', 'GPA.0002', now()) r), 'pay: remove_ads becomes an entitlement');
select pg_temp.expect((select r->'skus' = '["pass_s1", "remove_ads"]'::jsonb from record_purchase(:p1, 'pass_s1', 'tok-pass-s1-01', 'GPA.0003', now(), true) r), 'pay: season pass granted');
reset role;
select pg_temp.expect(has_entitlement(:p1, 'remove_ads') and has_entitlement(:p1, 'pass_s1') and not has_entitlement(:p2, 'remove_ads'), 'pay: has_entitlement');
select pg_temp.expect((select count(*) = 0 from entitlements where sku like 'coins%'), 'pay: coin packs never become entitlement rows');
select pg_temp.expect((select test and order_id = 'GPA.0003' from purchases where purchase_token = 'tok-pass-s1-01'), 'pay: test purchases are marked');
-- restoring on another game account of the same Google account moves the non-consumable there
set role service_role;
select pg_temp.expect((select r->>'status' = 'transferred' and r->'skus' = '["remove_ads"]'::jsonb
  from record_purchase(:p2, 'remove_ads', 'tok-noads-0001', 'GPA.0002', now(), false, true) r), 'pay: restore moves remove_ads to the restoring account');
reset role;
select pg_temp.expect(has_entitlement(:p2, 'remove_ads') and not has_entitlement(:p1, 'remove_ads') and has_entitlement(:p1, 'pass_s1'), 'pay: only one account holds it');
set role service_role;
select pg_temp.raises(format('select record_purchase(%L, ''remove_ads'', ''tok-noads-0001'', ''GPA.0002'', now())', :p1), 'token_used', 'pay: without restore it does not move back');
-- refunds and voided purchases
select pg_temp.expect((select r->>'status' = 'revoked' from revoke_purchase('tok-noads-0001', 'refund') r), 'pay: voided remove_ads');
select pg_temp.expect((select r->>'status' = 'already' from revoke_purchase('tok-noads-0001', 'refund') r)
  and (select r->>'status' = 'unknown' from revoke_purchase('tok-unknown-01') r), 'pay: revoke is idempotent');
reset role;
select pg_temp.expect(not has_entitlement(:p2, 'remove_ads'), 'pay: a refund revokes the entitlement');
set role service_role;
select pg_temp.raises(format('select record_purchase(%L, ''remove_ads'', ''tok-noads-0001'', ''GPA.0002'', now(), false, true)', :p2), 'purchase_revoked', 'pay: a voided token cannot be restored');
select pg_temp.expect((select r->'skus' = '["remove_ads"]'::jsonb from record_purchase(:p2, 'remove_ads', 'tok-noads-0002', 'GPA.0004', now()) r), 'pay: buying again after a refund grants it again');
reset role; update profiles set coins = 200 where id = :p1; set role service_role;
select revoke_purchase('tok-coins-0001', 'chargeback');
reset role;
select pg_temp.expect((select coins = 0 from profiles where id = :p1), 'pay: a coin refund takes coins back, never below 0');
-- rewarded ads
set role authenticated;
select pg_temp.as_user(:p1);
select pg_temp.expect((select r->>'status' = 'granted' and (r->>'granted')::int = 30 and (r->'profile'->>'coins')::int = 30 and (r->'ads'->>'free_coins')::int = 1
  from claim_ad_reward('free_coins', 'f-1') r), 'ads: free coins +30');
select pg_temp.raises('select claim_ad_reward(''free_coins'', ''f-2'')', 'too_fast', 'ads: rewards at least 10 seconds apart');
select pg_temp.expect((select r->>'status' = 'already' and (r->>'granted')::int = 0 from claim_ad_reward('free_coins', 'f-1') r), 'ads: the same ref again grants nothing');
reset role; update ad_rewards set created_at = created_at - interval '1 minute'; set role authenticated;
select pg_temp.expect((select (r->>'granted')::int = 150 from claim_ad_reward('double_coins', 'm-1', 400) r), 'ads: double coins capped at 150');
reset role; update ad_rewards set created_at = created_at - interval '1 minute'; set role authenticated;
select pg_temp.expect((select (r->>'granted')::int = 60 and (r->'profile'->>'coins')::int = 240 from claim_ad_reward('double_coins', 'm-2', 60) r), 'ads: double coins gives the match''s coins');
select pg_temp.expect((select r->>'status' = 'already' and (r->'profile'->>'coins')::int = 240 from claim_ad_reward('double_coins', 'm-2', 60) r), 'ads: double coins once per match ref');
reset role; update ad_rewards set created_at = created_at - interval '1 minute'; set role authenticated;
select pg_temp.raises('select claim_ad_reward(''double_coins'', ''m-3'', 0)', 'bad_coins', 'ads: doubling needs coins earned');
select pg_temp.raises('select claim_ad_reward(''bonus'', ''x1'')', 'bad_placement', 'ads: unknown placement');
select pg_temp.raises('select claim_ad_reward(''free_coins'', ''<b>'')', 'bad_ref', 'ads: ref checked');
reset role;
insert into ad_rewards (user_id, placement, ref, coins, day, created_at)
  select :p1, 'free_coins', 'old-' || g, 30, (now() at time zone 'Asia/Ulaanbaatar')::date, now() - interval '1 hour' from generate_series(1, 4) g;
set role authenticated;
select pg_temp.raises('select claim_ad_reward(''free_coins'', ''f-6'')', 'daily_limit', 'ads: free coins 5 a day (Ulaanbaatar day)');
reset role; update ad_rewards set day = day - 1 where user_id = :p1 and placement = 'free_coins'; set role authenticated;
select pg_temp.expect((select (r->>'granted')::int = 30 from claim_ad_reward('free_coins', 'f-7') r), 'ads: a new day brings new free coins');
select pg_temp.expect((select (e->'ads'->>'free_coins')::int = 1 and (e->'ads'->>'double_coins')::int = 2 and (e->>'paid')::boolean
  and e->'skus' = '["pass_s1"]'::jsonb from my_entitlements() e), 'ads: my_entitlements counts today''s rewards');
select pg_temp.raises('insert into ad_rewards (user_id, placement, ref, coins, day) values (auth.uid(), ''free_coins'', ''zz'', 999, current_date)', 'permission denied%', 'pay: no direct ad reward inserts');
select pg_temp.raises('insert into entitlements (user_id, sku) values (auth.uid(), ''remove_ads'')', 'permission denied%', 'pay: no direct entitlement inserts');
select pg_temp.raises('update purchases set state = ''purchased''', 'permission denied%', 'pay: no direct purchase updates');
select pg_temp.expect((select count(*) = 2 from purchases) and (select count(*) = 2 from entitlements) and (select count(*) = 8 from ad_rewards), 'pay: players see only their own rows');
reset role;
set role anon;
select pg_temp.raises('select my_entitlements()', 'permission denied%', 'pay: anon cannot read entitlements');
select pg_temp.raises('select claim_ad_reward(''free_coins'', ''a1'')', 'permission denied%', 'pay: anon cannot claim ad rewards');
reset role;
set role authenticated;
select pg_temp.as_user(:p1);
select delete_my_account();
reset role;
select pg_temp.expect(not exists (select 1 from purchases where purchase_token = 'tok-pass-s1-01') and not exists (select 1 from ad_rewards where user_id = :p1)
  and not exists (select 1 from entitlements where user_id = :p1), 'pay: deleting the account removes its purchases, rewards and entitlements');
-- ================================================================ end of payments and ads
-- ================================================================ progression (20261118100000_progression.sql)
-- XP, levels, daily missions, season pass, skin prices, match coin cap, private profile columns.
\set u5 '''88888888-8888-8888-8888-888888888888'''
\set u6 '''99999999-9999-9999-9999-999999999999'''
\set u7 '''bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'''
reset role;
insert into auth.users (id, raw_user_meta_data) values (:u5, '{"username":"Сүх"}'), (:u6, '{"username":"Нараа"}'), (:u7, '{"username":"Оюу"}');
create or replace function pg_temp.p(u uuid) returns public.profiles language sql as $$ select * from public.profiles where id = u $$;
create or replace function pg_temp.today() returns text language sql as $$ select public.ub_today()::text $$;

-- rules, the same numbers as src/js/56-progress.js
select pg_temp.expect(xp_level(0) = 1 and xp_level(99) = 1 and xp_level(100) = 2 and xp_level(219) = 2 and xp_level(220) = 3 and xp_level(1620) = 10 and xp_level(10000000) = 99, 'level curve: 100 + 20 (L - 1) XP per level, up to 99');
select pg_temp.expect(level_coins(2) = 25 and level_coins(10) = 150 and level_coins(20) = 150, 'level coins: 25, 150 every tenth level');
select pg_temp.expect(match_xp('practice', true, false, 88, 95) = 34 and match_xp('practice', false, false, 88, 95) = 24 and match_xp('bot', true, false, 88, 95) = 49
  and match_xp('online', true, false, 90, 100) = 60 and match_xp('friend', false, false, 90, 100) = 20, 'match XP by mode, result and effort');
select pg_temp.expect(match_xp('bot', true, true, 240, 300) = 130 and match_xp('online', false, true, 600, 900) = 125 and match_xp('practice', true, false, 8, 6) = 9 and match_xp('online', true, false, 3, 0) = 0,
  'FT3 x2.5 with more effort; little time or few pieces cap the XP');
select pg_temp.expect(skin_price(0) = 0 and skin_price(2) = 100 and skin_price(3) = 300 and skin_price(8) = 600 and skin_price(9) = 1200 and skin_price(12) = 2500
  and skin_price(13) is null and skin_price(20) is null and skin_price(29) is null, 'skin prices: coin skins only');
select pg_temp.expect(pass_reward('s1', 10, false) = '{"skin":20}' and pass_reward('s1', 25, false) = '{"skin":21}' and pass_reward('s1', 1, true) = '{"skin":22}'
  and pass_reward('s1', 15, true) = '{"skin":23}' and pass_reward('s1', 30, true) = '{"skin":24}' and pass_reward('s2', 10, false) = '{"skin":25}'
  and pass_reward('s1', 2, false) = '{"coins":25}' and pass_reward('s1', 2, true) = '{"coins":50}', 'pass rewards: skins at free 10, 25 and premium 1, 15, 30, coins elsewhere');
select pg_temp.expect((select count(*) = 2 from seasons) and (select bool_and(ends > starts) from seasons), 'seasons table');

-- the shared entitlements block
set role authenticated;
select pg_temp.as_user(:u5);
select pg_temp.raises('insert into entitlements (user_id, sku) values (auth.uid(), ''pass_s1'')', 'permission denied%', 'no direct entitlement inserts');
select pg_temp.raises(format('select has_entitlement(%L, ''pass_s1'')', :u5), 'permission denied%', 'has_entitlement is not callable by players');

-- today's missions: one per tier, different kinds
select pg_temp.expect((select missions ->> 'day' = pg_temp.today() and xp = 0 and level = 1 from get_my_profile()), 'get_my_profile starts the day with missions');
reset role;
select pg_temp.expect((select array_agg(m.tier order by i) = '{0,1,2}' and count(distinct m.kind) = 3 from jsonb_array_elements((pg_temp.p(:u5)).missions -> 'list') with ordinality e(x, i) join mission_pool m on m.id = e.x ->> 'id'),
  'missions: easy, medium, hard of three kinds');
update profiles set missions = jsonb_build_object('day', ub_today()::text, 'rr', false, 'list', '[{"id":"play3","p":0,"c":false},{"id":"lines80","p":0,"c":false},{"id":"pps15","p":0,"c":false}]'::jsonb) where id = :u5;
set role authenticated;

-- a practice series: XP, first win of the day, a new level and its coins, season XP, missions
select pg_temp.expect((select xp = 133 and level = 2 and coins = 25 and xp_today = 133 and first_win_day::text = pg_temp.today()
  from report_progress('m-test-0001', 'practice', true, jsonb_build_object('time', 240, 'pieces', 300, 'lines', 50, 'ft', true, 'day', pg_temp.today()))),
  'practice FT3 win: 93 XP + 40 first win, level 2 pays 25 coins');
select pg_temp.expect((select (missions -> 'list' -> 0 ->> 'p')::int = 1 and (missions -> 'list' -> 1 ->> 'p')::int = 50 and (missions -> 'list' -> 2 ->> 'p')::int = 12 from get_my_profile()),
  'missions advance: play +1, lines +50, best PPS 1.2');
reset role;
select pg_temp.expect(coalesce((select ((pg_temp.p(:u5)).pass -> s.id ->> 'xp')::int = 133 from seasons s where ub_today() >= s.starts and ub_today() < s.ends), true), 'season XP follows match XP while a season runs');
set role authenticated;
select pg_temp.expect((select xp = 133 from report_progress('m-test-0001', 'practice', true, '{"time":900,"pieces":4000}')), 'the same ref again counts nothing');
select pg_temp.expect((select count(*) = 1 from progress_reports), 'one report row, own rows only');
select pg_temp.raises('select report_progress(''m-test-0002'', ''practice'', false, ''{"time":60,"pieces":60}'')', 'too_fast', 'practice and bot reports: one per 10 seconds');
reset role; update profiles set last_progress = null where id = :u5; set role authenticated;
select pg_temp.expect((select xp = 148 and coins = 25 from report_progress('m-test-0002', 'practice', true, '{"time":10,"pieces":999,"lines":999,"attack":99999}')),
  'made-up numbers are cut: 999 pieces in 10 s count as 60, XP 15, first win used');
select pg_temp.expect((select (missions -> 'list' -> 1 ->> 'p')::int = 50 from get_my_profile()), 'a report without today''s date counts XP only, no missions');
reset role; update profiles set last_progress = null where id = :u5; set role authenticated;
select pg_temp.expect((select (missions -> 'list' -> 2 ->> 'p')::int = 15 and (missions -> 'list' -> 0 ->> 'p')::int = 2
  from report_progress('m-test-0003', 'bot', false, jsonb_build_object('time', 60, 'pieces', 100, 'lines', 10, 'day', pg_temp.today()))), 'PPS mission done at 1.6 PPS (capped at its target)');
select pg_temp.raises('select report_progress(''m-test-0004'', ''ranked'', true, ''{}'')', 'bad_mode', 'unknown mode refused');
select pg_temp.raises('select report_progress(''x'', ''practice'', true, ''{}'')', 'bad_ref', 'bad ref refused');
reset role; update profiles set last_progress = null where id = :u5; set role authenticated;
select pg_temp.expect((select xp = 183 from report_progress('m-test-0005', 'practice', false, '{"time":"lots","pieces":[1],"ft":"yes"}')), 'non-numbers count as 0: a match with nothing in it gives no XP');

-- claiming and swapping missions
select pg_temp.raises('select claim_mission(0)', 'not_done', 'an unfinished mission cannot be claimed');
select pg_temp.raises('select claim_mission(5)', 'bad_slot', 'mission slots 0-2');
select pg_temp.expect((select coins = 80 and xp = 243 and level = 3 and (missions -> 'list' -> 2 ->> 'c')::boolean from claim_mission(2)), 'claim: medium mission pays 30 coins and 60 XP (level 3 adds 25 coins)');
select pg_temp.raises('select claim_mission(2)', 'already_claimed', 'a mission is claimed once');
select pg_temp.expect((select (missions ->> 'rr')::boolean and missions -> 'list' -> 0 ->> 'id' <> 'play3' and (missions -> 'list' -> 0 ->> 'p')::int = 0
  and (select tier = 0 and kind not in ('lines', 'pps') from mission_pool where id = missions -> 'list' -> 0 ->> 'id') from reroll_mission(0)), 'reroll: a fresh easy mission of another kind');
select pg_temp.raises('select reroll_mission(1)', 'already_rerolled', 'one free reroll a day');
-- a new day
reset role; update profiles set xp_day = ub_today() - 1, xp_today = 999, missions = jsonb_set(missions, '{day}', to_jsonb((ub_today() - 1)::text)) where id = :u5; set role authenticated;
select pg_temp.expect((select missions ->> 'day' = pg_temp.today() and not (missions ->> 'rr')::boolean and xp_today = 0 and jsonb_array_length(missions -> 'list') = 3 from get_my_profile()),
  'midnight (Ulaanbaatar): new missions, a new reroll, the daily XP count starts over');
-- daily XP cap
reset role; update profiles set xp_today = 2390, last_progress = null where id = :u5; set role authenticated;
select pg_temp.expect((select xp = 253 and xp_today = 2400 from report_progress('m-test-0006', 'bot', true, '{"time":120,"pieces":150}')), 'daily match XP cap 2400: only 10 more');
reset role; update profiles set last_progress = null where id = :u5; set role authenticated;
select pg_temp.expect((select xp = 253 from report_progress('m-test-0007', 'bot', true, '{"time":120,"pieces":150}')), 'nothing past the cap');

-- online and friend results come from the server's row
reset role;
insert into online_matches (id, player_a, player_b, format, target, seed, status, ranked, created_at)
values ('aaaaaaaa-0000-0000-0000-000000000001', :u5, :u6, 'single', 1, 1, 'active', true, now() - interval '100 seconds'),
       ('aaaaaaaa-0000-0000-0000-000000000002', :u5, :u6, 'ft3', 3, 1, 'finished', false, now() - interval '20 seconds'),
       ('aaaaaaaa-0000-0000-0000-000000000003', :u5, :u6, 'single', 1, 1, 'abandoned', true, now() - interval '50 seconds');
update online_matches set finished_at = now(), winner = :u5 where id = 'aaaaaaaa-0000-0000-0000-000000000002';
update profiles set xp_today = 0 where id = :u5;
set role authenticated;
select pg_temp.raises('select report_progress(''aaaaaaaa-0000-0000-0000-000000000001'', ''online'', true, ''{"time":90,"pieces":100}'')', 'not_finished', 'online: not before the server has the result');
reset role; update online_matches set status = 'finished', winner = :u6, finished_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000001'; set role authenticated;
select pg_temp.expect((select xp = 293 from report_progress('aaaaaaaa-0000-0000-0000-000000000001', 'online', true, '{"time":90,"pieces":100}')), 'online: a claimed win the server says was a loss counts as a loss (40 XP)');
select pg_temp.expect((select not won and mode = 'online' and xp = 40 from progress_reports where ref = 'aaaaaaaa-0000-0000-0000-000000000001'), 'stored as an online loss');
select pg_temp.expect((select xp = 323 from report_progress('aaaaaaaa-0000-0000-0000-000000000002', 'online', false, '{"time":900,"pieces":999}')),
  'friend result: mode, winner and length from the server (20 s, so at most 30 XP), no rate limit');
select pg_temp.expect((select won and mode = 'friend' from progress_reports where ref = 'aaaaaaaa-0000-0000-0000-000000000002'), 'stored as a friendly win');
select pg_temp.raises('select report_progress(''aaaaaaaa-0000-0000-0000-000000000003'', ''online'', true, ''{}'')', 'bad_match', 'an abandoned match gives no XP');
select pg_temp.raises('select report_progress(''m-not-a-uuid'', ''online'', true, ''{}'')', 'bad_ref', 'online refs are match ids');
select pg_temp.as_user(:u7);
select pg_temp.raises('select report_progress(''aaaaaaaa-0000-0000-0000-000000000001'', ''online'', true, ''{}'')', 'not_your_match', 'only the two players report a match');

-- season pass
select pg_temp.as_user(:u5);
reset role; update profiles set pass = '{"s1":{"xp":3600,"f":[],"p":[]}}', coins = 0, owned = '{0,21}' where id = :u5; set role authenticated;
select pg_temp.expect((select coins = 25 and pass -> 's1' -> 'f' = '[1]' from claim_pass_tier('s1', 1, false)), 'free tier 1: 25 coins');
select pg_temp.raises('select claim_pass_tier(''s1'', 1, false)', 'already_claimed', 'a tier is claimed once');
select pg_temp.raises('select claim_pass_tier(''s1'', 11, false)', 'not_reached', 'tier 11 needs 3850 season XP');
select pg_temp.expect((select owned = '{0,21,20}' and coins = 25 from claim_pass_tier('s1', 10, false)), 'free tier 10: the season skin 20');
select pg_temp.raises('select claim_pass_tier(''s1'', 1, true)', 'no_pass', 'premium needs the pass_s1 purchase');
reset role; insert into entitlements (user_id, sku, source) values (:u5, 'pass_s1', 'grant'); set role authenticated;
select pg_temp.expect((select owned = '{0,21,20,22}' and pass -> 's1' -> 'p' = '[1]' from claim_pass_tier('s1', 1, true)), 'premium tier 1 with the pass: skin 22');
select pg_temp.expect((select coins = 75 from claim_pass_tier('s1', 2, true)), 'premium tier 2: 50 coins');
reset role; update entitlements set revoked_at = now() where user_id = :u5; update profiles set pass = jsonb_set(pass, '{s1,xp}', '9000') where id = :u5; set role authenticated;
select pg_temp.raises('select claim_pass_tier(''s1'', 3, true)', 'no_pass', 'a refunded (revoked) pass unlocks nothing');
select pg_temp.expect((select coins = 175 and owned = '{0,21,20,22}' from claim_pass_tier('s1', 25, false)), 'a skin already owned pays 100 coins instead');
select pg_temp.raises('select claim_pass_tier(''zz'', 1, false)', 'bad_season', 'unknown season');
select pg_temp.raises('select claim_pass_tier(''s1'', 31, false)', 'bad_tier', 'tiers 1-30');
select pg_temp.as_user(:u6);
select pg_temp.raises('select claim_pass_tier(''s1'', 1, false)', 'not_reached', 'no season XP, no rewards');

-- skins: coin skins for their price, season skins only from the pass
reset role; update profiles set coins = 1000 where id = :u6; set role authenticated;
select pg_temp.expect((select theme = 3 and coins = 700 and owned = '{0,3}' from buy_theme(3)), 'buy a 300-coin skin');
select pg_temp.expect((select theme = 6 and coins = 100 from buy_theme(6)), 'buy a 600-coin skin');
select pg_temp.raises('select buy_theme(11)', 'not_enough_coins', 'a 2500-coin skin needs 2500 coins');
select pg_temp.raises('select buy_theme(20)', 'not_for_sale', 'season skins are not sold for coins');
select pg_temp.raises('select buy_theme(15)', 'bad_theme', 'an unknown id in range');
select pg_temp.raises('select buy_theme(40)', 'bad_theme', 'ids above 39');
select pg_temp.expect((select theme = 3 and coins = 100 from buy_theme(3)), 'an owned skin is equipped for free');
select pg_temp.as_user(:u5);
select pg_temp.expect((select theme = 22 from buy_theme(22)), 'a season skin from the pass can be equipped');
select pg_temp.expect((select theme = 20 from set_profile(null, null, 20)), 'and chosen in the profile');
select pg_temp.as_user(:u7);
select pg_temp.expect((select owned = '{0,3,12}' and coins = 100 from import_local(1000, 1, 0, 100, '{3,12,20,15}')), 'import keeps coin skins, drops season and unknown ids');
select pg_temp.expect((select xp = 6000 and level = xp_level(6000) and progress_imported from import_progress(9000, 's1', 9000)), 'offline XP imported once, capped at 6000');
select pg_temp.expect((select xp = 6000 from import_progress(100, 's1', 100)), 'XP import only once');
reset role;
select pg_temp.expect(coalesce((select ((pg_temp.p(:u7)).pass -> s.id ->> 'xp')::int = 6000 from seasons s where s.id = 's1' and ub_today() >= s.starts and ub_today() < s.ends), true), 'season XP imported for the running season');

-- match coins: 30 / 10 now, and at most 600 a day from practice and bot reports
insert into matches (user_id, kind, format, opponent, won, score_me, score_foe, rating_before, rating_after, coins)
select :u7, 'ai', 'single', 'NOVA', true, 1, 0, 1000, 1000, 59 from generate_series(1, 10);
set role authenticated;
select pg_temp.expect((select coins = 110 from report_match('ai', 'NOVA', 1000, 'single', true, 1, 0)), 'self-reported coins stop at 600 a day (590 earned: +10)');
reset role; update profiles set last_report = null where id = :u7; set role authenticated;
select pg_temp.expect((select coins = 110 from report_match('ai', 'NOVA', 1000, 'single', true, 1, 0)), 'then 0');
reset role;
insert into online_matches (id, player_a, player_b, format, target, seed) values ('aaaaaaaa-0000-0000-0000-000000000004', :u6, :u7, 'single', 1, 1);
create temp table coins_before as select id, coins from profiles where id in (:u6, :u7);
set role authenticated;
select pg_temp.expect((select status = 'finished' and winner = :u6 from report_online_game('aaaaaaaa-0000-0000-0000-000000000004', 1)), 'online game reported by the loser');
reset role;
select pg_temp.expect((select p.coins - b.coins = 30 from profiles p join coins_before b using (id) where p.id = :u6) and (select p.coins - b.coins = 10 from profiles p join coins_before b using (id) where p.id = :u7),
  'online series coins: 30 for the winner, 10 for the loser');

-- privacy: everyone sees display columns only; players reach their own row through the functions
set role authenticated;
select pg_temp.as_user(:u5);
select pg_temp.expect((select count(*) > 0 from (select id, username, avatar, rating, wins, losses, theme, level from profiles) x), 'display columns are readable');
select pg_temp.raises('select coins from profiles', 'permission denied%', 'other columns are not (coins)');
select pg_temp.raises('select * from profiles', 'permission denied%', 'select * is refused');
select pg_temp.raises('select missions, pass, xp from profiles where id = auth.uid()', 'permission denied%', 'not even one''s own progress directly');
select pg_temp.expect((select coins >= 0 and xp > 0 from get_my_profile()), 'own row through get_my_profile');
select pg_temp.expect((select count(*) >= 0 from leaderboard), 'leaderboard still readable');
select pg_temp.raises('select grant_xp(auth.uid(), 100000)', 'permission denied%', 'grant_xp is not callable by players');
select pg_temp.raises('select progress_day(auth.uid())', 'permission denied%', 'progress_day is not callable by players');
select pg_temp.raises('insert into progress_reports (user_id, ref, mode, won, xp) values (auth.uid(), ''zzzzzzzz'', ''bot'', true, 9999)', 'permission denied%', 'no direct report inserts');
select pg_temp.raises('update seasons set ends = ''2099-01-01''', 'permission denied%', 'seasons are read-only');
set role anon;
select pg_temp.raises('select coins from profiles', 'permission denied%', 'anon: no private columns');
select pg_temp.expect((select count(*) >= 0 from leaderboard), 'anon: leaderboard readable');
select pg_temp.raises('select report_progress(''m-test-9999'', ''practice'', true, ''{}'')', 'permission denied%', 'anon cannot report progress');
select pg_temp.raises('select claim_pass_tier(''s1'', 1, false)', 'permission denied%', 'anon cannot claim pass tiers');
reset role;
-- ================================================================ end of progression
\echo ALL TESTS PASSED
