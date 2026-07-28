-- ============================================================
-- Elsewhere – Supabase schema migration
-- Run this in the Supabase SQL editor for your project.
-- ============================================================

-- PROFILES (extends auth.users created automatically by Supabase Auth)
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  display_name   text,
  created_at     timestamptz not null default now(),
  last_active_at timestamptz
);

-- SOUNDS
create table public.sounds (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  mode                 text not null check (mode in ('sleep','focus','relax','uplift','move')),
  title                text not null,
  subtitle             text not null,
  audio_storage_path   text,       -- e.g. sounds/{userId}/{id}.mp3
  generation_prompt    text,       -- the ElevenLabs prompt (useful for future adaptive calm)
  created_at           timestamptz not null default now(),
  deleted_at           timestamptz -- soft delete; null = active
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles enable row level security;
alter table public.sounds enable row level security;

create policy "own profile read"
  on public.profiles for select
  using (auth.uid() = id);

create policy "own profile write"
  on public.profiles for update
  using (auth.uid() = id);

create policy "own sounds read"
  on public.sounds for select
  using (auth.uid() = user_id and deleted_at is null);

create policy "own sounds insert"
  on public.sounds for insert
  with check (auth.uid() = user_id);

create policy "own sounds update"
  on public.sounds for update
  using (auth.uid() = user_id);

-- ============================================================
-- Storage
-- Create a bucket named "sounds" (private) in the Supabase
-- Storage UI. The backend uses the service-role key to upload
-- and generate signed URLs — no storage policy is needed for
-- public access.
-- ============================================================
