export type PushConnectionFailure = "unsupported" | "permission" | "worker" | "key" | "subscription" | "login" | "save" | "account";
export type PushConnectionResult = { ok: true } | { ok: false; reason: PushConnectionFailure };

export const PUSH_CONNECTION_MESSAGE: Record<PushConnectionFailure, string> = {
  unsupported: "이 화면에서는 알림을 연결할 수 없습니다. 아이폰은 홈 화면에 웹 앱으로 추가한 FairGround에서 다시 시도해주세요.",
  permission: "현재 화면에서 알림 권한을 허용받지 못했습니다. 아이폰 설정이 이미 켜져 있다면 홈 화면의 FairGround 앱을 완전히 닫고 다시 열어 연결해주세요.",
  worker: "알림을 받을 준비를 완료하지 못했습니다. 페이지를 새로고침한 뒤 다시 연결해주세요.",
  key: "서버에서 알림 연결 정보를 가져오지 못했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.",
  subscription: "휴대폰의 알림 수신 주소를 만들지 못했습니다. 인터넷 연결을 확인한 뒤 앱을 다시 열어 연결해주세요.",
  login: "로그인 상태를 확인하지 못했습니다. 이 앱에서 다시 로그인한 뒤 알림을 연결해주세요.",
  save: "알림 권한은 허용되었지만 서버에 수신 연결을 저장하지 못했습니다. 기존 기기 연결은 유지됩니다. 잠시 후 다시 연결해주세요.",
  account: "이 계정의 수신 연결을 확인하지 못했습니다. 이 기기에서 다른 계정의 알림을 사용했다면 그 계정에서 알림을 끈 뒤 현재 계정으로 다시 연결해주세요.",
};
