-- ============================================================
-- GymFlow — Supabase Schema
-- Run this in the Supabase SQL editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- -------------------------------------------------------
-- GYMS
-- -------------------------------------------------------
create table gyms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text unique not null,
  owner_id    uuid references auth.users on delete set null,
  logo_url    text,
  address     text,
  created_at  timestamptz default now()
);

alter table gyms enable row level security;

create policy "gym owners can manage their gym"
  on gyms for all
  using (auth.uid() = owner_id);

create policy "authenticated users can read gyms"
  on gyms for select
  using (auth.role() = 'authenticated');

-- -------------------------------------------------------
-- PROFILES (extends auth.users)
-- -------------------------------------------------------
create table profiles (
  id                    uuid primary key references auth.users on delete cascade,
  full_name             text,
  avatar_url            text,
  role                  text not null default 'member' check (role in ('admin', 'trainer', 'member')),
  gym_id                uuid references gyms on delete set null,
  membership_type       text default 'basic' check (membership_type in ('basic', 'premium', 'vip')),
  membership_expires_at timestamptz,
  qr_code               text unique default gen_random_uuid()::text,
  gender                text check (gender in ('male', 'female', 'other')),
  created_at            timestamptz default now()
);

alter table profiles enable row level security;

create policy "users can read own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "users can update own profile"
  on profiles for update
  using (auth.uid() = id);

create policy "admins can read all profiles in their gym"
  on profiles for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role in ('admin', 'trainer')
        and p.gym_id = profiles.gym_id
    )
  );

create policy "admins can update profiles in their gym"
  on profiles for update
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.gym_id = profiles.gym_id
    )
  );

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- -------------------------------------------------------
-- EXERCISES
-- -------------------------------------------------------
create table exercises (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  category      text not null check (category in ('strength', 'cardio', 'flexibility', 'balance', 'hiit')),
  muscle_groups text[] default '{}',
  difficulty    text not null default 'beginner' check (difficulty in ('beginner', 'intermediate', 'advanced')),
  video_url     text,
  image_url     text,
  created_at    timestamptz default now()
);

alter table exercises enable row level security;

create policy "authenticated users can read exercises"
  on exercises for select
  using (auth.role() = 'authenticated');

create policy "admins can manage exercises"
  on exercises for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- -------------------------------------------------------
-- EXERCISE FAVORITES
-- -------------------------------------------------------
create table exercise_favorites (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users on delete cascade not null,
  exercise_id uuid references exercises on delete cascade not null,
  created_at  timestamptz default now(),
  unique (user_id, exercise_id)
);

alter table exercise_favorites enable row level security;

create policy "users manage their own favorites"
  on exercise_favorites for all
  using (auth.uid() = user_id);

-- -------------------------------------------------------
-- CHECK-INS
-- -------------------------------------------------------
create table check_ins (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users on delete cascade not null,
  gym_id          uuid references gyms on delete cascade not null,
  checked_in_at   timestamptz default now(),
  checked_out_at  timestamptz,
  method          text default 'qr' check (method in ('qr', 'manual'))
);

alter table check_ins enable row level security;

create policy "users can see their own check-ins"
  on check_ins for select
  using (auth.uid() = user_id);

create policy "users can create their own check-ins"
  on check_ins for insert
  with check (auth.uid() = user_id);

create policy "admins can see all check-ins in their gym"
  on check_ins for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'trainer')
        and gym_id = check_ins.gym_id
    )
  );

create policy "admins can create check-ins"
  on check_ins for insert
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'trainer')
    )
  );

-- -------------------------------------------------------
-- WORKOUT PLANS
-- -------------------------------------------------------
create table workout_plans (
  id          uuid primary key default gen_random_uuid(),
  gym_id      uuid references gyms on delete cascade,
  name        text not null,
  description text,
  is_template boolean not null default false,
  created_by  uuid references auth.users on delete set null,
  assigned_to uuid references auth.users on delete set null,
  created_at  timestamptz default now()
);

alter table workout_plans enable row level security;

create policy "trainers can manage their own plans"
  on workout_plans for all
  using (auth.uid() = created_by);

create policy "authenticated users can read templates"
  on workout_plans for select
  using (is_template = true and auth.role() = 'authenticated');

create policy "members can read their assigned plan"
  on workout_plans for select
  using (auth.uid() = assigned_to);

-- -------------------------------------------------------
-- WORKOUT PLAN DAYS  (0 = Lunes … 6 = Domingo)
-- -------------------------------------------------------
create table workout_plan_days (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid references workout_plans on delete cascade not null,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  name        text,
  created_at  timestamptz default now(),
  unique(plan_id, day_of_week)
);

alter table workout_plan_days enable row level security;

create policy "plan owner can manage days"
  on workout_plan_days for all
  using (
    exists (
      select 1 from workout_plans wp
      where wp.id = workout_plan_days.plan_id
        and wp.created_by = auth.uid()
    )
  );

create policy "members can read their plan days"
  on workout_plan_days for select
  using (
    exists (
      select 1 from workout_plans wp
      where wp.id = workout_plan_days.plan_id
        and (wp.assigned_to = auth.uid() or wp.is_template)
    )
  );

-- -------------------------------------------------------
-- WORKOUT PLAN EXERCISES
-- -------------------------------------------------------
create table workout_plan_exercises (
  id           uuid primary key default gen_random_uuid(),
  day_id       uuid references workout_plan_days on delete cascade not null,
  exercise_id  uuid references exercises on delete cascade not null,
  sets         smallint not null default 3,
  reps         smallint not null default 10,
  rest_seconds smallint not null default 60,
  order_index  smallint not null default 0,
  notes        text,
  created_at   timestamptz default now()
);

alter table workout_plan_exercises enable row level security;

create policy "plan owner can manage exercises"
  on workout_plan_exercises for all
  using (
    exists (
      select 1 from workout_plan_days wpd
      join workout_plans wp on wp.id = wpd.plan_id
      where wpd.id = workout_plan_exercises.day_id
        and wp.created_by = auth.uid()
    )
  );

create policy "members can read their plan exercises"
  on workout_plan_exercises for select
  using (
    exists (
      select 1 from workout_plan_days wpd
      join workout_plans wp on wp.id = wpd.plan_id
      where wpd.id = workout_plan_exercises.day_id
        and (wp.assigned_to = auth.uid() or wp.is_template)
    )
  );

-- -------------------------------------------------------
-- WORKOUT SESSIONS (completed workouts history)
-- -------------------------------------------------------
create table workout_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references profiles(id) on delete cascade not null,
  plan_id         uuid references workout_plans(id) on delete set null,
  day_of_week     integer not null check (day_of_week between 0 and 6),
  day_name        text not null,
  exercises_count integer not null default 0,
  completed_at    timestamptz not null default now()
);

alter table workout_sessions enable row level security;

create policy "members can insert own sessions"
  on workout_sessions for insert
  with check (auth.uid() = user_id);

create policy "members can read own sessions"
  on workout_sessions for select
  using (auth.uid() = user_id);

create policy "trainers can read member sessions"
  on workout_sessions for select
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
        and role in ('admin', 'trainer')
    )
  );

-- -------------------------------------------------------
-- USEFUL VIEWS
-- -------------------------------------------------------
create or replace view today_check_ins as
  select
    ci.id,
    ci.checked_in_at,
    ci.checked_out_at,
    ci.method,
    p.full_name,
    p.avatar_url,
    p.membership_type
  from check_ins ci
  join profiles p on p.id = ci.user_id
  where ci.checked_in_at::date = current_date;
