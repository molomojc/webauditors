-- Schema for the Postgres store. Apply it once with:
--   psql "$DATABASE_URL" -f api/_lib/store/schema.sql
--
-- The whole run object lives in `payload` so the file store and the Postgres
-- store agree on the shape; the columns exist for querying and indexing.

create table if not exists agent_runs (
  id text primary key,
  session_hash text,
  target text not null,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  payload jsonb not null
);

create index if not exists agent_runs_session_idx
  on agent_runs (session_hash, created_at desc);

create index if not exists agent_runs_status_idx
  on agent_runs (status);

create table if not exists agent_jobs (
  id text primary key,
  run_id text not null references agent_runs (id) on delete cascade,
  type text not null,
  status text not null default 'queued',
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  lease_until timestamptz,
  payload jsonb not null
);

create index if not exists agent_jobs_status_idx
  on agent_jobs (status, created_at);

create table if not exists agent_ownership (
  key text primary key,
  updated_at timestamptz not null default now(),
  value jsonb not null
);

create table if not exists agent_settings (
  key text primary key,
  updated_at timestamptz not null default now(),
  value jsonb not null
);
