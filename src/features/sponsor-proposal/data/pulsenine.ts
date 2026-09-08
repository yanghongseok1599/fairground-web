import type { SponsorProposal } from "@/features/sponsor-proposal/types";

const asset = (filename: string) => `/proposals/pulsenine/${filename}`;

export const pulsenineProposal: SponsorProposal = {
  slug: "pulsenine",
  sponsor: {
    name: "PULSE NINE",
    logoTreatment: "dark-surface",
    logo: {
      src: asset("logo-pulsenine-official.png"),
      alt: "PULSE NINE 공식 로고",
    },
  },
  fairgroundLogo: {
    src: "/images/fairground-logo-transparent-blue.png",
    alt: "FairGround",
  },
  copy: {
    benefits: {
      title: "PULSE NINE에 제공하는 후원 혜택은 네 가지입니다.",
      description:
        "OFFICIAL 패키지는 선수카드, 경기장 내 현수막·배너와 포토존 로고 노출, 참가자 SNS 바이럴 이벤트, 전담 작가 촬영 사진, 1분 PULSE NINE 홍보 영상 1편을 제공합니다. MAIN 패키지는 메인 외부 현수막과 FairGround SNS 홍보 5회를 추가합니다.",
    },
    exposure: {
      title: "PULSE NINE 제품과 로고를 선수카드·현장·SNS 콘텐츠에 노출합니다.",
      description:
        "노출 위치와 제작 형식을 후원 확정 후 미리 확인받고, 확정된 로고 파일을 모든 제작물에 동일하게 적용합니다.",
    },
    deliverablesTitle: "패키지별 제작물을 아래와 같이 제공합니다.",
    packagesTitle: "제공 범위에 따라 OFFICIAL과 MAIN 중 선택할 수 있습니다.",
    timelineTitle: "후원 확정 후 로고 적용·현장 촬영·콘텐츠 발행 순서로 진행합니다.",
    contact: {
      title: "패키지와 제공 제품을 확정하면 제작 일정을 안내드립니다.",
      ctaTitle: "후원 패키지를 선택해 주세요.",
      ctaDescription:
        "패키지 선택 후 로고 노출 위치, 제작물 수량, 팀웨어 제공 방식, 콘텐츠 발행 일정을 문서로 확정합니다.",
    },
  },
  event: {
    date: "2026.10.03 SAT",
    time: "09:00–18:30",
    venue: "엠무브 은평점",
    category: "혼성 풋살대회",
    title: "2026년 10월 3일, 12팀이 하루 동안 참가합니다.",
    image: {
      src: asset("editorial-match.png"),
      alt: "혼성 풋살대회 경기 현장 화보",
    },
    metrics: [
      { value: "12", label: "참가 팀" },
      { value: "5+", label: "팀당 최소 경기" },
      { value: "1 DAY", label: "하루 집중 운영" },
    ],
    facts: [
      { title: "2026.10.03 SAT", detail: "09:00–18:30" },
      { title: "엠무브 은평점", detail: "서울 은평구" },
      { title: "혼성 5인제", detail: "아마추어 · 탈락 없는 리그형 운영" },
      { title: "2개 그룹", detail: "A/B 각 6팀" },
    ],
  },
  hero: {
    eyebrow: "2026 공식 후원 제안",
    title: "PULSE NINE가 받는 후원 혜택을 제안합니다.",
    benefits: "선수카드 · 경기장 배너·포토존 로고 · 1분 PULSE NINE 홍보 영상 · 전담 작가 촬영",
    priceSummary: "OFFICIAL 200만원 / MAIN 500만원",
    image: {
      src: asset("editorial-hero.png"),
      alt: "PULSE NINE 유니폼과 팀 컬러가 적용된 큐브형 스포츠 화보",
    },
    caption: "실사용 촬영 느낌으로 정돈한 PULSE NINE 제안용 이미지 구성입니다.",
  },
  benefits: [
    {
      title: "선수카드 노출",
      description: "PULSE NINE 유니폼 착용 사진과 개인 경기 기록을 선수별 이미지로 제작합니다.",
    },
    {
      title: "현장 로고 노출",
      description: "경기장 내 현수막·배너와 포토존에 PULSE NINE 로고를 적용합니다.",
    },
    {
      title: "1분 PULSE NINE 홍보 영상·SNS 바이럴",
      description:
        "제품 홍보물을 촬영해 1분 영상을 제작·게시합니다. 참가자 전원 대상 SNS 바이럴 이벤트를 진행하고, 참여자에게 FairGround 혜택을 제공해 참여를 유도합니다.",
    },
    {
      title: "전담 촬영작가 배치",
      description:
        "현장 전담 작가가 제품 단독 사진, 착용 사진, 상품 증정 장면을 촬영하고 브랜드가 홍보에 사용할 수 있는 사진 파일로 제공합니다.",
    },
  ],
  benefitExamples: [
    {
      title: "전담 작가 촬영 결과물",
      note: "제품샷·착용샷·상품 증정 장면의 촬영 방향 시안",
      image: {
        src: asset("editorial-shoot.png"),
        alt: "PULSE NINE 상품 증정 장면을 촬영한 화보 시안",
      },
    },
    {
      title: "선수카드",
      note: "PULSE NINE 유니폼 적용 시안",
      image: {
        src: asset("card-male.png"),
        alt: "PULSE NINE 선수카드 예시",
      },
    },
    {
      title: "1분 PULSE NINE 홍보 영상",
      note: "PULSE NINE 착용 현장을 촬영해 SNS용 영상 1편으로 제작",
      image: {
        src: asset("editorial-social.png"),
        alt: "PULSE NINE 유니폼을 착용한 SNS 콘텐츠 연출 시안",
      },
      variant: "social-video",
    },
  ],
  playerCard: {
    title: "선수카드에 PULSE NINE 유니폼 착용 이미지를 넣습니다.",
    description:
      "카드에는 선수 사진, 포지션, 골, 도움, 경기 수, MOM 기록을 표시합니다. 참가자는 완성된 이미지를 저장하고 개인 SNS에 공유할 수 있습니다.",
    images: [
      { src: asset("card-male.png"), alt: "PULSE NINE 남성 선수카드 예시" },
      { src: asset("card-female.png"), alt: "PULSE NINE 여성 선수카드 예시" },
    ],
    steps: [
      { title: "경기 기록 표시", description: "골, 도움, 경기 수, MOM을 카드에 표시합니다." },
      { title: "PULSE NINE 유니폼 표시", description: "선수 사진에서 PULSE NINE 팀웨어가 보이도록 제작합니다." },
      { title: "참가자용 이미지 제공", description: "참가자가 저장하고 공유할 수 있는 이미지 파일을 제공합니다." },
      { title: "SNS 바이럴 연계", description: "선수카드를 참가자 전원 대상 SNS 바이럴 이벤트에 활용합니다." },
    ],
  },
  teamProgression: {
    title: "팀 성적이 쌓이면 다음 시즌 상위 티어로 승급합니다.",
    description:
      "경기 결과를 팀 단위로 누적해 다음 시즌 리그를 결정합니다. 참여 → 성장 → 경쟁 → 챔피언 순서로 팀 등급이 올라가고, 승급 기록은 팀카드·선수카드·SNS 콘텐츠에 이어집니다.",
    image: {
      src: asset("team-tier-grid.png"),
      alt: "BRONZE 참여에서 EMERALD 챔피언까지 팀 성적에 따라 승급하는 구조",
    },
    tiers: [
      { label: "BRONZE", title: "참여", detail: "첫 시즌 기본 티어" },
      { label: "SILVER", title: "성장", detail: "시즌 기록 누적" },
      { label: "GOLD", title: "경쟁", detail: "상위권 경쟁" },
      { label: "EMERALD", title: "챔피언", detail: "우승·최상위 티어" },
    ],
    sponsorValue:
      "후원사는 팀 승급·우승 기록을 선수카드와 시즌 콘텐츠로 계속 확인할 수 있고, 팀이 성장할수록 브랜드 노출이 반복됩니다.",
  },
  exposures: [
    {
      label: "PLAYER CARD",
      title: "선수카드",
      description: "PULSE NINE 유니폼 착용 사진과 개인 경기 기록을 함께 표시합니다.",
      image: { src: asset("editorial-player.png"), alt: "PULSE NINE 선수단 착장 이미지" },
    },
    {
      label: "ON SITE",
      title: "현장 로고",
      description: "경기장 내 현수막·배너와 포토존에 PULSE NINE 로고를 노출하고 제품샷·착용샷·상품 증정 장면을 촬영합니다.",
      image: { src: asset("editorial-activation.png"), alt: "PULSE NINE 장비와 이벤트 현장 노출 시안" },
    },
    {
      label: "SOCIAL CAMPAIGN",
      title: "PULSE NINE 홍보 영상·SNS 바이럴",
      description: "1분 PULSE NINE 홍보 영상 1편을 제작하고 참가자 전원 대상 SNS 바이럴 이벤트를 진행합니다.",
      image: { src: asset("editorial-social.png"), alt: "PULSE NINE 팀웨어 SNS 콘텐츠 시안" },
    },
  ],
  exposureSummary: {
    official: "선수카드·경기장 배너·포토존 로고·SNS 바이럴 이벤트·전담 작가 사진·1분 PULSE NINE 홍보 영상 포함",
    main: "메인 외부 현수막·FairGround SNS 홍보 5회 추가",
  },
  deliverablesImage: {
    src: asset("editorial-shoot.png"),
    alt: "PULSE NINE 상품 증정 장면을 촬영하는 화보 시안",
  },
  deliverables: [
    {
      title: "PULSE NINE 유니폼 선수카드",
      description: "PULSE NINE 착용 사진과 개인 경기 기록을 합성한 이미지를 제작합니다.",
    },
    {
      title: "전담 작가 홍보 사진",
      description: "제품샷, 착용샷, 상품 증정 장면을 촬영해 홍보용 사진 파일로 제공합니다.",
    },
    {
      title: "참가자 SNS 바이럴 이벤트",
      description: "참가자 전원에게 참여를 안내하고, 참여자에게 FairGround 혜택을 제공해 참여율을 높입니다.",
    },
    {
      title: "1분 PULSE NINE 홍보 영상",
      description: "제품 홍보물을 촬영·편집해 OFFICIAL과 MAIN 파트너 모두에게 1분 홍보 영상 1편으로 제공합니다.",
    },
    {
      title: "제품 노출 협의",
      description: "제품 샘플 제공 시 촬영 위치와 노출 방식을 사전에 확정합니다.",
    },
  ],
  packages: [
    {
      name: "OFFICIAL PARTNER",
      price: "200만원",
      summary:
        "선수카드, 경기장 내 현수막·배너와 포토존 로고, SNS 바이럴 이벤트, 전담 작가 촬영 사진, 1분 PULSE NINE 홍보 영상 1편을 포함합니다.",
      items: [
        "PULSE NINE 유니폼 선수카드",
        "경기장 내 현수막·배너 로고",
        "포토존 PULSE NINE 로고",
        "참가자 전원 SNS 바이럴 이벤트",
        "제품샷·착용샷·상품 증정 사진",
        "1분 PULSE NINE 홍보 영상 1편",
      ],
    },
    {
      name: "MAIN PARTNER",
      price: "500만원",
      summary: "OFFICIAL 전 항목에 메인 외부 현수막과 FairGround SNS 제품 홍보 5회를 추가합니다.",
      items: [
        "OFFICIAL 전 항목 포함",
        "메인 외부 현수막 5000×1800",
        "FairGround SNS 제품 홍보 5회",
      ],
      recommended: true,
    },
  ],
  comparison: [
    { label: "선수카드 · 전담 작가 사진", official: "포함", main: "포함" },
    { label: "경기장 내 현수막·배너 · 포토존 로고", official: "포함", main: "포함" },
    { label: "참가자 전원 SNS 바이럴 이벤트", official: "포함", main: "포함" },
    { label: "1분 PULSE NINE 홍보 영상", official: "1편", main: "1편" },
    { label: "메인 외부 현수막", official: "—", main: "포함" },
    { label: "FairGround SNS 제품 홍보", official: "—", main: "5회" },
  ],
  packageNote: "세부 제작물, 제품 샘플 활용, 게시 일정은 파트너 확정 후 협의합니다.",
  phases: [
    {
      label: "BEFORE",
      title: "로고·제품 확인",
      description: "로고 파일, 팀웨어, 제품 샘플과 노출 범위를 확정합니다.",
      output: "디자인 적용안 / 촬영 계획",
      tone: "soft",
    },
    {
      label: "MATCH DAY",
      title: "현장 실행",
      description:
        "경기장 내 현수막·배너와 포토존 로고 노출, 선수카드 촬영, 제품샷·착용샷·상품 증정 장면 촬영을 진행합니다.",
      output: "홍보 사진 / 경기 기록",
      tone: "primary",
    },
    {
      label: "AFTER",
      title: "콘텐츠 발행",
      description:
        "선수카드와 1분 PULSE NINE 홍보 영상을 제작하고 참가자 SNS 바이럴 이벤트를 진행합니다.",
      output: "선수카드 / 영상 / SNS 바이럴",
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
    proof: "현재 후원 파트너 · AMINO COACH · PULSE NINE",
  },
};
