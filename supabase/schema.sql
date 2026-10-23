-- ==========================================================================
-- KINDRED — Supabase Schema
-- Run this once in the Supabase SQL editor (Project -> SQL Editor -> New query)
-- ==========================================================================

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  username text unique not null,
  email text not null,
  age int,
  gender text,
  city text,
  country text,
  bio text default '',
  avatar_url text,
  cover_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- ---------- POSTS ----------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text default '',
  image_url text,
  video_url text,
  created_at timestamptz default now()
);

alter table public.posts enable row level security;

create policy "Posts are viewable by everyone"
  on public.posts for select using (true);

create policy "Users can insert their own posts"
  on public.posts for insert with check (auth.uid() = user_id);

create policy "Users can update their own posts"
  on public.posts for update using (auth.uid() = user_id);

create policy "Users can delete their own posts"
  on public.posts for delete using (auth.uid() = user_id);

-- ---------- LIKES ----------
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (post_id, user_id)
);

alter table public.likes enable row level security;

create policy "Likes are viewable by everyone"
  on public.likes for select using (true);

create policy "Users can like posts"
  on public.likes for insert with check (auth.uid() = user_id);

create policy "Users can unlike their own like"
  on public.likes for delete using (auth.uid() = user_id);

-- ---------- COMMENTS ----------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

alter table public.comments enable row level security;

create policy "Comments are viewable by everyone"
  on public.comments for select using (true);

create policy "Users can add comments"
  on public.comments for insert with check (auth.uid() = user_id);

create policy "Users can delete their own comments"
  on public.comments for delete using (auth.uid() = user_id);

-- ---------- FOLLOWS ----------
create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid references public.profiles(id) on delete cascade not null,
  following_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

alter table public.follows enable row level security;

create policy "Follows are viewable by everyone"
  on public.follows for select using (true);

create policy "Users can follow others"
  on public.follows for insert with check (auth.uid() = follower_id);

create policy "Users can unfollow"
  on public.follows for delete using (auth.uid() = follower_id);

-- ---------- HELPFUL VIEWS ----------
create or replace view public.post_stats as
select
  p.id as post_id,
  (select count(*) from public.likes l where l.post_id = p.id) as like_count,
  (select count(*) from public.comments c where c.post_id = p.id) as comment_count
from public.posts p;

create or replace view public.profile_stats as
select
  pr.id as profile_id,
  (select count(*) from public.follows f where f.following_id = pr.id) as followers_count,
  (select count(*) from public.follows f where f.follower_id = pr.id) as following_count,
  (select count(*) from public.posts p where p.user_id = pr.id) as posts_count
from public.profiles pr;

-- ==========================================================================
-- STORAGE
-- Create these buckets in the dashboard (Storage tab) and mark them PUBLIC:
--   avatars, covers, posts
-- Then run the policies below so users may only write inside their own
-- user-id folder, while anyone can read (since the buckets are public).
-- ==========================================================================

create policy "Public read avatars"
  on storage.objects for select using (bucket_id = 'avatars');
create policy "Users upload own avatar"
  on storage.objects for insert with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users update own avatar"
  on storage.objects for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Public read covers"
  on storage.objects for select using (bucket_id = 'covers');
create policy "Users upload own cover"
  on storage.objects for insert with check (bucket_id = 'covers' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users update own cover"
  on storage.objects for update using (bucket_id = 'covers' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Public read posts media"
  on storage.objects for select using (bucket_id = 'posts');
create policy "Users upload own post media"
  on storage.objects for insert with check (bucket_id = 'posts' and auth.uid()::text = (storage.foldername(name))[1]);
