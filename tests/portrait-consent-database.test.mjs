import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const connectionString=process.env.FAIRGROUND_TEST_DB_URL;
if (!connectionString || !['127.0.0.1','localhost','[::1]'].includes(new URL(connectionString).hostname)) {
  throw new Error('FAIRGROUND_TEST_DB_URL must be an isolated LOCAL PostgreSQL database.');
}
const db=new pg.Client({connectionString});await db.connect();
try {
  // Minimal schema contract for these additive triggers. Never hosted/member data.
  await db.query(`create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
    create table profiles(id uuid primary key,name text,number int default 0,position text default 'ALA',photo_url text default '',profile_photo_url text default '',photo_scale numeric default 1,portrait_consent_at timestamptz);
    create table teams(id uuid primary key,captain_id uuid,name text,portrait_consent_at timestamptz);`);
  await db.query(readFileSync('supabase/migrations/20260915010000_portrait_consent_enforcement.sql','utf8'));
  const legacy=randomUUID(), signup=randomUUID(), member=randomUUID(), other=randomUUID();
  await db.query('insert into auth.users(id) values($1),($2),($3)',[legacy,member,other]);
  await db.query('insert into profiles(id,name) values($1,\'기존 회원\'),($2,\'신규 회원\'),($3,\'다른 회원\')',[legacy,member,other]);
  const asUser=(id)=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);
  await test('email-verified signup records explicit metadata consent with server time',async()=>{
    await db.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)',[signup,{portrait_consent:true}]);
    await db.query('insert into profiles(id) values($1)',[signup]);
    const at=(await db.query('select portrait_consent_at from profiles where id=$1',[signup])).rows[0].portrait_consent_at;
    assert.ok(Math.abs(Date.now()-at.getTime())<5000);
  });
  await test('OAuth/legacy accounts get no implied consent and cannot directly create cards',async()=>{
    await asUser(legacy);
    await assert.rejects(db.query('update profiles set number=7 where id=$1',[legacy]),/초상권/);
    await assert.rejects(db.query("update profiles set photo_url='photo' where id=$1",[legacy]),/초상권/);
    assert.equal((await db.query('select portrait_consent_at from profiles where id=$1',[legacy])).rows[0].portrait_consent_at,null);
    await db.query("update profiles set name='이름 변경' where id=$1",[legacy]);
  });
  await test('direct profile INSERT with card fields also requires personal consent',async()=>{
    const id=randomUUID();await asUser(id);await db.query('insert into auth.users(id) values($1)',[id]);
    await assert.rejects(db.query('insert into profiles(id,number) values($1,8)',[id]),/초상권/);
    await db.query("insert into profiles(id,number,portrait_consent_at) values($1,8,'2000-01-01')",[id]);
    const at=(await db.query('select portrait_consent_at from profiles where id=$1',[id])).rows[0].portrait_consent_at;
    assert.ok(Math.abs(Date.now()-at.getTime())<5000);
  });
  await test('team representative consent cannot substitute for personal consent',async()=>{
    await asUser(legacy);
    await assert.rejects(db.query('insert into teams(id,captain_id,portrait_consent_at) values($1,$2,now())',[randomUUID(),legacy]),/신청자 본인/);
  });
  await test('another actor cannot manufacture consent for a member',async()=>{
    await asUser(legacy);
    await assert.rejects(db.query('update profiles set portrait_consent_at=now() where id=$1',[other]),/본인만/);
  });
  let original;
  await test('explicit consent and card submission commit together using server timestamp',async()=>{
    await asUser(member);
    await db.query("update profiles set number=7,photo_url='photo',portrait_consent_at='2000-01-01' where id=$1",[member]);
    original=(await db.query('select portrait_consent_at from profiles where id=$1',[member])).rows[0].portrait_consent_at;
    assert.ok(Math.abs(Date.now()-original.getTime())<5000);
    await db.query('insert into teams(id,captain_id,portrait_consent_at) values($1,$2,now())',[randomUUID(),member]);
  });
  await test('editing and re-submission preserve the first recorded consent',async()=>{
    await asUser(member);
    await db.query("update profiles set number=9,portrait_consent_at='2030-01-01' where id=$1",[member]);
    assert.equal((await db.query('select portrait_consent_at from profiles where id=$1',[member])).rows[0].portrait_consent_at.getTime(),original.getTime());
  });
  await test('metadata edits after signup never silently count as renewed consent',async()=>{
    await asUser(legacy);
    await db.query('update auth.users set raw_user_meta_data=$1 where id=$2',[{portrait_consent:true},legacy]);
    await assert.rejects(db.query('update profiles set number=10 where id=$1',[legacy]),/초상권/);
  });
} finally {await db.end();}
