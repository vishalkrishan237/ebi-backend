alter table matches
  add column if not exists description text not null default '1 kill = 10 coins, Booyah = 80 coins.',
  add column if not exists entry_fee_inr integer not null default 0,
  add column if not exists min_players_to_start integer not null default 30,
  add column if not exists team_size integer not null default 1,
  add column if not exists mode text not null default 'solo',
  add column if not exists is_captain_entry_only boolean not null default false,
  add column if not exists payout_per_kill integer not null default 10,
  add column if not exists booyah_bonus integer not null default 80;

create table if not exists match_squads (
  id serial primary key,
  match_id integer not null references matches(id) on delete cascade,
  captain_user_id integer not null references users(id) on delete restrict,
  team_name text not null,
  invite_code text not null,
  side text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists match_squads_invite_code_idx on match_squads(invite_code);
create unique index if not exists match_squads_match_captain_idx on match_squads(match_id, captain_user_id);
create unique index if not exists match_squads_match_side_idx on match_squads(match_id, side);

create table if not exists match_squad_members (
  id serial primary key,
  squad_id integer not null references match_squads(id) on delete cascade,
  user_id integer not null references users(id) on delete cascade,
  joined_at timestamptz not null default now()
);

create unique index if not exists match_squad_members_squad_user_idx on match_squad_members(squad_id, user_id);
create unique index if not exists match_squad_members_user_idx on match_squad_members(user_id);
