-- Operational pause only. Preserve matches, existing notifications and history.
-- Run as the database owner inside one controlled transaction.
do $pause$
declare job record;
begin
  for job in select jobid from cron.job
    where jobname in ('fairground-next-match-ready', 'fairground-next-match-ready-history')
      and username = 'postgres'
  loop
    perform cron.alter_job(job.jobid, active := false);
  end loop;
end;
$pause$;

alter table public.matches disable trigger next_match_ready_after_clock;

-- Old consoles must not bypass the pause through the compatibility RPC.
revoke execute on function public.notify_next_match_ready(uuid) from authenticated;
