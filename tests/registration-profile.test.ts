import assert from "node:assert/strict";
import { buildEditableProfileUpdate, buildRegistrationProfile, isValidRegistrationProfile } from "../src/lib/registration-profile.ts";

const profile = buildRegistrationProfile({
  name: " 홍길동 ",
  email: " player@example.com ",
  phone: " 010-1234-5678 ",
  gender: "male",
  birthDate: "2000-01-02",
  hasPlayerExperience: true,
});

assert.equal(profile.name, "홍길동");
assert.equal(profile.email, "player@example.com");
assert.equal(profile.phone, "010-1234-5678");
assert.equal(profile.gender, "male");
assert.equal(profile.birthDate, "2000-01-02");
assert.equal(profile.hasPlayerExperience, true);
assert.equal(isValidRegistrationProfile(profile), true);

assert.equal(isValidRegistrationProfile(buildRegistrationProfile({ name: "", email: "a@b.com", phone: "010", gender: "male", birthDate: "2000-01-01", hasPlayerExperience: false })), false);
assert.equal(isValidRegistrationProfile(buildRegistrationProfile({ name: "홍", email: "", phone: "010", gender: "male", birthDate: "2000-01-01", hasPlayerExperience: false })), false);
assert.equal(isValidRegistrationProfile(buildRegistrationProfile({ name: "홍", email: "a@b.com", phone: "", gender: "male", birthDate: "2000-01-01", hasPlayerExperience: false })), false);
assert.equal(isValidRegistrationProfile(buildRegistrationProfile({ name: "홍", email: "a@b.com", phone: "010", gender: "", birthDate: "2000-01-01", hasPlayerExperience: false })), false);
assert.equal(isValidRegistrationProfile(buildRegistrationProfile({ name: "홍", email: "a@b.com", phone: "010", gender: "male", birthDate: "", hasPlayerExperience: false })), false);

const update = buildEditableProfileUpdate({
  name: " 김민수 ",
  email: " minsu@example.com ",
  phone: " 010-9999-8888 ",
  gender: "female",
  birthDate: "1998-03-04",
  hasPlayerExperience: false,
});
assert.deepEqual(update, {
  name: "김민수",
  email: "minsu@example.com",
  phone: "010-9999-8888",
  gender: "female",
  birthDate: "1998-03-04",
  hasPlayerExperience: false,
});

console.log("registration-profile tests passed");
