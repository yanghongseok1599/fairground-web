export const GLASSES_WAIVER_VERSION = "2026-10-03-v1";
export const GLASSES_WAIVER_TITLE = "안경 착용 위험 확인 및 책임 서약서";
export const GLASSES_WAIVER_CLAUSES = [
  "본인은 풋살 경기·훈련 중 공, 다른 참가자 또는 시설물과의 충돌로 안경이 파손되거나 안경테·렌즈에 의해 눈·얼굴 등 신체에 부상이 발생할 수 있음을 확인합니다.",
  "본인은 일반 안경을 벗거나 스포츠용 보호안경 등 안전한 대안을 선택할 수 있음을 안내받았으며, 안경을 착용한 상태로 참가하는 것은 본인의 자발적인 선택임을 확인합니다.",
  "본인은 본인의 안경 착용 선택 또는 부주의로 발생한 안경 파손과 본인의 부상에 대해 법령상 본인에게 귀속되는 책임 및 비용을 부담합니다. 주최·운영 측의 귀책사유가 없는 안경 착용 자체의 위험으로 발생한 손해에 대해서는 주최·운영 측에 책임을 묻지 않습니다.",
  "본인은 심판·운영진의 안전 지시를 따르며, 위험이 있거나 안경이 파손된 경우 즉시 경기를 중단하고 운영진에게 알리겠습니다. 이 서약은 경기 규정상 허용되지 않는 장비의 착용을 허가하는 것이 아닙니다.",
  "이 서약은 주최·운영 측 또는 다른 참가자의 고의·과실 등으로 인한 법률상 책임을 일괄 면제하거나, 법령상 배제할 수 없는 본인의 권리를 포기하는 의미가 아닙니다.",
  "본인은 위 내용을 읽고 이해했으며, 로그인한 본인 계정에서 이름을 직접 입력하고 서명 제출 버튼을 눌러 전자서명합니다. 회원 ID, 서명 이름, 서약 내용·버전 및 서명 시각이 서약 확인과 사고 발생 시 사실 확인을 위해 저장됩니다.",
] as const;

export type GlassesWaiverReceipt = {
  id: string;
  signer_name: string;
  version: string;
  document: string[];
  signed_at: string;
};

export function matchesSignerName(input: string, name: string): boolean {
  return name.trim().length > 0 && input.trim() === name.trim();
}

export function waiverReceiptText(receipt: GlassesWaiverReceipt): string {
  return [GLASSES_WAIVER_TITLE, ...receipt.document.map((text, index) => `${index + 1}. ${text}`),
    `전자서명: ${receipt.signer_name}`, `서명일시: ${receipt.signed_at}`, `서약 버전: ${receipt.version}`, `확인번호: ${receipt.id}`].join("\n\n");
}
