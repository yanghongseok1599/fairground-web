-- Remove db lint warnings from league tier RPCs by casting CASE results back to
-- league_tier_t before assigning to enum variables.

create or replace function public.promote_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier league_tier_t;
  v_next league_tier_t;
begin
  if not exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.role = 'admin'
  ) then
    raise exception 'not authorized';
  end if;

  select league_tier into v_tier
  from public.teams
  where id = p_team_id
  for update;

  if v_tier is null then
    raise exception 'team not found';
  end if;

  v_next := (
    case v_tier
      when 'bronze' then 'silver'
      when 'silver' then 'gold'
      when 'gold' then 'premium'
      else 'premium'
    end
  )::league_tier_t;

  update public.teams
    set league_tier = v_next, participation_streak = 0
    where id = p_team_id;
end;
$$;

create or replace function public.relegate_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier league_tier_t;
  v_prev league_tier_t;
begin
  if not exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.role = 'admin'
  ) then
    raise exception 'not authorized';
  end if;

  select league_tier into v_tier
  from public.teams
  where id = p_team_id
  for update;

  if v_tier is null then
    raise exception 'team not found';
  end if;

  v_prev := (
    case v_tier
      when 'premium' then 'gold'
      when 'gold' then 'silver'
      when 'silver' then 'bronze'
      else 'bronze'
    end
  )::league_tier_t;

  update public.teams
    set league_tier = v_prev
    where id = p_team_id;
end;
$$;

grant execute on function public.promote_team(uuid) to authenticated;
grant execute on function public.relegate_team(uuid) to authenticated;

notify pgrst, 'reload schema';
