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
