-- Site promotional popups controlled from the admin console.
-- Public users can read only active popups; only admins can manage them.

create table if not exists public.site_popups (
  id uuid primary key default gen_random_uuid(),
  placement text not null default 'home',
  name text not null,
  is_active boolean not null default false,
  priority int not null default 100,
  dismiss_version int not null default 1,
  display_delay_ms int not null default 650,
  eyebrow text not null default '',
  title text not null,
  body text not null default '',
  detail_one text not null default '',
  detail_two text not null default '',
  image_url text not null default '',
  cta_label text not null default '자세히 보기',
  cta_href text not null default '/',
  secondary_label text not null default '',
  secondary_href text not null default '',
  starts_at timestamptz null,
  ends_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references public.profiles(id) on delete set null,
  constraint site_popups_placement_check check (placement in ('home')),
  constraint site_popups_priority_check check (priority between 0 and 1000),
  constraint site_popups_dismiss_version_check check (dismiss_version between 1 and 999),
  constraint site_popups_display_delay_check check (display_delay_ms between 0 and 10000),
  constraint site_popups_cta_href_check check (cta_href = '' or cta_href like '/%' or cta_href like 'https://%'),
  constraint site_popups_secondary_href_check check (secondary_href = '' or secondary_href like '/%' or secondary_href like 'https://%')
);

create index if not exists idx_site_popups_public_active
  on public.site_popups (placement, is_active, priority desc, updated_at desc);

create or replace function public.touch_site_popup_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_touch_site_popup_updated_at on public.site_popups;
create trigger trg_touch_site_popup_updated_at
before update on public.site_popups
for each row
execute function public.touch_site_popup_updated_at();

alter table public.site_popups enable row level security;

drop policy if exists "site_popups_select_active_public" on public.site_popups;
create policy "site_popups_select_active_public"
on public.site_popups
for select
to anon, authenticated
using (
  is_active = true
  and (starts_at is null or starts_at <= now())
  and (ends_at is null or ends_at >= now())
);

drop policy if exists "site_popups_select_admin" on public.site_popups;
create policy "site_popups_select_admin"
on public.site_popups
for select
to authenticated
using (public.is_admin());

drop policy if exists "site_popups_insert_admin" on public.site_popups;
create policy "site_popups_insert_admin"
on public.site_popups
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "site_popups_update_admin" on public.site_popups;
create policy "site_popups_update_admin"
on public.site_popups
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "site_popups_delete_admin" on public.site_popups;
create policy "site_popups_delete_admin"
on public.site_popups
for delete
to authenticated
using (public.is_admin());

insert into public.site_popups (
  placement,
  name,
  is_active,
  priority,
  dismiss_version,
  display_delay_ms,
  eyebrow,
  title,
  body,
  detail_one,
  detail_two,
  image_url,
  cta_label,
  cta_href
)
select
  'home',
  '전국 대학대항전 비치사커대회',
  true,
  100,
  1,
  650,
  'BEACH SOCCER',
  '전국 대학대항전|비치사커대회',
  '강원 동해시 망상해수욕장에서 열리는 여름 특별 프로젝트로, 대학 팀들이 모여 비치사커 이벤트 매치를 펼칩니다.',
  '강원 동해시 망상해수욕장',
  '2026년 8월 7일 금요일',
  '/promotions/beach-soccer-national-college-premium-4x5.png',
  '프로젝트 보기',
  '/beach-soccer'
where not exists (
  select 1
  from public.site_popups
  where placement = 'home'
    and name = '전국 대학대항전 비치사커대회'
);
