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

// 구글 가입은 구글 계정 full_name 을 그대로 프로필 이름으로 쓴다.
// 실제 사고: 최은우 선수가 "Eunwoo" 로 기록돼 경기 기록·선수 카드에 남았다.
import { hasKoreanName, needsKoreanNameCheck } from "../src/lib/registration-profile.ts";

assert.equal(hasKoreanName("최은우"), true);
assert.equal(hasKoreanName("김 재민"), true);
assert.equal(hasKoreanName("Eunwoo"), false);
assert.equal(hasKoreanName("Heewon Jung"), false);
assert.equal(hasKoreanName(""), false);
assert.equal(hasKoreanName(null), false);

// 비어 있으면 별도의 필수값 검증이 처리하므로 실명 경고는 띄우지 않는다
assert.equal(needsKoreanNameCheck(""), false);
assert.equal(needsKoreanNameCheck("   "), false);
assert.equal(needsKoreanNameCheck("Eunwoo"), true);
assert.equal(needsKoreanNameCheck("최은우"), false);

console.log("korean-name checks passed");
