begin;

create table if not exists public.notification_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique check (length(token) between 20 and 2048),
  platform text not null check (platform in ('android', 'ios', 'web')),
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notification_devices_user_enabled_idx
  on public.notification_devices (user_id, last_seen_at desc)
  where enabled;

create table if not exists public.notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 120),
  body text not null check (length(trim(body)) between 1 and 500),
  audience text not null check (audience in ('all', 'clients', 'couriers', 'stores', 'single')),
  type text not null check (type in ('promo', 'operational', 'alert', 'general')),
  target_screen text not null default 'home',
  target_id text,
  target_uid uuid references public.profiles(id) on delete set null,
  image_url text,
  sender_user_id uuid references public.profiles(id) on delete set null,
  sender_email text,
  status text not null default 'queued'
    check (status in ('queued', 'sending', 'sent', 'partial', 'failed', 'recorded_only')),
  fcm_delivery_status text not null default 'pending'
    check (fcm_delivery_status in ('pending', 'delivered', 'partial', 'failed', 'recorded_only')),
  recipient_count integer not null default 0 check (recipient_count >= 0),
  success_count integer not null default 0 check (success_count >= 0),
  failure_count integer not null default 0 check (failure_count >= 0),
  fcm_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists notification_campaigns_created_idx
  on public.notification_campaigns (created_at desc);

alter table public.notifications
  add column if not exists campaign_id uuid references public.notification_campaigns(id) on delete set null,
  add column if not exists target_screen text not null default 'home',
  add column if not exists image_url text;

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notification_devices enable row level security;
alter table public.notification_campaigns enable row level security;

revoke all on public.notification_devices from anon, authenticated;
revoke all on public.notification_campaigns from anon, authenticated;
grant select, insert, update, delete on public.notification_devices to service_role;
grant select, insert, update, delete on public.notification_campaigns to service_role;
grant select, insert, update, delete on public.notifications to service_role;

notify pgrst, 'reload schema';
commit;
