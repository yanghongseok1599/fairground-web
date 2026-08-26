export type RegistrationGender = "male" | "female" | "other" | "prefer_not_to_say" | "";

export interface RegistrationProfileInput {
  name: string;
  email: string;
  phone: string;
  gender: RegistrationGender;
  birthDate: string;
  hasPlayerExperience: boolean;
}

export interface RegistrationProfile {
  name: string;
  email: string;
  phone: string;
  gender: RegistrationGender;
  birthDate: string;
  hasPlayerExperience: boolean;
}

export function buildRegistrationProfile(input: RegistrationProfileInput): RegistrationProfile {
  return {
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    gender: input.gender,
    birthDate: input.birthDate.trim(),
    hasPlayerExperience: input.hasPlayerExperience,
  };
}

export function buildEditableProfileUpdate(input: RegistrationProfileInput): RegistrationProfile {
  return buildRegistrationProfile(input);
}

export function isValidRegistrationProfile(profile: RegistrationProfile): boolean {
  return (
    profile.name.length > 0 &&
    profile.email.length > 0 &&
    profile.phone.length > 0 &&
    profile.gender.length > 0 &&
    profile.birthDate.length > 0
  );
}

/**
 * 한글 실명 여부.
 *
 * 구글 가입은 프로필 이름을 구글 계정의 full_name 에서 그대로 가져온다.
 * 구글 이름이 로마자면("Eunwoo", "Heewon Jung") 그 값이 경기 기록·선수 카드·
 * 장내 호명에 그대로 남는다. 실제로 최은우 선수가 "Eunwoo" 로 기록됐다.
 *
 * 외국인 참가자를 막을 수는 없으므로 하드 차단이 아니라 경고용으로 쓴다.
 * 판정은 한글 음절이 하나라도 있는지만 본다.
 */
export function hasKoreanName(name: string | null | undefined): boolean {
  return /[가-힣]/.test((name ?? "").trim());
}

/** 실명 확인이 필요한 이름인지 — 비어 있지 않은데 한글이 없는 경우. */
export function needsKoreanNameCheck(name: string | null | undefined): boolean {
  const trimmed = (name ?? "").trim();
  return trimmed.length > 0 && !hasKoreanName(trimmed);
}
