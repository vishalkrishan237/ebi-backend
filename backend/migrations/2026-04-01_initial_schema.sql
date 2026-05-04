create table if not exists users (
  id serial primary key,
  email text unique not null,
  username text unique not null,
  password_hash text not null,
  free_fire_uid text unique,
  coin_balance integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists matches (
  id serial primary key,
  title text not null,
  status text not null default 'pending',
  winner_user_id integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists match_participants (
  id serial primary key,
  match_id integer not null references matches(id),
  user_id integer not null references users(id),
  kills integer not null default 0,
  coins_earned integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists coupons (
  id serial primary key,
  code text unique not null,
  discount_percent integer not null,
  user_id integer references users(id),
  is_used boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists admin_logs (
  id serial primary key,
  admin_user_id integer not null references users(id),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  created_at timestamptz not null default now()
);
