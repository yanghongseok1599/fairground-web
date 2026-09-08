import type { SponsorProposal } from "@/features/sponsor-proposal/types";
import { JUNTAS_PROPOSAL_PLAYER_CARDS } from "@/features/sponsor-proposal/data/juntas-player-cards";

const asset = (filename: string) => `/proposals/juntas/${filename}`;

export const juntasProposal: SponsorProposal = {
  slug: "juntas",
  sponsor: {
    name: "JUNTAS",
    logo: {
      src: asset("juntas-logo.png"),
      alt: "JUNTAS 공식 로고",
    },
  },
  fairgroundLogo: {
    src: "/images/fairground-logo-transparent-blue.png",
    alt: "FairGround",
  },
  copy: {
    benefits: {
      title: "JUNTAS에 제공하는 후원 혜택은 다섯 가지입니다.",
      description:
        "선수카드, 현장 로고, 제품 콘텐츠, SNS 바이럴, 공식 경기구 운영까지 제공 항목을 명확히 제시합니다.",
    },
    exposure: {
      title: "JUNTAS 제품과 로고를 선수카드·현장·SNS 콘텐츠에 노출합니다.",
      description:
        "노출 위치와 제작 형식을 후원 확정 후 미리 확인받고, 확정된 로고 파일을 모든 제작물에 동일하게 적용합니다.",
    },
    deliverablesTitle: "패키지별 제작물을 아래와 같이 제공합니다.",
    packagesTitle: "JUNTAS에 제공하는 후원 범위를 두 단계로 정리했습니다.",
    timelineTitle: "후원 확정 후 로고 적용·현장 촬영·콘텐츠 발행 순서로 진행합니다.",
    contact: {
      title: "패키지와 제공 제품을 확정하면 제작 일정을 안내드립니다.",
      ctaTitle: "후원 패키지를 선택해 주세요.",
      ctaDescription:
        "협찬 품목과 수량을 확정한 뒤 로고 노출 위치, 제작물, 촬영 일정과 게시 일정을 문서로 확정합니다.",
    },
  },
  event: {
    date: "2026.10.03 SAT",
    time: "09:00–18:30",
    venue: "엠무브 은평점",
    category: "혼성 풋살대회",
    title: "2026년 10월 3일, 12팀이 하루 동안 참가합니다.",
    image: {
      src: asset("editorial-match-v3.png"),
      alt: "JUNTAS 팀웨어를 착용한 가상 선수들의 풋살 경기 화보",
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
    title: "준타스가 받는 후원 혜택을 제안합니다.",
    benefits: "선수카드 · 경기장 배너·공동 포토월 · 공인구 4개 · 1분 JUNTAS 홍보 영상 · 전담 작가 촬영",
    priceSummary: "유니폼 · 삭스 · 팀조끼 · 공식 경기구 · 콘텐츠 제작",
    image: {
      src: asset("editorial-hero-v4.png"),
      alt: "JUNTAS 팀웨어를 착용한 가상 선수들의 축구팀 화보",
    },
    caption: "JUNTAS 팀웨어의 대회 현장 활용 모습을 담은 화보 시안입니다.",
  },
  benefits: [
    {
      title: "선수카드 노출",
      description: "준타스 유니폼 착용 사진과 개인 경기 기록을 선수별 이미지로 제작합니다.",
    },
    {
      title: "현장 로고 노출",
      description: "경기장 내 현수막·배너와 공동 후원 포토월에 준타스 로고를 적용합니다.",
    },
    {
      title: "1분 JUNTAS 홍보 영상·SNS 바이럴",
      description:
        "제품 홍보물을 촬영해 1분 영상을 제작·게시합니다. 참가자 전원 대상 SNS 바이럴 이벤트를 진행하고, 참여자에게 FairGround 혜택을 제공해 참여를 유도합니다.",
    },
    {
      title: "전담 촬영작가 배치",
      description:
        "현장 전담 작가가 제품 단독 사진, 착용 사진, 상품 증정 장면을 촬영하고 브랜드가 홍보에 사용할 수 있는 사진 파일로 제공합니다.",
    },
    {
      title: "공식 경기구 사용",
      description:
        "준타스 코모루즈 프로 풋살공 4호 매치볼 4개를 전 경기 공식 공인구로 사용하고, 경기·제품 노출 콘텐츠를 함께 제작합니다.",
    },
  ],
  benefitExamples: [
    {
      title: "전담 작가 촬영 결과물",
      note: "제품샷·착용샷·상품 증정 장면의 촬영 방향 시안",
      image: {
        src: asset("editorial-shoot-v3.png"),
        alt: "JUNTAS 팀웨어 상품 증정 장면을 촬영하는 화보 시안",
      },
    },
    {
      title: "선수카드",
      note: "실제 FairGround 공식 선수카드에 준타스 유니폼 적용",
      image: {
        src: asset("card-male-v3.png"),
        alt: "준타스 유니폼 선수카드 예시",
      },
      officialCard: JUNTAS_PROPOSAL_PLAYER_CARDS[0],
    },
    {
      title: "1분 JUNTAS 홍보 영상",
      note: "준타스 착용 현장을 촬영해 SNS용 영상 1편으로 제작",
      image: {
        src: asset("editorial-social-v3.png"),
        alt: "JUNTAS 팀웨어를 착용한 가상 선수들의 SNS 영상 화보 시안",
      },
      variant: "social-video",
    },
  ],
  playerCard: {
    title: "실제 FairGround 공식 선수카드에 준타스 유니폼을 적용합니다.",
    description:
      "카드에는 선수 사진, 포지션, 골, 도움, 경기 수, MOM 기록을 표시합니다. 참가자는 완성된 이미지를 저장하고 개인 SNS에 공유할 수 있습니다.",
    images: [
      { src: asset("card-male-v3.png"), alt: "준타스 남성 선수카드 예시" },
      {
        src: asset("card-female-v3.png"),
        alt: "준타스 여성 선수카드 예시",
      },
    ],
    officialCards: JUNTAS_PROPOSAL_PLAYER_CARDS,
    steps: [
      { title: "경기 기록 표시", description: "골, 도움, 경기 수, MOM을 카드에 표시합니다." },
      { title: "준타스 유니폼 표시", description: "선수 사진에서 준타스 팀웨어가 보이도록 제작합니다." },
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
  sponsorResponse: {
    eyebrow: "준타스 회신 반영 · 추가 협찬 요청",
    title: "1·2번은 그대로 반영하고, 팀조끼와 공인구는 대회 프로그램에 맞게 활용합니다.",
    description:
      "현금 후원 없이 유니폼·삭스·조끼·공인구와 콘텐츠 제작을 중심으로 협찬을 구성합니다.",
    accepted: [
      {
        title: "1. 준타스 커스텀 유니폼 제작권",
        description: "수상팀에게 준타스 커스텀 유니폼 제작권을 제공합니다.",
        items: ["1등 · 커스텀 유니폼 제작권", "2등 · 커스텀 유니폼 제작권", "3등 · 커스텀 유니폼 제작권"],
      },
      {
        title: "2. 경기 M.O.M 논슬립 삭스",
        description: "각 경기 M.O.M에게 준타스 논슬립 하프삭스를 제공합니다.",
        items: [],
      },
    ],
    counterProposal: {
      title: "3. 팀조끼는 그라운드 챌린지 청백전에 사용합니다.",
      description:
        "본경기 대신 그라운드 챌린지 청백전에 팀조끼를 사용해 노출과 촬영 콘텐츠를 확보합니다.",
      image: {
        src: asset("ground-challenge-shooting-king-v3.png"),
        alt: "형광 연두색과 형광 핑크색 준타스 팀조끼를 입고 슈팅왕 대결을 하는 그라운드 챌린지",
      },
      plan: [
        { label: "운영", detail: "전체 참가팀을 A팀·B팀으로 나눠 청백전을 진행합니다." },
        { label: "촬영", detail: "전담 촬영작가가 경기·제품·증정 장면을 촬영합니다." },
        { label: "동의", detail: "초상권 동의 참가자 중심으로 촬영합니다." },
      ],
      deliverables: [
        "팀조끼 착용 단체 사진",
        "그라운드 챌린지 경기 사진·영상",
        "준타스 홍보용으로 편집한 사진본·영상본 공유",
      ],
      additionalRequest: {
        title: "준타스 코모루즈 프로 풋살공 4호 매치볼 4개",
        description: "4개를 대회 공식 경기구로 지정해 전 경기에 사용하고, 경기 현장과 제품이 함께 보이는 홍보 콘텐츠를 제작합니다.",
        image: {
          src: asset("official-match-ball.webp"),
          alt: "준타스 코모루즈 프로 풋살공 4호 매치볼 공식 상품 이미지",
        },
        items: [
          "요청 수량  |  4개",
          "공식 활용  |  전 경기 공인구로 사용",
          "브랜드 노출  |  경기 장면과 공인구 안내물에 제품 노출",
          "제공 결과  |  제품샷·경기 사진·영상 파일",
        ],
        link: {
          label: "준타스 공식 상품 페이지",
          href: "https://brand.naver.com/juntas/products/4712957235",
        },
      },
    },
  },
  exposures: [
    {
      label: "PLAYER CARD",
      title: "선수카드",
      description: "준타스 유니폼 착용 사진과 개인 경기 기록을 함께 표시합니다.",
      image: { src: asset("editorial-player-v3.png"), alt: "JUNTAS 유니폼이 적용된 FairGround 공식 선수카드" },
      variant: "official-card",
      officialCard: JUNTAS_PROPOSAL_PLAYER_CARDS[0],
    },
    {
      label: "ON SITE",
      title: "현장 로고",
      description: "경기장 현수막·배너와 공동 후원 포토월에 FairGround 등 다른 파트너 로고와 함께 준타스 로고를 노출합니다.",
      image: { src: asset("onsite-branding-photowall-v3.png"), alt: "JUNTAS와 FairGround 로고가 교차 배치된 체크형 공동 후원 포토월" },
    },
    {
      label: "SOCIAL CAMPAIGN",
      title: "JUNTAS 홍보 영상·SNS 바이럴",
      description: "1분 JUNTAS 홍보 영상 1편을 제작하고 참가자 전원 대상 SNS 바이럴 이벤트를 진행합니다.",
      image: {
        src: asset("player-card-social-share-v1.webp"),
        alt: "JUNTAS 팀웨어를 입은 선수들이 경기 후 선수카드를 공유하며 기념 촬영하는 장면",
      },
      variant: "social-reel",
    },
  ],
  productionShowcase: {
    eyebrow: "CASE STUDY · 기존 협찬사 제작 사례",
    title: "현장 노출에서 끝내지 않고, 제품을 바로 사용할 수 있는 콘텐츠로 만듭니다.",
    description:
      "기존 협찬사 프로젝트에서 제품샷·착용샷·현장 릴스를 직접 촬영하고 편집한 결과물입니다. 준타스 협업 시에도 제품과 메시지에 맞춰 같은 제작 흐름으로 새롭게 제공합니다.",
    note: "아래 이미지와 영상은 기존 협찬사 프로젝트 사례이며, 준타스 협업 결과물은 준타스 제품으로 별도 제작합니다.",
    layout: "square-grid",
    videos: [
      {
        label: "ARIF · 현장 릴스",
        title: "제품이 사용되는 순간을 영상으로 기록",
        description: "행사 현장과 제품 사용 장면을 촬영해 SNS에서 바로 활용할 수 있는 영상으로 편집했습니다.",
        src: asset("production-cases/arif-mat-reel.mp4"),
        poster: {
          src: asset("production-cases/arif-mat-reel-poster.webp"),
          alt: "ARIF 매트가 사용된 야외 클래스 현장 릴스 미리보기",
        },
      },
      {
        label: "GLOWTEIN · 현장 릴스",
        title: "브랜드 계정에 바로 게시할 수 있는 릴스",
        description: "행사 분위기와 참가자 경험을 한 편의 영상으로 구성해 브랜드 노출을 자연스럽게 연결했습니다.",
        src: asset("production-cases/glowtein-reel.mp4"),
        poster: {
          src: asset("production-cases/glowtein-reel-poster.webp"),
          alt: "GLOWTEIN 협찬 행사 현장 릴스 미리보기",
        },
      },
    ],
    images: [
      {
        label: "GLOWTEIN · 제품샷",
        title: "패키지 디테일",
        image: { src: asset("production-cases/glowtein-product-pouches.webp"), alt: "GLOWTEIN 제품 패키지 디테일 촬영 사례" },
      },
      {
        label: "ALEAF · 착용샷",
        title: "사용 장면 중심 촬영",
        image: { src: asset("production-cases/aleaf-wearing.webp"), alt: "참가자가 ALEAF 밴드를 착용한 사용 장면 촬영 사례" },
        variant: "portrait",
      },
      {
        label: "ALEAF · 제품샷",
        title: "제품 컬러와 로고 강조",
        image: { src: asset("production-cases/aleaf-bands-flatlay.webp"), alt: "ALEAF 밴드 제품 컬러와 로고를 강조한 촬영 사례" },
      },
      {
        label: "ALEAF · 디테일컷",
        title: "브랜드 요소 클로즈업",
        image: { src: asset("production-cases/aleaf-detail.webp"), alt: "ALEAF 제품 로고를 가까이 촬영한 디테일 사례" },
        variant: "portrait",
      },
      {
        label: "ALEAF · 현장컷",
        title: "동작 안에서 자연스럽게 노출",
        image: { src: asset("production-cases/aleaf-action.webp"), alt: "운동 중 ALEAF 제품이 자연스럽게 노출된 촬영 사례" },
        variant: "portrait",
      },
      {
        label: "SPONSOR ACTIVATION · 현장 노출",
        title: "포토월과 현장 기록",
        image: { src: asset("production-cases/sponsor-wall.webp"), alt: "협찬사 로고가 노출된 행사 포토월 촬영 사례" },
        variant: "wide",
      },
    ],
    outputs: [
      {
        label: "PRODUCT SHOT",
        title: "제품샷",
        description: "제품 형태·패키지·로고가 선명하게 보이는 단독 컷을 제공합니다.",
      },
      {
        label: "WEARING SHOT",
        title: "착용샷",
        description: "참가자가 실제로 사용하거나 착용한 장면을 촬영합니다.",
      },
      {
        label: "SOCIAL REEL",
        title: "릴스·1분 영상",
        description: "제품과 현장 분위기를 영상으로 편집해 SNS 게시용으로 제공합니다.",
      },
    ],
  },
  exposureSummary: {
    official: "선수카드·경기장 배너·공동 후원 포토월·SNS 바이럴 이벤트·전담 작가 사진·1분 JUNTAS 홍보 영상 포함",
    main: "메인 외부 현수막·FairGround SNS 홍보 5회 추가",
  },
  deliverables: [
    {
      title: "준타스 유니폼 선수카드",
      description: "준타스 착용 사진과 개인 경기 기록을 합성한 이미지를 제작합니다.",
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
      title: "1분 JUNTAS 홍보 영상",
      description: "제품 홍보물을 촬영·편집해 OFFICIAL과 MAIN 파트너 모두에게 JUNTAS 홍보 영상 1편으로 제공합니다.",
    },
    {
      title: "제품 노출 계획",
      description: "제품 샘플을 활용해 촬영 위치와 노출 방식을 설계합니다.",
    },
  ],
  packages: [
    {
      name: "OFFICIAL PARTNER",
      price: "기본 제공 항목",
      summary: "선수카드, 경기장 내 현수막·배너와 공동 후원 포토월, SNS 바이럴 이벤트, 전담 작가 촬영 사진, 1분 JUNTAS 홍보 영상 1편을 제공합니다.",
      items: [
        "준타스 유니폼 선수카드",
        "경기장 내 현수막·배너 로고",
        "공동 후원 포토월 준타스 로고",
        "참가자 전원 SNS 바이럴 이벤트",
        "제품샷·착용샷·상품 증정 사진",
        "1분 JUNTAS 홍보 영상 1편",
        "코모루즈 프로 풋살공 4호 매치볼 4개",
      ],
    },
    {
      name: "MAIN PARTNER",
      price: "추가 제공 2종",
      summary: "OFFICIAL 전 항목에 메인 외부 현수막 1면과 FairGround SNS 제품 홍보 5회를 추가로 제공합니다.",
      items: [
        "OFFICIAL 전 항목 포함",
        "메인 외부 현수막 1면 · 5000×1800",
        "FairGround SNS 제품 홍보 5회",
      ],
      recommended: true,
    },
  ],
  comparison: [
    { label: "선수카드 · 전담 작가 사진", official: "포함", main: "포함" },
    { label: "경기장 내 현수막·배너 · 공동 후원 포토월", official: "포함", main: "포함" },
    { label: "참가자 전원 SNS 바이럴 이벤트", official: "포함", main: "포함" },
    { label: "1분 JUNTAS 홍보 영상", official: "1편", main: "1편" },
    { label: "코모루즈 프로 풋살공 4호 매치볼", official: "4개 요청", main: "4개 요청" },
    { label: "메인 외부 현수막", official: "—", main: "포함" },
    { label: "FairGround SNS 제품 홍보", official: "—", main: "5회" },
  ],
  packageNote: "현금 후원 없이 제공 품목과 제작물을 확정한 뒤, 대회 일정에 맞춰 바로 실행합니다.",
  phases: [],
  contact: {
    representative: "FairGround 대표 김재민",
    phone: "010-7768-3731",
    phoneHref: "tel:+821077683731",
    email: "info@fairground-kor.com",
    emailHref: "mailto:info@fairground-kor.com",
    website: "fairground-kor.com",
    websiteHref: "https://fairground-kor.com",
    proof: "실제 제작 사례 · GLOWTEIN · ALEAF · ARIF",
  },
};
