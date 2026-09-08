import type { SponsorProposal } from "@/features/sponsor-proposal/types";

const asset = (filename: string) => `/proposals/partner/${filename}`;

export const partnerProposal: SponsorProposal = {
  slug: "partner",
  sponsor: {
    name: "PARTNER BRAND",
    logoTreatment: "plain",
    logo: {
      src: asset("logo-partner-clean.png"),
      alt: "파트너 브랜드 로고",
    },
  },
  fairgroundLogo: {
    src: "/images/fairground-logo-transparent-blue.png",
    alt: "FairGround",
  },
  copy: {
    benefits: {
      title: "파트너 브랜드가 받는 파트너십 혜택은 네 가지입니다.",
      description:
        "현물협찬은 제품·서비스 제공을 중심으로 구성합니다. OFFICIAL 200만원은 경기장 로고 노출과 촬영물을, MAIN 500만원은 메인 노출·영상·참가자 전원 SNS 바이럴 이벤트를 추가로 제공합니다.",
    },
    exposure: {
      title: "기록 경험과 브랜드가 만나는 장면으로 노출합니다.",
      description:
        "선수카드는 FairGround의 기록 경험으로, 배너·포토존은 파트너 브랜드 노출로 연결됩니다. 노출 위치와 제작 형식은 파트너 확정 후 미리 확인받고, 확정된 로고 파일을 모든 제작물에 동일하게 적용합니다.",
    },
    deliverablesTitle: "경기장의 한 장면이 브랜드의 콘텐츠가 됩니다.",
    packagesTitle: "현물·제작비·콘텐츠 협업을 조합해 기업별 목적에 맞게 설계합니다.",
    timelineTitle: "파트너 확정 후 로고 적용·현장 촬영·콘텐츠 발행 순서로 진행합니다.",
    contact: {
      title: "처음의 만남을 지속 가능한 파트너십으로 확장합니다.",
      ctaTitle: "파트너십 방식을 선택해 주세요.",
      ctaDescription:
        "현물 협찬과 현금 후원 중 목적에 맞는 방식을 정하면 로고 노출 위치, 제작물 수량, 콘텐츠 발행 일정을 문서로 확정합니다.",
    },
  },
  event: {
    date: "2026.10.03 SAT",
    time: "09:00–18:30",
    venue: "엠무브 은평점",
    category: "혼성 풋살대회",
    title: "끝까지 남는 12팀의 하루",
    image: {
      src: asset("editorial-match-brand.jpg"),
      alt: "혼성 풋살대회 참가팀 경기 현장",
    },
    metrics: [
      { value: "12", label: "참가팀" },
      { value: "5", label: "팀당 최소 경기" },
      { value: "1 DAY", label: "하루 집중 운영" },
    ],
    facts: [
      { title: "2026.10.03 SAT", detail: "09:00–18:30" },
      { title: "엠무브 은평점", detail: "서울 은평구" },
      { title: "혼성 5인 풋살", detail: "아마추어 전용 · 탈락 없음" },
      { title: "2개 그룹", detail: "A조 6팀 / B조 6팀" },
    ],
  },
  hero: {
    eyebrow: "OFFICIAL PARTNERSHIP PROPOSAL · 2026",
    title: "함께 뛰고, 함께 성장하는 파트너십",
    benefits: "경기장 배너·포토존 로고 · 선수카드 기록 경험 · 세로형 1분 브랜드 영상 · 참가자 인증샷·UGC 확산",
    priceSummary: "현물협찬 / OFFICIAL 200만원 / MAIN 500만원",
    image: {
      src: asset("editorial-hero-brand.jpg"),
      alt: "참가자에게 전달되는 파트너 브랜드 키트 구성",
    },
    caption: "대회는 하루지만, 브랜드 경험은 오래 남습니다.",
  },
  benefits: [
    {
      title: "현장 로고 노출",
      description:
        "경기장 필드 사이드 배너와 포토존에 파트너 브랜드 로고를 적용하고, MAIN 파트너는 경기장 외벽 메인 대형 현수막을 추가합니다.",
    },
    {
      title: "선수카드 기록 경험",
      description:
        "개인의 경기·골·어시스트·MOM은 선수카드에 쌓이고, 팀의 누적 성적은 다음 대회 승급 티어로 이어집니다.",
    },
    {
      title: "세로형 1분 브랜드 영상",
      description:
        "참가자의 생생한 순간과 브랜드 메시지를 연결한 세로형 1분 캠페인 영상을 제작해 공식 SNS에 게시합니다.",
    },
    {
      title: "참가자 UGC 확산",
      description:
        "파트너 제공 혜택을 참가자에게 전달해 인증샷·체험 후기를 유도하고, 공식 계정 리그램으로 자발적 공유를 확산합니다.",
    },
  ],
  benefitExamples: [
    {
      title: "전담 작가 촬영 결과물",
      note: "제품샷·참여자 인증샷 위주의 촬영 방향 시안",
      image: {
        src: asset("editorial-shoot-brand.jpg"),
        alt: "포토존에서 참가자 인증샷을 촬영하는 현장",
      },
    },
    {
      title: "선수카드",
      note: "첫 기록 BRONZE에서 누적 성장 PLATINUM까지",
      image: {
        src: asset("card-progression.png"),
        alt: "BRONZE에서 PLATINUM까지 성장하는 선수카드",
      },
    },
    {
      title: "실제 브랜드 영상 예시",
      note: "아미노코치 릴스 원본 · 26초 레퍼런스",
      image: {
        src: asset("amino-coach-brand-film-poster.jpg"),
        alt: "아미노코치 릴스 영상의 풋살 경기 장면",
      },
      video: {
        src: asset("amino-coach-brand-film.mp4"),
      },
      variant: "social-video",
    },
  ],
  playerCard: {
    title: "개인은 선수카드로, 팀은 티어로 성장합니다.",
    description:
      "카드에는 선수 사진, 포지션, 골, 어시스트, 경기 수, MOM 기록을 표시합니다. 경기 기록이 쌓일수록 카드와 개인의 이야기가 함께 성장하고, 참가자는 완성된 카드를 저장해 개인 SNS에 공유할 수 있습니다.",
    images: [
      { src: asset("card-bronze.png"), alt: "BRONZE 티어 선수카드 · 첫 기록" },
      { src: asset("card-platinum.png"), alt: "PLATINUM 티어 선수카드 · 누적 성장" },
    ],
    steps: [
      { title: "경기 기록 표시", description: "골, 어시스트, 경기 수, MOM을 카드에 표시합니다." },
      {
        title: "티어 성장 반영",
        description: "첫 기록 BRONZE에서 누적 성장 PLATINUM까지 카드 등급이 함께 올라갑니다.",
      },
      { title: "참가자용 이미지 제공", description: "참가자가 저장하고 공유할 수 있는 이미지 파일을 제공합니다." },
      { title: "UGC 확산 연계", description: "선수카드를 참가자 인증샷·리그램 콘텐츠에 활용합니다." },
    ],
  },
  teamProgression: {
    title: "팀의 누적 성적은 다음 대회 승급 티어로 이어집니다.",
    description:
      "경기 결과를 팀 단위로 누적해 다음 리그 티어를 결정합니다. 참여 → 성장 → 경쟁 → 챔피언 순서로 팀 등급이 올라가고, 승급 기록은 팀카드·선수카드·SNS 콘텐츠로 이어집니다.",
    image: {
      src: asset("team-tier-grid.png"),
      alt: "BRONZE 참여에서 PLATINUM 챔피언까지 팀 성적에 따라 승급하는 구조",
    },
    tiers: [
      { label: "BRONZE", title: "참여", detail: "첫 대회 기본 티어" },
      { label: "SILVER", title: "성장", detail: "시즌 기록 누적" },
      { label: "GOLD", title: "경쟁", detail: "상위권 경쟁" },
      { label: "PLATINUM", title: "챔피언", detail: "우승 · 최상위 티어" },
    ],
    sponsorValue:
      "파트너는 팀 승급·우승 기록을 선수카드와 시즌 콘텐츠로 계속 확인할 수 있고, 팀이 성장할수록 브랜드 노출이 반복됩니다.",
  },
  exposures: [
    {
      label: "PLAYER CARD",
      title: "선수카드",
      description: "홈페이지에 실제 발급되는 선수카드에 개인의 경기·골·어시스트·MOM 기록이 쌓입니다.",
      image: { src: asset("card-player.png"), alt: "홈페이지 실제 선수카드" },
    },
    {
      label: "FIELD SIDE BANNER",
      title: "경기장 배너",
      description: "필드 사이드 배너와 경기장 외벽 대형 현수막에 파트너 브랜드 로고를 노출합니다.",
      image: { src: asset("exposure-banner-brand.png"), alt: "FAIRGROUND × PARTNER BRAND 필드 사이드 배너" },
    },
    {
      label: "PHOTO ZONE",
      title: "포토존",
      description: "포토존 백드롭에 로고를 노출하고 참가자 인증샷·하이라이트 콘텐츠로 이어집니다.",
      image: { src: asset("exposure-photozone-brand.jpg"), alt: "대회 현장 포토존 백드롭" },
    },
  ],
  exposureSummary: {
    official: "경기장 배너·포토존 로고 + 공식 SNS 결과 콘텐츠 + 전담 작가 촬영 사진 포함",
    main: "경기장 외벽 메인 대형 현수막 + 세로형 1분 브랜드 영상 + 참가자 전원 SNS 바이럴 이벤트 추가",
  },
  deliverablesImage: {
    src: asset("deliverables-event-2.png"),
    alt: "FairGround 경기장 잔디 위에서 선수카드와 협찬 제품을 소개하는 장면",
  },
  deliverablesImageVariant: "portrait",
  deliverables: [
    {
      title: "전담 촬영작가 배치",
      description: "경기장 내 전문 촬영작가를 전담 배치해 제품샷과 참여자 인증샷 위주로 촬영합니다.",
    },
    {
      title: "참가자 참여 장면 촬영",
      description: "경기 전후 참가자의 생생한 참여 장면을 사전 초상권 동의를 받아 촬영합니다.",
    },
    {
      title: "제품·서비스 자연 노출",
      description: "파트너 제품·서비스가 현장에서 자연스럽게 등장하도록 연출합니다.",
    },
    {
      title: "브랜드 메시지 연결",
      description: "팀의 환한 표정과 브랜드 메시지를 연결한 콘텐츠로 편집합니다.",
    },
    {
      title: "세로형 1분 캠페인 영상",
      description: "촬영 원본을 편집해 세로형 1분 캠페인 영상과 편집본을 제공합니다.",
    },
  ],
  packages: [
    {
      name: "현물협찬",
      price: "제품 제공",
      summary:
        "제품·서비스를 제공하는 협업 패키지입니다. 협찬 품목과 수량에 따라 현장 노출과 콘텐츠 제작 범위를 협의합니다.",
      items: [
        "제품·서비스 현물 제공",
        "경기장 제품 노출·샘플링",
        "제품샷·착용샷 촬영",
        "상품 증정 장면 촬영",
        "협찬 품목·수량별 세부 협의",
      ],
    },
    {
      name: "OFFICIAL PARTNER",
      price: "200만원",
      summary:
        "경기장 배너·포토존 로고 노출, 공식 SNS 결과 콘텐츠, 전담 작가 촬영 사진과 선수카드 기록 연계를 제공합니다.",
      items: [
        "경기장 배너 · 포토존 로고",
        "공식 SNS 결과 콘텐츠",
        "전담 작가 촬영 사진",
        "선수카드 기록 경험 연계",
      ],
    },
    {
      name: "MAIN PARTNER",
      price: "500만원",
      summary:
        "OFFICIAL 혜택 전체에 경기장 외벽 메인 대형 현수막, 세로형 1분 브랜드 영상, SNS 콘텐츠 5건과 참가자 전원 SNS 바이럴 이벤트를 추가합니다.",
      items: [
        "OFFICIAL 혜택 전체 포함",
        "경기장 외벽 메인 대형 현수막",
        "세로형 1분 브랜드 영상 1편",
        "SNS 콘텐츠 5건 게시",
        "참가자 전원 SNS 바이럴 이벤트",
      ],
      recommended: true,
    },
  ],
  comparison: [
    { label: "경기장 배너 · 포토존 로고", inKind: "협의", official: "포함", main: "포함" },
    { label: "공식 SNS 결과 콘텐츠", inKind: "협의", official: "포함", main: "포함" },
    { label: "전담 작가 촬영 사진", inKind: "협의", official: "포함", main: "포함" },
    { label: "선수카드 기록 경험 연계", inKind: "—", official: "포함", main: "포함" },
    { label: "경기장 외벽 메인 대형 현수막", inKind: "—", official: "—", main: "포함" },
    { label: "세로형 1분 브랜드 영상", inKind: "—", official: "—", main: "1편" },
    { label: "SNS 콘텐츠 게시", inKind: "—", official: "—", main: "5건" },
    { label: "참가자 전원 SNS 바이럴 이벤트", inKind: "—", official: "—", main: "포함" },
  ],
  packageNote:
    "현물 협찬(PRODUCT PARTNER)은 참가자 수 기준 제품·서비스 제공, 현장 체험·샘플링 운영, 공식 SNS 인증 콘텐츠, 추가 경품·운영진 키트를 조합해 별도 협의합니다(참가자 수 × 제품 1개 권장). 세부 권리·노출 범위·일정은 협의 후 확정합니다.",
  phases: [
    {
      label: "BEFORE",
      title: "로고·제품 확인",
      description: "로고 파일, 제품 샘플, 노출 범위와 사전 초상권 동의 절차를 확정합니다.",
      output: "디자인 적용안 / 촬영 계획",
      tone: "soft",
    },
    {
      label: "MATCH DAY",
      title: "현장 실행",
      description:
        "경기장 배너·포토존 로고를 노출하고, 전담 작가 촬영과 참가자 혜택 전달·인증샷 유도를 진행합니다.",
      output: "촬영 원본 / 경기 기록",
      tone: "primary",
    },
    {
      label: "AFTER",
      title: "콘텐츠 발행",
      description:
        "선수카드와 세로형 1분 브랜드 영상을 제작하고, 공식 계정 리그램으로 참가자 UGC를 확산합니다.",
      output: "선수카드 / 브랜드 영상 / SNS 콘텐츠",
      tone: "deep",
    },
  ],
  contact: {
    representative: "FairGround 대표 김재민",
    phone: "010-7768-3731",
    phoneHref: "tel:+821077683731",
    email: "info@fairground-kor.com",
    emailHref: "mailto:info@fairground-kor.com",
    website: "fairground-kor.com",
    websiteHref: "https://fairground-kor.com",
    proof: "현재 후원 파트너 · AMINO COACH",
  },
};
