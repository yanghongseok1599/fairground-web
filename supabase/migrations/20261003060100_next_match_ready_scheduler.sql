-- Supabase ships pg_cron; enable its built-in scheduler in each environment.
-- Keep scheduling separate from the notification core so the core can also be
-- rehearsed on a disposable PostgreSQL instance without platform extensions.
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'fairground-next-match-ready',
  '10 seconds',
  'select public.dispatch_due_next_match_ready();'
);

-- Bound only these jobs' run history; other scheduled jobs are unaffected.
select cron.schedule(
  'fairground-next-match-ready-history',
  '0 3 * * *',
  $job$delete from cron.job_run_details
    where jobid in (
      select jobid from cron.job
      where jobname in ('fairground-next-match-ready', 'fairground-next-match-ready-history')
        and username = 'postgres'
    )
    and end_time < now() - interval '7 days';$job$
);
