-- Standalone casual quiz leaderboard. No member data or existing tables touched.
-- The frontend stays disabled until this migration is reviewed and deployed.
begin;

create table public.futsal_quiz_results (
  id uuid primary key,
  quiz_version text not null check (quiz_version = '2026-01'),
  nickname text not null check (char_length(nickname) between 2 and 12),
  answers integer[] not null check (cardinality(answers) = 10),
  correct_count integer not null check (correct_count between 0 and 10),
  created_at timestamptz not null default now()
);
create index futsal_quiz_results_ranking_idx
  on public.futsal_quiz_results (quiz_version, correct_count desc, created_at, id);
alter table public.futsal_quiz_results enable row level security;
revoke all on public.futsal_quiz_results from public, anon, authenticated;

create function public.get_futsal_quiz_leaderboard(p_version text)
returns table (id uuid, nickname text, correct_count integer, rank bigint, total_records bigint)
language sql stable security definer set search_path = public, pg_temp
as $$
  select r.id, r.nickname, r.correct_count,
    rank() over (order by r.correct_count desc), count(*) over ()
  from public.futsal_quiz_results r
  where r.quiz_version = p_version
  order by r.correct_count desc, r.created_at, r.id
  limit 50;
$$;

create function public.register_futsal_quiz_result(
  p_attempt_id uuid, p_nickname text, p_answers integer[], p_version text
)
returns table (id uuid, correct_count integer, rank bigint)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  -- Keep identical to QUIZ_QUESTIONS for version 2026-01 (covered by parity test).
  v_key constant integer[] := array[1,2,0,3,1,0,2,3,1,2];
  v_score integer;
  v_nickname text;
  v_existing public.futsal_quiz_results%rowtype;
begin
  if p_version is distinct from '2026-01' or p_attempt_id is null then
    raise exception 'Invalid quiz version or attempt' using errcode = '22023';
  end if;
  if p_answers is null or cardinality(p_answers) <> 10
    or array_ndims(p_answers) <> 1 or array_lower(p_answers, 1) <> 1 then
    raise exception 'Exactly ten valid answers are required' using errcode = '22023';
  end if;
  -- Validate the shape before array_position, which only supports one dimension.
  if array_position(p_answers, null) is not null
    or exists (select 1 from unnest(p_answers) a where a < 0 or a > 3) then
    raise exception 'Exactly ten valid answers are required' using errcode = '22023';
  end if;
  v_nickname := btrim(normalize(p_nickname, NFC));
  if v_nickname is null or v_nickname !~ '^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9 _-]{2,12}$' then
    raise exception 'Invalid nickname' using errcode = '22023';
  end if;
  select count(*)::integer into v_score
    from generate_series(1, 10) n where p_answers[n] = v_key[n];
  insert into public.futsal_quiz_results (id, quiz_version, nickname, answers, correct_count)
    values (p_attempt_id, p_version, v_nickname, p_answers, v_score)
    on conflict do nothing;
  select * into v_existing from public.futsal_quiz_results r where r.id = p_attempt_id;
  if v_existing.answers is distinct from p_answers or v_existing.nickname is distinct from v_nickname
    or v_existing.quiz_version is distinct from p_version then
    raise exception 'Attempt already registered' using errcode = '22023';
  end if;
  return query select r.id, r.correct_count,
    1 + (select count(*) from public.futsal_quiz_results better
      where better.quiz_version = p_version and better.correct_count > r.correct_count)
    from public.futsal_quiz_results r where r.id = p_attempt_id;
end;
$$;

revoke all on function public.get_futsal_quiz_leaderboard(text) from public;
revoke all on function public.register_futsal_quiz_result(uuid,text,integer[],text) from public;
grant execute on function public.get_futsal_quiz_leaderboard(text) to anon, authenticated;
grant execute on function public.register_futsal_quiz_result(uuid,text,integer[],text) to anon, authenticated;
comment on table public.futsal_quiz_results is
  'Casual repeatable quiz attempts; public nicknames and server-calculated scores. Not identity-verified or suitable for prizes.';
commit;
