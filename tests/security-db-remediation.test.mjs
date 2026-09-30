import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import pg from 'pg';

// Isolated synthetic fixture only: no environment DB URL and no TCP listener.
test('new migration denies missing/NULL actors and preserves authorized roles and internal checks', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fg-sec-'));
  const cluster = path.join(dir, 'db');
  let started = false;
  let db;
  const id = n => `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
  try {
    execFileSync('initdb', ['-D',cluster,'-A','trust','-U','postgres'], {stdio:'pipe'});
    execFileSync('pg_ctl', ['-D',cluster,'-l',path.join(dir,'server.log'),'-o',`-k ${dir} -p 58431 -c listen_addresses=''`,'-w','start'], {stdio:'pipe'});
    started = true;
    db = new pg.Client({host:dir,port:58431,user:'postgres',database:'postgres'});
    await db.connect();
    const historical = fs.readFileSync('supabase/migrations/20260827000000_block_registered_players_from_playing.sql','utf8');
    const helper = historical.slice(historical.indexOf('create or replace function public.assert_player_is_eligible'),historical.indexOf('-- add_match_event'));
    await db.query(`
      create role anon; create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to anon,authenticated;
      create type player_role_t as enum ('player','referee','admin');
      create type team_role_t as enum ('member','captain','manager','coach');
      create table profiles(id uuid primary key,name text,role player_role_t not null default 'player',team_id uuid,team_role team_role_t,is_approved boolean not null default false,has_player_experience boolean not null default false);
      create table teams(id uuid primary key,name text,captain_id uuid);
      create table notifications(user_id uuid,kind text,title text,snippet text,actor_id uuid,team_id uuid);
      create function internal_eligibility_check(uuid) returns void language plpgsql security definer as $$begin perform public.assert_player_is_eligible($1); end$$;
    `);
    await db.query(helper);
    // Exercise the real downstream guards, rather than assuming definer UPDATE bypasses them.
    for (const column of ['card_rating','goals','assists','games','mom','season_yellow_cards','ban_matches_remaining','attendance_streak','attendance_streak_best']) {
      await db.query(`alter table profiles add column ${column} integer default 0`);
    }
    await db.query('alter table profiles add column is_banned boolean default false');
    await db.query("create function is_admin() returns boolean language sql stable as $$select exists(select 1 from profiles where id=auth.uid() and role='admin')$$");
    const hardening = fs.readFileSync('supabase/migrations/20260829020000_codex_security_authorization_hardening.sql','utf8');
    await db.query(hardening.slice(hardening.indexOf('create or replace function public.guard_privileged_profile_cols'),hardening.indexOf('-- The function already exists')));
    const onboarding = fs.readFileSync('supabase/migrations/20260614020000_team_onboarding_dues_flow.sql','utf8');
    const guardStart = onboarding.indexOf('create or replace function public.guard_team_role_change');
    await db.query(onboarding.slice(guardStart,onboarding.indexOf('$$;',guardStart)+3));
    await db.query('create trigger trg_guard_team_role_change before update on profiles for each row execute function guard_team_role_change()');
    const migration = fs.readFileSync('supabase/migrations/20261001010000_security_findings_remediation.sql','utf8');
    await db.query(migration);
    await db.query(`insert into teams values($1,'합성 팀',$2),($3,'다른 합성 팀',null)`,[id(100),id(6),id(101)]);
    for (const [n,role,team,teamRole,approved] of [[1,'player',100,null,true],[2,'player',null,null,true],[3,'player',100,'member',true],[4,'player',100,'coach',true],[5,'player',100,'manager',true],[6,'player',100,'member',true],[7,'admin',null,null,true],[8,'player',100,'member',false],[9,'player',101,'member',true]]) {
      await db.query('insert into profiles(id,name,role,team_id,team_role,is_approved,has_player_experience) values($1,$2,$3,$4,$5,$6,false)',[id(n),`합성${n}`,role,team===null?null:id(team),teamRole,approved]);
    }
    async function asActor(n, action) {
      await db.query('begin');
      try {
        await db.query('set local role authenticated');
        await db.query("select set_config('request.jwt.claim.sub',$1,true)",[id(n)]);
        await action();
      } finally { await db.query('rollback'); }
    }
    for (const n of [1,2,3,8,99]) {
      await asActor(n, async () => assert.rejects(db.query('select set_team_member_role($1,$2)',[id(n===8?3:8),'coach']),/권한|사용자/));
    }
    for (const n of [4,6,7]) {
      await asActor(n, async () => {
        await db.query('select set_team_member_role($1,$2)',[id(8),'coach']);
      });
    }
    await asActor(5, async () => assert.rejects(db.query('select set_team_member_role($1,$2)',[id(8),'coach']),/매니저/));
    await asActor(5, async () => db.query('select set_team_member_role($1,$2)',[id(8),'captain']));
    await asActor(4, async () => assert.rejects(db.query('select set_team_member_role($1,$2)',[id(9),'member']),/권한|다른 팀/));
    for (const n of [3,99]) {
      await asActor(n,async () => assert.rejects(db.query('select set_player_eligibility($1,true)',[id(8)]),/권한/));
    }
    await asActor(7,async () => db.query('select set_player_eligibility($1,true)',[id(8)]));
    for (const role of ['anon','authenticated']) {
      const {rows} = await db.query("select has_function_privilege($1,'public.assert_player_is_eligible(uuid)','EXECUTE') allowed",[role]);
      assert.equal(rows[0].allowed,false);
    }
    await db.query('select internal_eligibility_check($1)',[id(8)]);
    await db.query('update profiles set has_player_experience=true where id=$1',[id(8)]);
    await assert.rejects(db.query('select internal_eligibility_check($1)',[id(8)]),/선출/);
    // Reapplication is safe and does not alter unrelated records.
    await db.query(migration);
    assert.equal((await db.query('select count(*)::int count from profiles')).rows[0].count,9);
  } finally {
    if (db) await db.end();
    if (started) execFileSync('pg_ctl',['-D',cluster,'-m','immediate','-w','stop'],{stdio:'pipe'});
    fs.rmSync(dir,{recursive:true,force:true});
  }
});
