-- Evening email reminders: user preferences + daily progress snapshots

create table if not exists public.user_reminder_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  evening_reminder_enabled boolean not null default false,
  timezone text not null default 'Asia/Hong_Kong',
  locale text not null default 'zh-HK',
  last_reminder_sent_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger user_reminder_settings_set_updated_at
before update on public.user_reminder_settings
for each row
execute function public.set_updated_at();

create table if not exists public.user_daily_snapshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  date_key text not null,
  streak integer not null default 0,
  has_completed_learning_today boolean not null default false,
  daily_tasks_completed integer not null default 0,
  daily_tasks_total integer not null default 3,
  all_daily_tasks_done boolean not null default false,
  missions_completed integer not null default 0,
  missions_total integer not null default 0,
  streak_safe_today boolean not null default false,
  pending_task_labels jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, date_key)
);

create index if not exists user_daily_snapshots_date_key_idx
  on public.user_daily_snapshots(date_key);

create trigger user_daily_snapshots_set_updated_at
before update on public.user_daily_snapshots
for each row
execute function public.set_updated_at();

alter table public.user_reminder_settings enable row level security;
alter table public.user_daily_snapshots enable row level security;

create policy "Users can view their own reminder settings"
on public.user_reminder_settings for select
using (user_id = auth.uid());

create policy "Users can insert their own reminder settings"
on public.user_reminder_settings for insert
with check (user_id = auth.uid());

create policy "Users can update their own reminder settings"
on public.user_reminder_settings for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can view their own daily snapshots"
on public.user_daily_snapshots for select
using (user_id = auth.uid());

create policy "Users can insert their own daily snapshots"
on public.user_daily_snapshots for insert
with check (user_id = auth.uid());

create policy "Users can update their own daily snapshots"
on public.user_daily_snapshots for update
using (user_id = auth.uid())
with check (user_id = auth.uid());
