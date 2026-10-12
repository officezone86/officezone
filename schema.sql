-- Officezone database setup
-- Run in Supabase Dashboard > SQL Editor > New query > Run.
-- This schema supports guest chat and form submissions. Never put service_role keys in index.html.

create extension if not exists pgcrypto;

create table if not exists public.officezone_forms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  uin text not null,
  rank text,
  full_name text not null,
  coy text not null,
  mobile_number text not null,
  diet_type text,
  remarks text,
  status text not null default 'pending',
  approval_status text not null default 'PENDING',
  created_at timestamptz not null default now()
);

create table if not exists public.officezone_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  sender_role text not null check (sender_role in ('user','admin')),
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.officezone_forms enable row level security;
alter table public.officezone_chat_messages enable row level security;

-- Guests may submit forms only as their own anonymous-auth user.
drop policy if exists "Guests insert own Officezone forms" on public.officezone_forms;
create policy "Guests insert own Officezone forms"
  on public.officezone_forms for insert to authenticated
  with check (auth.uid() = user_id);

-- Guests can read their own form rows (not other users' submissions).
drop policy if exists "Guests read own Officezone forms" on public.officezone_forms;
create policy "Guests read own Officezone forms"
  on public.officezone_forms for select to authenticated
  using (auth.uid() = user_id);

-- Guests can send and read messages only in their own chat thread.
drop policy if exists "Guests send own Officezone chat messages" on public.officezone_chat_messages;
create policy "Guests send own Officezone chat messages"
  on public.officezone_chat_messages for insert to authenticated
  with check (auth.uid() = user_id and sender_role = 'user');

drop policy if exists "Guests read own Officezone chat messages" on public.officezone_chat_messages;
create policy "Guests read own Officezone chat messages"
  on public.officezone_chat_messages for select to authenticated
  using (auth.uid() = user_id);

-- NOTE: Admin reads/updates and admin chat replies must use a secure admin-authorized
-- backend / Edge Function. Do not add a public policy that lets every visitor act as admin.
