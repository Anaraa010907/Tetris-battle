-- Khan Blocks: payments and ads. Run after 20261117000000_khan_titles.sql (safe to run again).
--
--   * Google Play purchases are checked by the verify-purchase Edge Function (supabase/functions/) against the
--     Google Play Developer API. Only that function, with the service role, may call record_purchase and
--     revoke_purchase; players cannot.
--   * Non-consumables (remove_ads, pass_<season>, e.g. pass_s1) become rows in public.entitlements (the block
--     shared with the progression migration). Coin packs (coins_small 500, coins_medium 1200, coins_large 3500)
--     add coins to profiles.coins and never become entitlement rows.
--   * One grant per purchase token (purchases.purchase_token is unique): a retried call grants nothing new.
--     Restoring a non-consumable on another account of the same Google account moves it there.
--     A refund or voided purchase revokes the entitlement, or takes the coins back (never below 0).
--   * Rewarded ads: claim_ad_reward(placement, ref, coins), capped per Ulaanbaatar day and placement:
--     'free_coins' gives 30 coins, 5 a day; 'double_coins' gives the coins the match earned (sent by the
--     client, at most 150), once per match ref, 10 a day. At least 10 seconds between two rewards.
--   * remove_ads is only an entitlement; the client decides which ads to skip (src/js/55-store.js).
--   * This migration adds no columns to profiles; its state lives in purchases, ad_rewards and entitlements.

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

-- ============================================================ purchases log and ad rewards
create table if not exists public.purchases (
  id             bigint generated always as identity primary key,
  user_id        uuid        not null references public.profiles (id) on delete cascade,
  sku            text        not null,
  kind           text        not null check (kind in ('entitlement', 'coins')),
  coins          integer     not null default 0 check (coins >= 0),
  purchase_token text        not null unique,
  order_id       text,
  state          text        not null default 'purchased' check (state in ('purchased', 'revoked')),
  test           boolean     not null default false,
  purchased_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  revoked_at     timestamptz,
  revoke_reason  text
);
create index if not exists purchases_user on public.purchases (user_id, created_at desc);

create table if not exists public.ad_rewards (
  id         bigint generated always as identity primary key,
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  placement  text        not null check (placement in ('free_coins', 'double_coins')),
  ref        text        not null,
  coins      integer     not null check (coins > 0),
  day        date        not null,
  created_at timestamptz not null default now(),
  unique (user_id, placement, ref)
);
create index if not exists ad_rewards_user_day on public.ad_rewards (user_id, day);

alter table public.purchases  enable row level security;
alter table public.ad_rewards enable row level security;
drop policy if exists "own purchases" on public.purchases;
create policy "own purchases" on public.purchases for select to authenticated using (user_id = auth.uid());
drop policy if exists "own ad rewards" on public.ad_rewards;
create policy "own ad rewards" on public.ad_rewards for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.purchases, public.ad_rewards from anon, authenticated;

-- ============================================================ products (same table as COIN_PACKS in 55-store.js)
-- 'coins' for a coin pack, 'entitlement' for remove_ads and season passes, null for anything else.
create or replace function public.sku_kind(p_sku text) returns text
language sql immutable as $$
  select case when p_sku in ('coins_small', 'coins_medium', 'coins_large') then 'coins'
              when p_sku = 'remove_ads' or p_sku ~ '^pass_[a-z0-9]{1,16}$' then 'entitlement' end
$$;
create or replace function public.sku_coins(p_sku text) returns integer
language sql immutable as $$
  select case p_sku when 'coins_small' then 500 when 'coins_medium' then 1200 when 'coins_large' then 3500 else 0 end
$$;

-- What the client needs after any change: active entitlements, whether the player ever paid (no
-- interstitials then), and today's rewarded-ad counts.
create or replace function public.store_state(p_user uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'skus', coalesce((select jsonb_agg(e.sku order by e.sku) from entitlements e
                      where e.user_id = p_user and e.revoked_at is null), '[]'::jsonb),
    'paid', exists (select 1 from purchases p where p.user_id = p_user and p.state = 'purchased'),
    'day', (now() at time zone 'Asia/Ulaanbaatar')::date,
    'ads', jsonb_build_object(
      'free_coins', (select count(*) from ad_rewards a where a.user_id = p_user and a.placement = 'free_coins'
                       and a.day = (now() at time zone 'Asia/Ulaanbaatar')::date),
      'double_coins', (select count(*) from ad_rewards a where a.user_id = p_user and a.placement = 'double_coins'
                         and a.day = (now() at time zone 'Asia/Ulaanbaatar')::date)),
    'limits', jsonb_build_object('free_coins', 5, 'double_coins', 10))
$$;

-- ============================================================ for the verify-purchase Edge Function only
-- Records a purchase that the function has verified with Google Play and grants it, once per token.
-- p_restore: the player asked to restore purchases; a non-consumable recorded for another account of this
-- Google account then moves to the caller (it belongs to the Google account, not the game account).
create or replace function public.record_purchase(
  p_user uuid, p_sku text, p_token text, p_order_id text, p_purchased_at timestamptz,
  p_test boolean default false, p_restore boolean default false)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  k text := sku_kind(p_sku);
  c integer := sku_coins(p_sku);
  pr purchases;
  me profiles;
  st text;
