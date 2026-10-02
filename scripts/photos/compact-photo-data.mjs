import { createHash } from 'node:crypto';

// This module neither connects to production nor starts/commits transactions.
// The operator must first verify a restorable schema backup, rehearsal, originals,
// consent, and the protected-row/schema/history checks documented in the release.
export const photoDigest = value => value === null ? null : createHash('md5').update(value).digest('hex');
export function photoReplacement(before, after) {
  if (before.id !== after.id) throw new Error('Photo owner mismatch');
  return { id: before.id, old_photo: photoDigest(before.photo_url), old_profile: photoDigest(before.profile_photo_url),
    photo_url: after.photo_url, profile_photo_url: after.profile_photo_url };
}
export async function applyPhotoReplacements(db, replacements) {
  if (!replacements.length) return 0;
  if (new Set(replacements.map(r => r.id)).size !== replacements.length) throw new Error('Duplicate photo owner');
  const result = await db.query(`
    update public.profiles p set photo_url=r.photo_url, profile_photo_url=r.profile_photo_url
    from jsonb_to_recordset($1::jsonb) as r(id uuid,old_photo text,old_profile text,photo_url text,profile_photo_url text)
    where p.id=r.id and p.portrait_consent_at is not null
      and md5(p.photo_url) is not distinct from r.old_photo
      and md5(p.profile_photo_url) is not distinct from r.old_profile
    returning p.id`, [JSON.stringify(replacements)]);
  if (result.rowCount !== replacements.length) throw new Error('Photo or consent changed; roll back the entire transaction');
  return result.rowCount;
}
