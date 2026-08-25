import { CheckCircle2, XCircle } from "lucide-react";
import {
  MIXED_FUTSAL_ELIGIBILITY_CHECK_NOTE,
  MIXED_FUTSAL_ELIGIBILITY_TIERS,
} from "@/lib/mixed-futsal-event";

/**
 * 종목·리그별 참가 자격 표.
 *
 * 비선출 기준(중등부 이상 선수 등록 이력)만으로는 "성인 이후 어느 리그까지
 * 뛰어도 되는지"가 안 잡혀서, 대회 소개·참가 신청 양쪽에서 같은 기준을 보여준다.
 * 문구는 lib/mixed-futsal-event 의 단일 소스를 그대로 렌더한다.
 */
export function MixedFutsalEligibilityTable({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="grid gap-3 sm:grid-cols-3">
        {MIXED_FUTSAL_ELIGIBILITY_TIERS.map((tier) => (
          <article
            key={tier.sport}
            className="border border-[#D0D8E8] bg-white p-4 sm:p-5"
          >
            <h4 className="text-[16px] font-black leading-[1.3] text-[#0D1B2A]">
              {tier.sport}
            </h4>

            <div className="mt-4">
              <div className="flex items-center gap-1.5">
                <XCircle className="h-4 w-4 shrink-0 text-[#B42318]" aria-hidden />
                <span className="fg-label text-[10px] text-[#B42318]">참가 불가</span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {tier.blocked.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-[13.5px] leading-[1.6] font-bold text-[#0D1B2A]"
                  >
                    <span
                      className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[#B42318]"
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 border-t border-[#D0D8E8] pt-4">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#0047AB]" aria-hidden />
                <span className="fg-label text-[10px] text-[#0047AB]">참가 가능</span>
              </div>
              <ul className="mt-2 space-y-1.5">
                {tier.allowed.map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-[13.5px] leading-[1.6] text-[#526277]"
                  >
                    <span
                      className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[#0047AB]"
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>

      <p className="mt-3 border-l-2 border-[#0047AB] bg-[#EEF3FF] px-4 py-3 text-[13px] leading-[1.7] text-[#526277]">
        {MIXED_FUTSAL_ELIGIBILITY_CHECK_NOTE}
      </p>
    </div>
  );
}
