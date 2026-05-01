do $$
begin
  if not exists (select 1 from pg_type where typname = 'wallet_entry_direction') then
    create type wallet_entry_direction as enum ('credit', 'debit');
  end if;
end $$;

alter table users
  add column if not exists referral_code text,
  add column if not exists referred_by_user_id integer;

update users
set referral_code = upper(substr(md5(id::text || email || created_at::text), 1, 10))
where referral_code is null;

alter table users
  alter column referral_code set not null;

create unique index if not exists users_email_idx on users(email);
create unique index if not exists users_username_idx on users(username);
create unique index if not exists users_free_fire_uid_idx on users(free_fire_uid);
create unique index if not exists users_referral_code_idx on users(referral_code);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_referred_by_user_fk') then
    alter table users
      add constraint users_referred_by_user_fk
      foreign key (referred_by_user_id) references users(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'users_coin_balance_nonneg') then
    alter table users
      add constraint users_coin_balance_nonneg check (coin_balance >= 0);
  end if;
end $$;

create table if not exists wallet_entries (
  id serial primary key,
  user_id integer not null references users(id) on delete restrict,
  direction wallet_entry_direction not null,
  amount integer not null,
  balance_after integer not null,
  reason text not null,
  source_type text not null,
  source_id text not null,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists wallet_entries_idempotency_idx on wallet_entries(idempotency_key);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'wallet_entries_amount_positive') then
    alter table wallet_entries
      add constraint wallet_entries_amount_positive check (amount > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'wallet_entries_balance_nonneg') then
    alter table wallet_entries
      add constraint wallet_entries_balance_nonneg check (balance_after >= 0);
  end if;
end $$;

create table if not exists audit_events (
  id serial primary key,
  actor_user_id integer references users(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  ip_hash text,
  user_agent text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_created_idx on audit_events(created_at);
create index if not exists audit_events_event_type_idx on audit_events(event_type);

create table if not exists referral_rewards (
  id serial primary key,
  referrer_user_id integer not null references users(id) on delete restrict,
  referred_user_id integer not null references users(id) on delete restrict,
  wallet_entry_id integer not null references wallet_entries(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index if not exists referral_rewards_referred_user_idx on referral_rewards(referred_user_id);
create unique index if not exists referral_rewards_referrer_pair_idx on referral_rewards(referrer_user_id, referred_user_id);

create table if not exists watch_reward_videos (
  id serial primary key,
  title text not null,
  description text not null,
  video_url text not null,
  thumbnail_url text,
  duration_seconds integer not null,
  reward_coins integer not null,
  cooldown_hours integer not null default 24,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'watch_reward_videos_duration_range') then
    alter table watch_reward_videos
      add constraint watch_reward_videos_duration_range check (duration_seconds between 30 and 60);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'watch_reward_videos_reward_range') then
    alter table watch_reward_videos
      add constraint watch_reward_videos_reward_range check (reward_coins between 10 and 20);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'watch_reward_videos_cooldown_nonneg') then
    alter table watch_reward_videos
      add constraint watch_reward_videos_cooldown_nonneg check (cooldown_hours >= 0);
  end if;
end $$;

create table if not exists watch_reward_sessions (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  video_id integer not null references watch_reward_videos(id) on delete cascade,
  session_token text not null,
  unlocks_at timestamptz not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  wallet_entry_id integer references wallet_entries(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists watch_reward_sessions_token_idx on watch_reward_sessions(session_token);

create table if not exists app_sessions (
  sid text primary key,
  sess jsonb not null,
  expire timestamptz not null
);

create index if not exists app_sessions_expire_idx on app_sessions(expire);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'matches_winner_user_fk') then
    alter table matches
      add constraint matches_winner_user_fk
      foreign key (winner_user_id) references users(id) on delete set null;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'match_participants_match_fk') then
    alter table match_participants
      add constraint match_participants_match_fk
      foreign key (match_id) references matches(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'match_participants_user_fk') then
    alter table match_participants
      add constraint match_participants_user_fk
      foreign key (user_id) references users(id) on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'coupons_user_fk') then
    alter table coupons
      add constraint coupons_user_fk
      foreign key (user_id) references users(id) on delete restrict;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'admin_logs_admin_user_fk') then
    alter table admin_logs
      add constraint admin_logs_admin_user_fk
      foreign key (admin_user_id) references users(id) on delete restrict;
  end if;
end $$;
