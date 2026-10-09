create table if not exists public.bot_faq (
  id uuid primary key default gen_random_uuid(),
  topic text not null,
  answer text not null,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.bot_conversations (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('test','whatsapp','tiktok')),
  external_user_id text not null,
  customer_name text,
  status text not null default 'bot' check (status in ('bot','human')),
  handoff_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel, external_user_id)
);

create table if not exists public.bot_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.bot_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','staff')),
  content text not null,
  tools_used jsonb,
  created_at timestamptz not null default now()
);

create index if not exists bot_messages_conv_idx on public.bot_messages (conversation_id, created_at);

alter table public.bot_faq enable row level security;
alter table public.bot_conversations enable row level security;
alter table public.bot_messages enable row level security;
-- No policies on purpose: only the server (service_role) can read/write these tables.
