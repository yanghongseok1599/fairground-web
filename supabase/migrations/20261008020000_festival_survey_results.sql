-- Approved administrators can review anonymous survey answers.
-- Existing response storage, submit RPC, grants and RLS remain untouched.
begin;

create function public.get_festival_survey_results()
returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not exists (
    select 1 from public.profiles p
    where p.id = v_user_id and p.role = 'admin' and p.is_approved = true
  ) then
    raise exception 'Only approved administrators can read survey results' using errcode = '42501';
  end if;
  -- A single scalar JSON response avoids PostgREST's row limit truncating totals.
  -- Only the anonymous survey record is returned; no member information is joined.
  return jsonb_build_object('responses', coalesce((
    select jsonb_agg(jsonb_build_object(
      'responseId', r.response_id,
      'answers', r.answers,
      'createdAt', r.created_at
    ) order by r.created_at desc, r.response_id desc)
    from public.festival_survey_responses r
  ), '[]'::jsonb));
end;
$$;

revoke all on function public.get_festival_survey_results() from public, anon, authenticated;
grant execute on function public.get_festival_survey_results() to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    revoke all on function public.get_festival_survey_results() from service_role;
  end if;
end $$;
comment on function public.get_festival_survey_results() is
  'Read-only anonymous festival survey results for approved administrators; no participant identity or public read access.';
commit;
