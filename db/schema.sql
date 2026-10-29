

-- ---------- staging table: one row per LeetCode post ----------
create table if not exists raw_posts (
  topic_id    text primary key,
  uuid        text,
  title       text not null,
  company     text,
  url         text,
  created_at  timestamptz,
  tags        text[] default '{}',
  summary     text,
  content     text,
  status      text not null default 'PENDING'
            check (status in ('PENDING', 'PROCESSED', 'DROPPED', 'FAILED'))
);

-- New columns for retry tracking (added to existing tables too).
alter table raw_posts add column if not exists attempts   int not null default 0;
alter table raw_posts add column if not exists last_error text;
alter table raw_posts add column if not exists fetched_at timestamptz not null default now();

create index if not exists raw_posts_status_created_idx on raw_posts (status, created_at desc);
create index if not exists raw_posts_company_idx        on raw_posts (company);

-- ---------- extracted questions: many per post ----------
create table if not exists questions (
  topic_id          text not null references raw_posts (topic_id) on delete cascade,
  company           text,
  role              text,
  round_type        text,
  problem_title     text not null,
  problem_statement text,
  has_io            boolean default false,
  input_format      text,
  output_format     text,
  sample_io         jsonb not null default '[]',
  practice_links    jsonb not null default '[]',
  source_url        text,
  created_at        timestamptz
);

-- Stable ordering for questions inside a post (backfills existing rows).
alter table questions add column if not exists id bigint generated always as identity;

create index if not exists questions_topic_id_idx on questions (topic_id);

-- ---------- company list for the filter ----------
-- Replaces "select every question and dedupe in Python", which broke past 1000 rows.
create or replace view companies with (security_invoker = true) as
select company, count(*)::int as post_count
from raw_posts
where status = 'PROCESSED'
  and company is not null
  and company <> 'Unknown'
group by company;

-- ---------- Row Level Security ----------
-- The API uses the anon key and can only READ processed posts and their questions.
-- The ingestion jobs use the service-role key, which bypasses RLS.
alter table raw_posts enable row level security;
alter table questions enable row level security;

drop policy if exists "anon reads processed posts" on raw_posts;
create policy "anon reads processed posts" on raw_posts
  for select to anon using (status = 'PROCESSED');

drop policy if exists "anon reads questions" on questions;
create policy "anon reads questions" on questions
  for select to anon using (true);

-- ---------- optional: retry posts that hit the attempt limit ----------
-- update raw_posts set status = 'PENDING', attempts = 0, last_error = null where status = 'FAILED';
