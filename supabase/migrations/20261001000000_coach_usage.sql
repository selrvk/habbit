-- Per-user daily message counts for the Bonbon coach (gemini-proxy edge function).
-- Only the edge function (service role) touches this table; clients have no access.

create table if not exists public.coach_usage (
  user_id uuid    not null,
  day     date    not null,
  count   integer not null default 0,
  primary key (user_id, day)
);

alter table public.coach_usage enable row level security;
-- No policies: anon/authenticated roles can neither read nor write.

-- Atomically add one message and return the new count for that user and day.
create or replace function public.increment_coach_usage(p_user uuid, p_day date)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.coach_usage (user_id, day, count)
  values (p_user, p_day, 1)
  on conflict (user_id, day) do update set count = public.coach_usage.count + 1
  returning count;
$$;

revoke all on function public.increment_coach_usage(uuid, date) from public, anon, authenticated;
grant execute on function public.increment_coach_usage(uuid, date) to service_role;
