-- XenCheats support operations extension.
-- Run once in Supabase SQL Editor before enabling ticket ratings.
-- This stores only the member's voluntary rating and feedback after a ticket is closed.

create table if not exists public.support_ratings (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.support_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  feedback text check (char_length(feedback) <= 800),
  created_at timestamptz not null default now(),
  unique (thread_id, user_id)
);

alter table public.support_ratings enable row level security;

create policy "Members can submit their own support rating"
  on public.support_ratings for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Members can read their own support ratings"
  on public.support_ratings for select to authenticated
  using (auth.uid() = user_id);