begin
  if k is null then raise exception 'bad_sku'; end if;
  if p_token is null or char_length(p_token) not between 10 and 4096 then raise exception 'bad_token'; end if;
  perform 1 from profiles where id = p_user for update;
  if not found then raise exception 'no_profile'; end if;
  select * into pr from purchases where purchase_token = p_token for update;
  if found then
    if pr.sku <> p_sku then raise exception 'token_mismatch'; end if;
    if pr.state = 'revoked' then raise exception 'purchase_revoked'; end if;
    if pr.user_id = p_user then
      st := 'already';
    elsif k = 'entitlement' and p_restore then
      update entitlements set revoked_at = now(), purchase_token = null where purchase_token = p_token;
      update purchases set user_id = p_user, updated_at = now() where id = pr.id;
      st := 'transferred';
    else
      raise exception 'token_used';
    end if;
  else
    insert into purchases (user_id, sku, kind, coins, purchase_token, order_id, test, purchased_at)
    values (p_user, p_sku, k, c, p_token, left(p_order_id, 64), coalesce(p_test, false), p_purchased_at);
    if k = 'coins' then
      update profiles set coins = coins + c, updated_at = now() where id = p_user;
    end if;
    st := 'granted';
  end if;
  if k = 'entitlement' and st <> 'already' then
    insert into entitlements (user_id, sku, source, order_id, purchase_token, granted_at, revoked_at)
    values (p_user, p_sku, 'play', left(p_order_id, 64), p_token, now(), null)
    on conflict (user_id, sku) do update
      set source = 'play', order_id = excluded.order_id, purchase_token = excluded.purchase_token,
          granted_at = now(), revoked_at = null;
  end if;
  select * into me from profiles where id = p_user;
  return jsonb_build_object('status', st, 'sku', p_sku, 'kind', k,
                            'coins', case when st = 'granted' and k = 'coins' then c else 0 end,
                            'profile', to_jsonb(me)) || store_state(p_user);
end $$;

-- A refunded, charged-back or otherwise voided purchase (voided-purchases function): the entitlement is
-- revoked, or the pack's coins are taken back as far as the player still has them.
create or replace function public.revoke_purchase(p_token text, p_reason text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pr purchases;
begin
  select * into pr from purchases where purchase_token = p_token for update;
  if not found then return jsonb_build_object('status', 'unknown'); end if;
  if pr.state = 'revoked' then return jsonb_build_object('status', 'already', 'sku', pr.sku); end if;
  update purchases set state = 'revoked', revoked_at = now(), revoke_reason = left(p_reason, 64), updated_at = now()
   where id = pr.id;
  if pr.kind = 'coins' then
    update profiles set coins = greatest(0, coins - pr.coins), updated_at = now() where id = pr.user_id;
  else
    update entitlements set revoked_at = now() where purchase_token = p_token and revoked_at is null;
  end if;
  return jsonb_build_object('status', 'revoked', 'sku', pr.sku, 'user_id', pr.user_id);
end $$;

-- ============================================================ for the client
create or replace function public.my_entitlements() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  return store_state(auth.uid());
end $$;

-- A rewarded ad the player chose to watch to the end. The client asks only after the ad's reward callback.
create or replace function public.claim_ad_reward(p_placement text, p_ref text, p_coins integer default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me profiles;
  today date := (now() at time zone 'Asia/Ulaanbaatar')::date;
  cap integer;
  n integer;
  amount integer;
  last_at timestamptz;
begin
  select * into me from profiles where id = auth.uid() for update;
  if not found then raise exception 'not_signed_in' using errcode = '28000'; end if;
  if p_placement is null or p_placement not in ('free_coins', 'double_coins') then raise exception 'bad_placement'; end if;
  if p_ref is null or p_ref !~ '^[A-Za-z0-9_.:-]{1,64}$' then raise exception 'bad_ref'; end if;
  cap := case p_placement when 'free_coins' then 5 else 10 end;
  if exists (select 1 from ad_rewards where user_id = me.id and placement = p_placement and ref = p_ref) then
    return jsonb_build_object('status', 'already', 'granted', 0, 'profile', to_jsonb(me)) || store_state(me.id);
  end if;
  select count(*) into n from ad_rewards where user_id = me.id and placement = p_placement and day = today;
  if n >= cap then raise exception 'daily_limit'; end if;
  select max(created_at) into last_at from ad_rewards where user_id = me.id;
  if last_at is not null and now() - last_at < interval '10 seconds' then raise exception 'too_fast'; end if;
  amount := case p_placement when 'free_coins' then 30 else least(greatest(coalesce(p_coins, 0), 0), 150) end;
  if amount <= 0 then raise exception 'bad_coins'; end if;
  insert into ad_rewards (user_id, placement, ref, coins, day) values (me.id, p_placement, p_ref, amount, today);
  update profiles set coins = coins + amount, updated_at = now() where id = me.id returning * into me;
  return jsonb_build_object('status', 'granted', 'granted', amount, 'profile', to_jsonb(me)) || store_state(me.id);
end $$;

-- ============================================================ privileges
revoke execute on function public.sku_kind(text), public.sku_coins(text), public.store_state(uuid),
  public.record_purchase(uuid, text, text, text, timestamptz, boolean, boolean), public.revoke_purchase(text, text)
  from public, anon, authenticated;
grant execute on function public.record_purchase(uuid, text, text, text, timestamptz, boolean, boolean),
  public.revoke_purchase(text, text) to service_role;
revoke execute on function public.my_entitlements(), public.claim_ad_reward(text, text, integer) from public, anon;
grant execute on function public.my_entitlements(), public.claim_ad_reward(text, text, integer) to authenticated;
