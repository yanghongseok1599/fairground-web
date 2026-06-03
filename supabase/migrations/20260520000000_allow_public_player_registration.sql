-- Allow visitors to create pending player cards without an auth session.
-- Public inserts are constrained to safe defaults; admins can approve/update later.

alter table public.profiles enable row level security;

drop policy if exists "Allow public pending player registration" on public.profiles;

create policy "Allow public pending player registration"
on public.profiles
for insert
to anon, authenticated
with check (
  coalesce(is_approved, false) = false
  and coalesce(role, 'player'::public.player_role_t) = 'player'::public.player_role_t
  and coalesce(card_type, 'gold'::public.card_type_t) = 'gold'::public.card_type_t
  and coalesce(card_rating, 90) = 90
  and coalesce(goals, 0) = 0
  and coalesce(assists, 0) = 0
  and coalesce(games, 0) = 0
  and coalesce(mom, 0) = 0
  and coalesce(is_banned, false) = false
  and coalesce(ban_matches_remaining, 0) = 0
  and coalesce(season_yellow_cards, 0) = 0
);
