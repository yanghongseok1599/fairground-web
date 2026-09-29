begin;

-- `end_match()` updates season_yellow_cards with the cards recorded in a match.
-- Convert every complete pair into a one-match ban and keep only the remainder.
-- This runs before the legacy end_match() 5-card check, so that old check sees
-- only 0 or 1 and cannot apply the retired threshold.
create or replace function public.apply_two_yellow_card_suspension()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  warning_count integer;
  suspension_count integer;
begin
  -- Only end_match() may convert tournament warnings into a suspension.
  -- This prevents an unrelated profile edit from unexpectedly applying a ban.
  if current_setting('app.in_end_match', true) is distinct from '1' then
    return new;
  end if;

  warning_count := coalesce(new.season_yellow_cards, 0);

  if warning_count > coalesce(old.season_yellow_cards, 0)
     and warning_count >= 2 then
    suspension_count := warning_count / 2;
    new.season_yellow_cards := warning_count % 2;
    new.ban_matches_remaining := coalesce(new.ban_matches_remaining, 0) + suspension_count;
    new.is_banned := true;
  end if;

  return new;
end;
$$;

revoke all on function public.apply_two_yellow_card_suspension() from public, anon, authenticated;

drop trigger if exists trg_apply_two_yellow_card_suspension on public.profiles;
create trigger trg_apply_two_yellow_card_suspension
  before update of season_yellow_cards on public.profiles
  for each row
  when (coalesce(new.season_yellow_cards, 0) > coalesce(old.season_yellow_cards, 0))
  execute function public.apply_two_yellow_card_suspension();

-- Re-evaluate warnings already stored under the retired five-warning threshold.
-- Keep any existing suspension and retain only the unpaired warning remainder.
update public.profiles
set ban_matches_remaining = coalesce(ban_matches_remaining, 0)
      + (coalesce(season_yellow_cards, 0) / 2),
    is_banned = true,
    season_yellow_cards = coalesce(season_yellow_cards, 0) % 2
where coalesce(season_yellow_cards, 0) >= 2;

commit;
