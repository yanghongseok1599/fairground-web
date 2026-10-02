import type { Gender } from "@/types";

export const INSPECTION_GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "남성" },
  { value: "female", label: "여성" },
  { value: "other", label: "기타" },
  { value: "prefer_not_to_say", label: "응답 안 함" },
];

export function inspectionGenderLabel(value: string | null | undefined): string {
  return INSPECTION_GENDERS.find((option) => option.value === value)?.label ?? (value ? "확인 필요" : "미등록");
}

export function normalizeInspectionGender(input: string): Gender {
  const option = INSPECTION_GENDERS.find((item) => item.value === input);
  if (!option) throw new Error("성별을 선택해주세요.");
  return option.value;
}
