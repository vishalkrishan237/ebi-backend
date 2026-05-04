create table if not exists users (
  id serial primary key,
  username text not null,
  email text not null,
  free_fire_uid text not null,
  password_hash text not null,
  referral_code text not null,
  referred_by_user_id integer references users(id) on delete set null,
  coin_balance integer not null default 0,
  is_admin boolean not null default false,
  is_banned boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists users_email_idx on users(email);
create unique index if not exists users_username_idx on users(username);
create unique index if not exists users_free_fire_uid_idx on users(free_fire_uid);
create unique index if not exists users_referral_code_idx on users(referral_code);

create table if not exists matches (
  id serial primary key,
  name text not null,
  description text not null default '1 kill = 10 coins, Booyah = 80 coins.',
  type text not null,
  entry_fee integer not null default 0,
  entry_fee_inr integer not null default 0,
  prize integer not null default 0,
  slots integer not null,
  slots_taken integer not null default 0,
  min_players_to_start integer not null default 30,
  team_size integer not null default 1,
  mode text not null default 'solo',
  is_captain_entry_only boolean not null default false,
  payout_per_kill integer not null default 10,
  booyah_bonus integer not null default 80,
  status text not null default 'open',
  winner_user_id integer references users(id) on delete set null,
  starts_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists coupons (
  id serial primary key,
  user_id integer not null references users(id) on delete restrict,
  code text not null,
  coin_cost integer not null,
  value_inr integer not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create unique index if not exists coupons_code_idx on coupons(code);

create table if not exists admin_logs (
  id serial primary key,
  admin_user_id integer not null references users(id) on delete restrict,
  action text not null,
  target_type text,
  target_id integer,
  details text,
  created_at timestamptz not null default now()
);

create index if not exists admin_logs_created_idx on admin_logs(created_at);

create table if not exists match_participants (
  id serial primary key,
  match_id integer not null references matches(id) on delete cascade,
  user_id integer not null references users(id) on delete cascade,
  joined_at timestamptz not null default now()
);

create unique index if not exists match_participants_match_user_idx on match_participants(match_id, user_id);
