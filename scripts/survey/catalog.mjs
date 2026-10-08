import { createHash } from "node:crypto";

export const hash = value => createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest("hex");
export const quote = value => '"' + value.replaceAll('"', '""') + '"';

// Every definition is keyed and compared, including owners, object/column ACLs and RLS.
const catalogSql = `
with objects as (
select 'function' kind, format('%I.%I(%s)', n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) identity,
  jsonb_build_object('definition',pg_get_functiondef(p.oid),'owner',pg_get_userbyid(p.proowner),'acl',case when p.proacl is null then null else (select coalesce(array_agg(item::text order by item::text),'{}'::text[]) from unnest(p.proacl) item) end) definition
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind in ('f','p')
union all
select 'relation',format('%I.%I',n.nspname,c.relname),jsonb_build_object('kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'acl',case when c.relacl is null then null else (select coalesce(array_agg(item::text order by item::text),'{}'::text[]) from unnest(c.relacl) item) end,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity,'persistence',c.relpersistence,'view',case when c.relkind in ('v','m') then pg_get_viewdef(c.oid,true) else null end,'options',c.reloptions)
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p','v','m','S','f')
union all
select 'column',format('%I.%I.%I',n.nspname,c.relname,a.attname),jsonb_build_object('position',row_number() over (partition by a.attrelid order by a.attnum),'type',format_type(a.atttypid,a.atttypmod),'notNull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'acl',case when a.attacl is null then null else (select coalesce(array_agg(item::text order by item::text),'{}'::text[]) from unnest(a.attacl) item) end,'identity',a.attidentity,'generated',a.attgenerated)
from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname='public' and c.relkind in ('r','p','v','m','f') and a.attnum>0 and not a.attisdropped
union all
select 'constraint',format('%I.%I.%I',n.nspname,c.relname,x.conname),jsonb_build_object('definition',pg_get_constraintdef(x.oid,true),'validated',x.convalidated,'deferrable',x.condeferrable,'deferred',x.condeferred)
from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
union all
select 'index',format('%I.%I.%I',n.nspname,c.relname,i.relname),jsonb_build_object('definition',pg_get_indexdef(x.indexrelid),'valid',x.indisvalid,'ready',x.indisready)
from pg_index x join pg_class c on c.oid=x.indrelid join pg_class i on i.oid=x.indexrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
union all
select 'trigger',format('%I.%I.%I',n.nspname,c.relname,t.tgname),jsonb_build_object('definition',pg_get_triggerdef(t.oid,true),'enabled',t.tgenabled)
from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal
union all
select 'policy',format('%I.%I.%I',n.nspname,c.relname,p.polname),jsonb_build_object('command',p.polcmd,'permissive',p.polpermissive,'roles',(select array_agg(case when r=0 then 'public' else pg_get_userbyid(r) end order by case when r=0 then 'public' else pg_get_userbyid(r) end) from unnest(p.polroles) r),'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid))
from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
union all
select 'enum',format('%I.%I',n.nspname,t.typname),jsonb_build_object('owner',pg_get_userbyid(t.typowner),'acl',case when t.typacl is null then null else (select coalesce(array_agg(item::text order by item::text),'{}'::text[]) from unnest(t.typacl) item) end,'labels',(select array_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid=t.oid))
from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e'
union all
select 'defaultAcl',format('%s.%s.%s',pg_get_userbyid(d.defaclrole),coalesce(n.nspname,''),d.defaclobjtype),jsonb_build_object('acl',case when d.defaclacl is null then null else (select coalesce(array_agg(item::text order by item::text),'{}'::text[]) from unnest(d.defaclacl) item) end)
from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace where n.nspname='public' or d.defaclnamespace=0
union all
select 'schema','public',jsonb_build_object('owner',pg_get_userbyid(n.nspowner),'acl',case when n.nspacl is null then null else (select coalesce(array_agg(item::text order by item::text),'{}'::text[]) from unnest(n.nspacl) item) end) from pg_namespace n where n.nspname='public'
) select kind,identity,definition from objects order by kind,identity`;
export async function catalog(client) {
  await client.query("set search_path=public,extensions");
  const scopedCatalog = catalogSql.replaceAll("n.nspname='public'", "n.nspname in ('public','auth','storage','supabase_migrations')").replace("select 'schema','public',", "select 'schema',n.nspname,");
  return (await client.query(scopedCatalog)).rows;
}
export function differences(before, after) {
  const previous = new Map(before.map(row => [row.kind + ":" + row.identity, row]));
  const next = new Map(after.map(row => [row.kind + ":" + row.identity, row]));
  return {
    added: after.filter(row => !previous.has(row.kind + ":" + row.identity)),
    removed: before.filter(row => !next.has(row.kind + ":" + row.identity)),
    changed: before.filter(row => next.has(row.kind + ":" + row.identity) && JSON.stringify(row) !== JSON.stringify(next.get(row.kind + ":" + row.identity))).map(row => ({ before: row, after: next.get(row.kind + ":" + row.identity) })),
  };
}

export async function publicRowHashes(client, tableNames) {
  const names = tableNames ?? (await client.query("select tablename from pg_tables where schemaname='public' order by tablename")).rows.map(row => row.tablename);
  const result = {};
  for (const table of names) result[table] = (await client.query(`select count(*)::int count,md5(coalesce(string_agg(h,'' order by h),'')) hash from (select md5(to_jsonb(r)::text) h from public.${quote(table)} r) q`)).rows[0];
  return result;
}
