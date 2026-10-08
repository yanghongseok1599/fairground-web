-- Anonymous survey only. No profile, team, session, IP or user-agent is stored.
-- Apply this focused migration after target backup and isolated role tests.
begin;

create table public.festival_survey_responses (
  response_id uuid primary key,
  answers jsonb not null check (jsonb_typeof(answers) = 'object'),
  created_at timestamptz not null default now()
);
alter table public.festival_survey_responses enable row level security;
revoke all on table public.festival_survey_responses from public, anon, authenticated;

create function public.submit_festival_survey(p_response_id uuid, p_answers jsonb)
returns boolean
language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_key text;
  v_score numeric;
  v_allowed text[];
  v_text text;
  v_categories jsonb;
  v_normalized jsonb;
  v_existing jsonb;
  -- ECMAScript String.trim() whitespace, shared with model.ts canonicalization.
  v_whitespace constant text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
begin
  if p_response_id is null or p_response_id::text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or jsonb_typeof(p_answers) is distinct from 'object' then
    raise exception 'Invalid survey response' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(p_answers) k where k <> all(array[
    'role','overallSatisfaction','recommendation','returnIntent','categoryRatings',
    'rulesOpinion','matchDuration','entryFee','bestMoment','improvement','safetyIncident','suggestions'
  ])) then
    raise exception 'Unexpected survey field' using errcode = '22023';
  end if;

  foreach v_key in array array['role','returnIntent','rulesOpinion','matchDuration','entryFee'] loop
    v_allowed := case v_key
      when 'role' then array['captain','player']
      when 'returnIntent' then array['definitely','probably','undecided','unable']
      when 'rulesOpinion' then array['appropriate','slightly_strict','too_strict','stricter_ok']
      when 'matchDuration' then array['short','appropriate','long']
      when 'entryFee' then array['inexpensive','appropriate','burdensome'] end;
    if jsonb_typeof(p_answers -> v_key) is distinct from 'string'
      or not coalesce((p_answers ->> v_key) = any(v_allowed), false) then
      raise exception 'Invalid survey choice: %', v_key using errcode = '22023';
    end if;
  end loop;

  foreach v_key in array array['overallSatisfaction','recommendation'] loop
    if jsonb_typeof(p_answers -> v_key) is distinct from 'number' then
      raise exception 'Missing survey rating: %', v_key using errcode = '22023';
    end if;
    v_score := (p_answers ->> v_key)::numeric;
    if v_score <> trunc(v_score)
      or v_score < (case when v_key = 'recommendation' then 0 else 1 end)
      or v_score > (case when v_key = 'recommendation' then 10 else 5 end) then
      raise exception 'Invalid survey rating: %', v_key using errcode = '22023';
    end if;
  end loop;

  v_categories := p_answers -> 'categoryRatings';
  if jsonb_typeof(v_categories) is distinct from 'object' then
    raise exception 'All category ratings are required' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(v_categories) k where k <> all(array[
    'referee','safety','schedule','facilities','communication','program'
  ])) then
    raise exception 'Unexpected category rating' using errcode = '22023';
  end if;
  foreach v_key in array array['referee','safety','schedule','facilities','communication','program'] loop
    if jsonb_typeof(v_categories -> v_key) is distinct from 'number' then
      raise exception 'All category ratings are required: %', v_key using errcode = '22023';
    end if;
    v_score := (v_categories ->> v_key)::numeric;
    if v_score <> trunc(v_score) or v_score < 1 or v_score > 5 then
      raise exception 'Invalid category rating: %', v_key using errcode = '22023';
    end if;
  end loop;

  v_normalized := p_answers;
  foreach v_key in array array['bestMoment','improvement','safetyIncident','suggestions'] loop
    if not (p_answers ? v_key) and v_key = any(array['safetyIncident','suggestions']) then
      v_text := '';
    else
      if jsonb_typeof(p_answers -> v_key) is distinct from 'string' then
        raise exception 'Invalid survey text: %', v_key using errcode = '22023';
      end if;
      v_text := btrim(p_answers ->> v_key, v_whitespace);
    end if;
    -- JavaScript and textarea maxlength count astral characters as two UTF-16 units.
    if char_length(v_text) + char_length(regexp_replace(v_text, U&'[\0001-\FFFF]', '', 'g')) > 3000
      or (v_key = any(array['bestMoment','improvement']) and v_text = '') then
      raise exception 'Required survey text is empty or too long: %', v_key using errcode = '22023';
    end if;
    v_normalized := jsonb_set(v_normalized, array[v_key], to_jsonb(v_text));
  end loop;

  -- A lost network response can retry this same random UUID without duplication.
  -- ON CONFLICT waits for concurrent inserts before comparing their stored payload.
  insert into public.festival_survey_responses(response_id, answers)
    values (p_response_id, v_normalized) on conflict (response_id) do nothing;
  select r.answers into v_existing from public.festival_survey_responses r
    where r.response_id = p_response_id;
  if v_existing is distinct from v_normalized then
    raise exception 'Survey response already submitted with different answers' using errcode = '23505';
  end if;
  return true;
end;
$$;

revoke all on function public.submit_festival_survey(uuid,jsonb) from public;
grant execute on function public.submit_festival_survey(uuid,jsonb) to anon, authenticated;
-- Supabase default grants may include service_role; the survey has no API read path.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    revoke all on table public.festival_survey_responses from service_role;
    revoke all on function public.submit_festival_survey(uuid,jsonb) from service_role;
  end if;
end $$;
comment on table public.festival_survey_responses is
  'Anonymous 1st FairGround mixed futsal festival feedback. Insert-only RPC; no identifying metadata or public results.';
commit;
