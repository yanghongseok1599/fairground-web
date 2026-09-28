import type { PushEnvironment } from "../push-environment";
import { BrowserLinkHelp } from "@/features/browser-handoff/components/browser-link-help";

export function IosPushInstallGuide({ environment }: { environment: PushEnvironment }) {
  return <div className="space-y-2 text-sm leading-relaxed">
    <p className="font-bold">홈 화면의 FairGround에서 알림을 확인해주세요</p>
    <p>이미 추가했다면 홈 화면의 FairGround 아이콘으로 열어주세요. 이 브라우저 탭에서는 홈 화면 앱의 알림 권한을 확인하거나 변경할 수 없습니다.</p>
    <details>
      <summary className="cursor-pointer py-2 font-bold">아직 홈 화면에 없다면 추가하는 방법</summary>
      <ol className="list-decimal space-y-1 pl-5">
        <li>{environment.inApp
          ? "Chrome 또는 Safari 앱에서 이 페이지를 여세요."
          : environment.browser === "chrome"
            ? "현재 Chrome의 주소창 옆 공유 버튼을 누르세요."
            : "현재 브라우저의 공유 버튼을 누르세요. 보이지 않으면 더보기 메뉴를 확인해주세요."}</li>
        <li>{environment.inApp ? "브라우저의 공유 메뉴에서 " : "공유 메뉴에서 "}홈 화면에 추가를 누르세요. ‘웹 앱으로 열기’가 보이면 켜두세요.</li>
        <li>추가한 아이콘으로 열고 로그인한 뒤, 마이페이지에서 대회 알림을 켜고 ‘허용’을 선택하세요.</li>
      </ol>
      <p className="mt-2 text-xs text-muted-foreground">iOS·iPadOS 16.4 이상이 필요합니다. Chrome에서도 홈 화면에 추가할 수 있습니다.</p>
      {environment.inApp && <BrowserLinkHelp browserName="Chrome 또는 Safari" />}
    </details>
  </div>;
}
