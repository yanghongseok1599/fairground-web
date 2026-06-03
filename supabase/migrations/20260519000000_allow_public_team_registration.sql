-- Allow visitors to submit new teams without login.
-- Team submissions stay pending and cannot assign a captain from the client.
alter table public.teams enable row level security;

drop policy if exists "Allow public pending team registration" on public.teams;

create policy "Allow public pending team registration"
on public.teams
for insert
to anon, authenticated
with check (
  coalesce(is_approved, false) = false
  and captain_id is null
);
