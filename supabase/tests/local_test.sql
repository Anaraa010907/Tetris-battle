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
select pg_temp.expect((select rating = 1000 and wins = 0 and losses = 0 and coins = 60 from report_match('ai', 'NOVA', 1250, 'single', true, 1, 0, '{"pps":1.2}')), 'practice win: coins only, no rank or record');
do $$ begin perform report_match('bot', 'Kairo', 1010, 'single', true, 1, 0); raise exception 'no rate limit';
exception when others then if sqlerrm <> 'too_fast' then raise; end if; raise notice 'ok: rate limit'; end $$;
reset role; update profiles set last_report = null; set role authenticated;
do $$ begin perform report_match('bot', 'Kairo', 1010, 'ft3', true, 2, 0); raise exception 'bad score accepted';
exception when others then if sqlerrm <> 'bad_score' then raise; end if; raise notice 'ok: score validated'; end $$;
do $$ begin perform report_match('bot', 'Kairo', 1500, 'single', true, 1, 0); raise exception 'far bot accepted';
exception when others then if sqlerrm <> 'bad_opponent' then raise; end if; raise notice 'ok: ranked bot must be near the player rating'; end $$;
select pg_temp.expect((select rating = 1012 and wins = 1 and coins = 120 from report_match('bot', 'Kairo', 1010, 'single', true, 1, 0)), 'ranked bot win near own rating: +12 RP');
do $$ begin update profiles set rating = 3000 where id = auth.uid(); raise exception 'direct update allowed';
exception when insufficient_privilege then raise notice 'ok: no direct writes'; end $$;
do $$ begin insert into matches (user_id, kind, format, opponent, won, score_me, score_foe, rating_before, rating_after)
  values (auth.uid(), 'ai', 'single', 'x', true, 1, 0, 1, 9999); raise exception 'direct insert allowed';
exception when insufficient_privilege then raise notice 'ok: no direct match inserts'; end $$;

select pg_temp.expect((select coins = 130 and streak = 1 from claim_daily()), 'daily bonus +10');
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
select pg_temp.expect((select rating = 1400 and wins = 6 and coins = 2000 and owned = '{0,1,2}' and imported from import_local(1800, 6, 2, 9999, '{2,7,1}')), 'one-time import with caps');
select pg_temp.expect((select rating = 1400 from import_local(1000, 0, 0, 0, '{}')), 'import only once');
select pg_temp.expect((select rating = 1400 and wins = 7 and coins = 2150 from report_match('bot', 'Vega', 1390, 'ft3', true, 3, 1)), 'bot wins give no RP from 1400 up');
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
\echo ALL TESTS PASSED
