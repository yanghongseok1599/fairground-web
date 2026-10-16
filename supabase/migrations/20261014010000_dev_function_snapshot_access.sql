-- Development-only remediation. The controlled executor must verify the target
-- connection and set this transaction-local guard. Never apply via linked push.
DO $guard$
BEGIN
  IF current_setting('app.fairground_security_target', true) IS DISTINCT FROM
     'fhytkbjadhnmozppolrv' THEN
    RAISE EXCEPTION 'This migration requires the verified FairGround development target';
  END IF;
END
$guard$;

REVOKE ALL PRIVILEGES ON TABLE public._fnsnap_before FROM PUBLIC, anon, authenticated;
-- Column grants are independent of table grants; remove both access paths.
REVOKE ALL PRIVILEGES (oid, proname, args, def)
  ON TABLE public._fnsnap_before FROM PUBLIC, anon, authenticated;
ALTER TABLE public._fnsnap_before ENABLE ROW LEVEL SECURITY;
