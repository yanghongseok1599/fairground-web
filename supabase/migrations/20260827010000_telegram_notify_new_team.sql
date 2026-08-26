-- 신규 팀 등록 시 운영진에게 텔레그램 알림.
--
-- 참가 신청은 팀 생성으로 들어오는데, 운영진이 관리자 화면을 열어보기 전까지
-- 접수 사실을 알 수 없다. 대회가 가까워질수록 승인 지연이 곧 참가 이탈이므로
-- 접수 즉시 알린다.
--
-- 구현 메모
--  - pg_net 은 비동기(fire-and-forget)라 텔레그램이 느리거나 죽어도 팀 생성
--    트랜잭션을 붙잡지 않는다. 알림 실패가 신청 실패가 되면 안 된다.
--  - 봇 토큰은 Vault 에 둔다. 토큰이 없으면 조용히 건너뛴다(기능 미설정 상태에서
--    팀 생성이 깨지지 않도록).
--  - 예외는 전부 삼킨다. 알림은 부가 기능이고 신청 접수가 본질이다.

create or replace function public.notify_new_team_telegram()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token   text;
  v_chat_id text;
  v_captain text;
  v_phone   text;
  v_text    text;
begin
  begin
    select decrypted_secret into v_token
    from vault.decrypted_secrets where name = 'telegram_bot_token';

    select decrypted_secret into v_chat_id
    from vault.decrypted_secrets where name = 'telegram_chat_id';

    -- 미설정이면 아무 것도 하지 않는다.
    if v_token is null or v_chat_id is null then
      return new;
    end if;

    select p.name, p.phone into v_captain, v_phone
    from profiles p where p.id = new.captain_id;

    v_text :=
      E'⚽ 새 팀 참가 신청\n\n'
      || '팀명: ' || coalesce(new.name, '(미입력)') || E'\n'
      || '대표: ' || coalesce(v_captain, '(미확인)') || E'\n'
      || '연락처: ' || coalesce(nullif(v_phone, ''), '(미입력)') || E'\n\n'
      || E'승인 대기 상태입니다.\n'
      || 'https://fairground-kor.com/admin/teams';

    perform net.http_post(
      url     := 'https://api.telegram.org/bot' || v_token || '/sendMessage',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := jsonb_build_object(
                   'chat_id', v_chat_id,
                   'text', v_text,
                   'disable_web_page_preview', true
                 )
    );
  exception when others then
    -- 알림 실패가 팀 생성을 막아서는 안 된다.
    raise warning 'notify_new_team_telegram failed: %', sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists trg_notify_new_team_telegram on public.teams;
create trigger trg_notify_new_team_telegram
  after insert on public.teams
  for each row execute function public.notify_new_team_telegram();
