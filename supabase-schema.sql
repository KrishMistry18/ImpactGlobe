-- ImpactGlobe Database Schema
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================================
-- EVENTS TABLE
-- ============================================================================
create table public.events (
  id uuid primary key default uuid_generate_v4(),
  headline text not null,
  country text not null,
  lat numeric(9,6) not null,
  lon numeric(9,6) not null,
  impact_level text not null check (impact_level in ('Critical', 'High', 'Medium', 'Low')),
  category text not null check (category in ('Geopolitical', 'Central Bank', 'Macro', 'Political', 'Crisis', 'Sanctions', 'Earnings', 'Natural Disaster')),
  summary text not null,
  sentiment text not null,
  forex_impacts jsonb not null default '[]'::jsonb,
  confidence_score integer not null check (confidence_score >= 0 and confidence_score <= 100),
  is_market_moving boolean not null default false,
  published_at timestamptz not null default now(),
  expires_at timestamptz not null,
  source_url text,
  created_by text not null check (created_by in ('ai-auto', 'ai-confirmed', 'manual')),
  created_at timestamptz not null default now()
);

-- Indexes for events
create index idx_events_published_at on public.events(published_at desc);
create index idx_events_expires_at on public.events(expires_at);
create index idx_events_country on public.events(country);
create index idx_events_impact_level on public.events(impact_level);
create index idx_events_category on public.events(category);
create index idx_events_is_market_moving on public.events(is_market_moving);

-- Enable Row Level Security
alter table public.events enable row level security;

-- Policy: Anyone can read events
create policy "Events are publicly readable"
  on public.events for select
  using (true);

-- Policy: Only authenticated users with service role can insert/update/delete
create policy "Service role can manage events"
  on public.events for all
  using (auth.role() = 'service_role');

-- ============================================================================
-- FOREX CACHE TABLE
-- ============================================================================
create table public.forex_cache (
  pair text primary key,
  current_price numeric(12,6) not null,
  change_24h numeric(12,6) not null,
  change_percent_24h numeric(8,4) not null,
  sparkline_data jsonb not null default '[]'::jsonb,
  driving_event_id uuid references public.events(id) on delete set null,
  driving_event_headline text,
  last_updated timestamptz not null default now(),
  fetched_at timestamptz not null default now()
);

-- Index for forex cache
create index idx_forex_cache_last_updated on public.forex_cache(last_updated desc);

-- Enable RLS
alter table public.forex_cache enable row level security;

-- Policy: Anyone can read forex data
create policy "Forex cache is publicly readable"
  on public.forex_cache for select
  using (true);

-- Policy: Service role can manage
create policy "Service role can manage forex cache"
  on public.forex_cache for all
  using (auth.role() = 'service_role');

-- ============================================================================
-- ENVIRONMENTAL DATA CACHE TABLE
-- ============================================================================
create table public.env_data_cache (
  layer_type text primary key check (layer_type in ('wind','aqi','earthquakes','wildfires','storms','sea_temp','temp_anomaly')),
  data jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- Index for env cache
create index idx_env_cache_expires on public.env_data_cache(expires_at);

-- Enable RLS
alter table public.env_data_cache enable row level security;

-- Policy: Anyone can read env data
create policy "Env data cache is publicly readable"
  on public.env_data_cache for select
  using (true);

-- Policy: Service role can manage
create policy "Service role can manage env cache"
  on public.env_data_cache for all
  using (auth.role() = 'service_role');

-- ============================================================================
-- AQI HISTORY TABLE
-- ============================================================================
create table public.aqi_history (
  id uuid primary key default uuid_generate_v4(),
  city text not null,
  country text not null,
  lat numeric(9,6),
  lon numeric(9,6),
  aqi integer not null,
  pm25 numeric(8,2),
  recorded_at timestamptz not null default now()
);

-- Indexes for AQI history
create index idx_aqi_history_city_time on public.aqi_history(city, recorded_at desc);
create index idx_aqi_history_recorded_at on public.aqi_history(recorded_at desc);

-- Enable RLS
alter table public.aqi_history enable row level security;

-- Policy: Anyone can read AQI history
create policy "AQI history is publicly readable"
  on public.aqi_history for select
  using (true);

-- Policy: Service role can manage
create policy "Service role can manage AQI history"
  on public.aqi_history for all
  using (auth.role() = 'service_role');

-- ============================================================================
-- USERS TABLE (extends Supabase auth.users)
-- ============================================================================
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.users enable row level security;

-- Policy: Users can read their own data
create policy "Users can read own data"
  on public.users for select
  using (auth.uid() = id);

-- Policy: Users can insert their own data
create policy "Users can insert own data"
  on public.users for insert
  with check (auth.uid() = id);

-- ============================================================================
-- WATCHLIST TABLE
-- ============================================================================
create table public.watchlist (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('country', 'forex_pair', 'event')),
  value text not null,
  created_at timestamptz not null default now(),
  unique(user_id, type, value)
);

-- Indexes for watchlist
create index idx_watchlist_user_id on public.watchlist(user_id);
create index idx_watchlist_type on public.watchlist(type);

-- Enable RLS
alter table public.watchlist enable row level security;

-- Policy: Users can manage their own watchlist
create policy "Users can manage own watchlist"
  on public.watchlist for all
  using (auth.uid() = user_id);

-- ============================================================================
-- PUSH SUBSCRIPTIONS TABLE
-- ============================================================================
create table public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

-- Indexes for push subscriptions
create index idx_push_subscriptions_user_id on public.push_subscriptions(user_id);
create index idx_push_subscriptions_endpoint on public.push_subscriptions(endpoint);

-- Enable RLS
alter table public.push_subscriptions enable row level security;

-- Policy: Users can manage their own subscriptions
create policy "Users can manage own push subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id);

-- ============================================================================
-- REALTIME PUBLICATION
-- ============================================================================
-- Enable realtime for events table (so clients get live updates)
alter publication supabase_realtime add table public.events;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to automatically create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create user profile on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to clean up expired events (can be called by cron)
create or replace function public.cleanup_expired_events()
returns void as $$
begin
  delete from public.events
  where expires_at < now() - interval '7 days';
end;
$$ language plpgsql security definer;

-- Function to clean up old AQI history (keep last 30 days)
create or replace function public.cleanup_old_aqi_history()
returns void as $$
begin
  delete from public.aqi_history
  where recorded_at < now() - interval '30 days';
end;
$$ language plpgsql security definer;

-- ============================================================================
-- INITIAL DATA (Optional - for testing)
-- ============================================================================

-- You can add some test events here if you want
-- Example:
-- insert into public.events (headline, country, lat, lon, impact_level, category, summary, sentiment, confidence_score, is_market_moving, expires_at, created_by)
-- values 
--   ('Test Event', 'United States', 40.7128, -74.0060, 'High', 'Geopolitical', 'This is a test event', 'Neutral', 85, true, now() + interval '48 hours', 'manual');

-- ============================================================================
-- DONE!
-- ============================================================================
-- Your database is now ready for ImpactGlobe!
-- 
-- Next steps:
-- 1. Go to Supabase Dashboard → Database → Replication
-- 2. Enable realtime for the 'events' table
-- 3. Test the app: npm run dev
