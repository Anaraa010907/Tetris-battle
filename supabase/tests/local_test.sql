-- Exercises the migration on plain Postgres (after local_stub.sql). Every check raises on failure.
\set ON_ERROR_STOP on
create or replace function pg_temp.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', coalesce(u::text, ''), false); end $$;
create or replace function pg_temp.expect(ok boolean, what text) returns void language plpgsql as $$
begin if not ok then raise exception 'FAILED: %', what; end if; raise notice 'ok: %', what; end $$;

insert into auth.users (id, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', '{"username":"Анар"}'),
  ('22222222-2222-2222-2222-222222222222', '{}'),
  ('33333333-3333-3333-3333-333333333333', '{"username":"анар"}'),
  ('44444444-4444-4444-4444-444444444444', '{"username":"<x>"}');

select pg_temp.expect((select username from profiles where id = '11111111-1111-1111-1111-111111111111') = 'Анар', 'profile created with the requested name');
select pg_temp.expect((select username from profiles where id = '22222222-2222-2222-2222-222222222222') = 'NOMAD', 'default name');
select pg_temp.expect((select username ~ '^анар[0-9]{4}$' from profiles where id = '33333333-3333-3333-3333-333333333333'), 'duplicate name (any case) gets a number');
select pg_temp.expect((select username ~ '^NOMAD' from profiles where id = '44444444-4444-4444-4444-444444444444'), 'unsafe name replaced');
select pg_temp.expect(rank_letter(1000) = 'B-' and rank_title(1000) = 'Харцага' and rank_letter(2100) = 'X' and rank_title(600) = 'Шинэ бөх', 'rank helpers');

-- ---------------------------------------------------------------- as player 1
set role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.expect((select rating from get_my_profile()) = 1000, 'get_my_profile');
select pg_temp.expect((select rating = 1012 and wins = 1 and coins = 60 from report_match('ai', 'NOVA', 1000, 'single', true, 1, 0, '{"pps":1.2}')), 'single win vs 1000: +12 RP, +60 coins');
do $$ begin perform report_match('ai', 'NOVA', 1000, 'single', true, 1, 0); raise exception 'no rate limit';
exception when others then if sqlerrm <> 'too_fast' then raise; end if; raise notice 'ok: rate limit'; end $$;
do $$ begin perform report_match('ai', 'NOVA', 1000, 'ft3', true, 2, 0); raise exception 'bad score accepted';
exception when others then if sqlerrm not in ('bad_score', 'too_fast') then raise; end if; raise notice 'ok: score validated'; end $$;
do $$ begin perform report_match('ai', 'NOVA', 3000, 'single', true, 1, 0); raise exception 'bad opponent accepted';
exception when others then if sqlerrm not in ('bad_opponent') then raise; end if; raise notice 'ok: opponent rating validated'; end $$;
do $$ begin update profiles set rating = 3000 where id = auth.uid(); raise exception 'direct update allowed';
exception when insufficient_privilege then raise notice 'ok: no direct writes'; end $$;
do $$ begin insert into matches (user_id, kind, format, opponent, won, score_me, score_foe, rating_before, rating_after)
  values (auth.uid(), 'ai', 'single', 'x', true, 1, 0, 1, 9999); raise exception 'direct insert allowed';
exception when insufficient_privilege then raise notice 'ok: no direct match inserts'; end $$;

select pg_temp.expect((select coins = 70 and streak = 1 from claim_daily()), 'daily bonus +10');
do $$ begin perform claim_daily(); raise exception 'claimed twice';
exception when others then if sqlerrm <> 'already_claimed' then raise; end if; raise notice 'ok: daily once per day'; end $$;
do $$ begin perform buy_theme(1); raise exception 'bought without coins';
exception when others then if sqlerrm <> 'not_enough_coins' then raise; end if; raise notice 'ok: theme needs 100 coins'; end $$;
select pg_temp.expect((select theme = 0 from buy_theme(0)), 'owned theme can be equipped');
select pg_temp.expect((select wins = 1 and not imported from import_local(1400, 99, 0, 5000, '{1,2}')), 'import ignored after games were played');
do $$ begin perform set_profile('анар1234', null, null); exception when others then raise notice 'name check: %', sqlerrm; end $$;
select pg_temp.expect((select username = 'Хаан' and avatar = '⚡' from set_profile('Хаан', '⚡', 2)), 'rename + avatar (unowned theme ignored)');
do $$ begin perform set_profile('NOMAD', null, null); raise exception 'duplicate name allowed';
exception when others then if sqlerrm <> 'username_taken' then raise; end if; raise notice 'ok: unique names'; end $$;
select pg_temp.expect((select count(*) = 1 from matches), 'player sees only own matches');

-- ---------------------------------------------------------------- as player 2: import, ft3 vs Hard AI
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.expect((select rating = 1400 and wins = 6 and coins = 2000 and owned = '{0,1,2}' and imported from import_local(1800, 6, 2, 9999, '{2,7,1}')), 'one-time import with caps');
select pg_temp.expect((select rating = 1400 from import_local(1000, 0, 0, 0, '{}')), 'import only once');
select pg_temp.expect((select rating = 1372 and losses = 3 and coins = 2040 from report_match('ai', 'NOVA', 1250, 'ft3', false, 1, 3)), 'FT3 loss vs 1250 at 1400: -28 RP, +40 coins');
select pg_temp.expect((select count(*) >= 1 from leaderboard), 'leaderboard shows placed players');
select pg_temp.expect(my_position() = 1, 'position on leaderboard');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.expect(my_position() is null, 'unplaced player has no position');

-- ---------------------------------------------------------------- online matchmaking
select pg_temp.expect((select m.id is null from find_match('single') m), 'first player waits in queue');
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.expect((select m.id is not null from find_match('single') m), 'second player close in rating is paired');
select pg_temp.expect((select count(*) = 1 from online_matches), 'players see their match');
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.expect((select player_a = '11111111-1111-1111-1111-111111111111' from find_match('single')), 'waiting player gets the same match');
select pg_temp.as_user('22222222-2222-2222-2222-222222222222');
select pg_temp.expect((select count(*) = 0 from online_matches), 'others cannot see the match');
do $$ begin perform report_online_game((select id from online_matches limit 1)); raise exception 'outsider reported';
exception when others then if sqlerrm <> 'not_your_match' then raise; end if; raise notice 'ok: only players report'; end $$;
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.expect((select status = 'finished' and winner = player_a from report_online_game((select id from online_matches limit 1))), 'loser reports, series ends');
reset role;
select pg_temp.expect((select rating from profiles where id = '11111111-1111-1111-1111-111111111111') = 1024
  and (select rating from profiles where id = '33333333-3333-3333-3333-333333333333') = 988, 'online Elo applied to both players');
select pg_temp.expect((select count(*) = 3 from matches where kind = 'online' or user_id = '22222222-2222-2222-2222-222222222222'), 'online history rows');

-- abandoned online match: the silent player loses
set role authenticated;
select pg_temp.as_user('11111111-1111-1111-1111-111111111111');
select pg_temp.expect((select m.id is null from find_match('ft3') m), 'ft3 queue');
select pg_temp.as_user('33333333-3333-3333-3333-333333333333');
select pg_temp.expect((select target = 3 from find_match('ft3')), 'ft3 match created');
select pg_temp.expect((select seen_b > now() - interval '5 seconds' from ping_match((select id from online_matches where status = 'active'))), 'heartbeat');
do $$ begin perform claim_abandoned((select id from online_matches where status = 'active')); raise exception 'claimed while opponent active';
exception when others then if sqlerrm <> 'opponent_active' then raise; end if; raise notice 'ok: cannot claim an active opponent'; end $$;
reset role;
update online_matches set seen_a = now() - interval '1 minute' where status = 'active';
set role authenticated;
select pg_temp.expect((select status = 'finished' and winner = player_b from claim_abandoned((select id from online_matches where format = 'ft3'))), 'silent player loses the series');
reset role;

-- account deletion
set role authenticated;
select pg_temp.as_user('44444444-4444-4444-4444-444444444444');
select delete_my_account();
reset role;
select pg_temp.expect(not exists (select 1 from profiles where id = '44444444-4444-4444-4444-444444444444')
  and not exists (select 1 from auth.users where id = '44444444-4444-4444-4444-444444444444'), 'delete_my_account removes user and profile');

-- anon cannot call game functions
set role anon;
do $$ begin perform report_match('ai', 'NOVA', 1000, 'single', true, 1, 0); raise exception 'anon reported';
exception when insufficient_privilege then raise notice 'ok: anon blocked'; end $$;
reset role;
\echo ALL TESTS PASSED
