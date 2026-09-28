-- Preserve notification identity and match destination through the Web Push webhook.
CREATE OR REPLACE FUNCTION public.call_push_dispatch()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  secret text;
  fn_url text := 'https://ovtnmslyjzvghirdvife.supabase.co/functions/v1/push-dispatch';
begin
  select webhook_secret into secret from app_push_config where id = true;
  if secret is null or secret = '' then
    return new;
  end if;
  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', secret
    ),
    body := jsonb_build_object(
      'record', jsonb_build_object(
        'id', new.id,
        'match_id', new.match_id,
        'user_id', new.user_id,
        'kind', new.kind,
        'title', new.title,
        'snippet', new.snippet,
        'post_id', new.post_id,
        'comment_id', new.comment_id,
        'team_id', new.team_id
      )
    ),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  -- 실패해도 노티 insert 자체는 막지 않는다.
  return new;
end $function$
;
