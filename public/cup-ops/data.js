import { resolveSeedNames } from './team-seeds.js?v=20260929-confirmed-seeds-v1';
// 운영 내용은 이 파일에서 수정합니다. 8팀·단일 경기 구장 기준입니다.
export const timeline = [
  { label: '사전 준비와 오프닝', period: '07:40–10:00', rows: [
    ['07:40–08:00','운영진 사전 세팅','풋살장 밖에서 접수·장비·배너를 준비합니다.'],
    ['08:00–08:30','심판 브리핑','재민 진행 · 성표가 경기 규정·진행 순서를 공유합니다.'],
    ['08:30–09:00','참가팀 접수','춘매·해인 접수 · 팀원 명단을 확인합니다.'],
    ['09:00–09:20','팀 소개','8팀 × 2분 + 운영 안내 4분 · 시맥 MC / 재민 진행 총괄'],
    ['09:20–09:50','단체 몸풀기','외부 강사 진행 · 시맥 MC / 성표 안전 관리'],
    ['09:50–10:00','첫 경기 준비','A구장 단일 코트 정리 · 기록판과 경기 순서를 확인합니다.']
  ]},
  { label: 'A구장 단일 코트 경기', period: '10:00–16:40', rows: [
    ['10:00–14:00','조별리그 12경기','20분 슬롯으로 한 경기씩 진행합니다. 실내구장에서는 그라운드 챌린지를 병행합니다.','match'],
    ['14:00–16:40','순위결정전 8경기','교차 준결승부터 결승까지 20분 슬롯으로 이어집니다.','match']
  ]},
  { label: '실내구장 그라운드 챌린지', period: '10:00–16:00', rows: [
    ['10:00–16:00','챌린지 3종 순환 운영','시맥 MC 진행 · 재민 측정 · 성표 보조 · 홍석 서버 기록 등록. 다음 경기팀은 호출하지 않습니다.','event']
  ]},
  { label: '시상과 마무리', period: '16:40–18:00', rows: [
    ['16:40–17:05','시상식·승급 발표','팀 순위와 개인상 시상 · 재민 진행 / 춘매·해인 보조','award'],
    ['17:05–17:10','클로징·단체사진','재민 마무리 인사 · 민준 단체사진'],
    ['17:10–18:00','뒷정리','A구장·실내구장 정리, 장비 회수와 촬영본 백업']
  ]}
];
export const courtMatches = [
 {slot:1,time:'10:00–10:20',stage:'조별리그',match:'A1 vs A2',rest:'A3, A4, B1, B2, B3, B4'},
 {slot:2,time:'10:20–10:40',stage:'조별리그',match:'B1 vs B2',rest:'A1, A2, A3, A4, B3, B4'},
 {slot:3,time:'10:40–11:00',stage:'조별리그',match:'A3 vs A4',rest:'A1, A2, B1, B2, B3, B4'},
 {slot:4,time:'11:00–11:20',stage:'조별리그',match:'B3 vs B4',rest:'A1, A2, A3, A4, B1, B2'},
 {slot:5,time:'11:20–11:40',stage:'조별리그',match:'A1 vs A3',rest:'A2, A4, B1, B2, B3, B4'},
 {slot:6,time:'11:40–12:00',stage:'조별리그',match:'B1 vs B3',rest:'A1, A2, A3, A4, B2, B4'},
 {slot:7,time:'12:00–12:20',stage:'조별리그',match:'A2 vs A4',rest:'A1, A3, B1, B2, B3, B4'},
 {slot:8,time:'12:20–12:40',stage:'조별리그',match:'B2 vs B4',rest:'A1, A2, A3, A4, B1, B3'},
 {slot:9,time:'12:40–13:00',stage:'조별리그',match:'A1 vs A4',rest:'A2, A3, B1, B2, B3, B4'},
 {slot:10,time:'13:00–13:20',stage:'조별리그',match:'B1 vs B4',rest:'A1, A2, A3, A4, B2, B3'},
 {slot:11,time:'13:20–13:40',stage:'조별리그',match:'A2 vs A3',rest:'A1, A4, B1, B2, B3, B4'},
 {slot:12,time:'13:40–14:00',stage:'조별리그',match:'B2 vs B3',rest:'A1, A2, A3, A4, B1, B4'},
 {slot:13,time:'14:00–14:20',stage:'챌린지 준결승',match:'A조 3위 vs B조 4위',rest:'A조 1·2·4위, B조 1·2·3위'},
 {slot:14,time:'14:20–14:40',stage:'챌린지 준결승',match:'A조 4위 vs B조 3위',rest:'A조 1·2·3위, B조 1·2·4위'},
 {slot:15,time:'14:40–15:00',stage:'챔피언십 준결승',match:'A조 1위 vs B조 2위',rest:'A조 2·3·4위, B조 1·3·4위'},
 {slot:16,time:'15:00–15:20',stage:'챔피언십 준결승',match:'A조 2위 vs B조 1위',rest:'A조 1·3·4위, B조 2·3·4위'},
 {slot:17,time:'15:20–15:40',stage:'7·8위전',match:'챌린지 준결승 패자 2팀',rest:'나머지 6팀'},
 {slot:18,time:'15:40–16:00',stage:'5·6위전',match:'챌린지 준결승 승자 2팀',rest:'나머지 6팀'},
 {slot:19,time:'16:00–16:20',stage:'3·4위전',match:'챔피언십 준결승 패자 2팀',rest:'나머지 6팀'},
 {slot:20,time:'16:20–16:40',stage:'결승',match:'챔피언십 준결승 승자 2팀',rest:'나머지 6팀'}
].map((row) => ({
  ...row,
  seedMatch: row.match,
  match: resolveSeedNames(row.match),
  rest: resolveSeedNames(row.rest),
}));

export const roles = [
 {name:'김재민',role:'대표 · 현장 총괄',place:'A구장·실내구장',time:'08:00 심판 브리핑 · 10:00–16:00 챌린지 측정',tasks:['현장 세팅 지휘, 돌발상황 대응 및 현장 순회','실내구장 챌린지 3종 기록 측정 · 성표 보조와 결과 확인','팀 소개·심판 브리핑 진행 총괄, 시상식·등급 승급 발표·클로징','협찬사·VIP 응대 및 MAIN 파트너 관계 관리']},
 {name:'양홍석',role:'총괄이사 · 장비·프로그램',place:'운영 데스크',time:'07:40 장비 세팅 → 챌린지 서버 기록 등록',tasks:['단일 코트 스코어보드·타이머·음향 세팅 및 실시간 유지·보수','실내구장 챌린지 3종 결과를 서버에 입력·등록','드론 촬영, SNS 게시용 소재 취합 · 장비 운영과 겹치면 촬영 순서 조정']},
 {name:'홍성표',role:'운영이사 · 경기 운영',place:'A구장·실내구장',time:'08:00 심판 브리핑 → 10:00–16:00 챌린지 보조',tasks:['단일 코트 심판 브리핑·배치, 20분 경기 슬롯과 교체 운영 지원','안전 관리, 조별 순위 집계 및 14:00 교차 대진 확인','실내 챌린지 참가 순서 관리 · 재민 측정 보조']},
 {name:'최민준',role:'사진작가 · 촬영 총괄',place:'A구장·실내구장·부스',time:'경기·챌린지 장면 촬영 / 17:05 단체사진',tasks:['메인 촬영, 협찬사 제품샷·참가자 인증샷 및 하이라이트','8팀 단체샷, 골 세리머니 표정과 벤치 리액션 확보','촬영본 정리·백업, 영상 담당과 MAIN 콘텐츠 분담']},
 {name:'영상작가',role:'영상 촬영 · 담당자 확정 필요',place:'코트·부스',time:'팀별 3~5분 로테이션 / 경기 직후 인터뷰',tasks:['입장 → 워밍업 → 허들 → 리액션 → 세리머니 B-roll','MAIN 파트너용 세로 1분 브랜드 영상 소재 확보','경기 직후 데뷔골·멀티골·MOM 즉석 소감 촬영']},
 {name:'신해인',role:'협찬사 부스 관리',place:'부스존·접수',time:'08:30 접수 / 경기·이벤트 중 부스 운영',tasks:['접수 데스크 세팅·운영 및 참가자 응대','협찬사 부스 운영, 배너·포토존·현수막 노출 이행 확인','시상식 트로피 전달 보조 및 부스·배너 철수']},
 {name:'김지민',role:'촬영 및 운영 보조',place:'전체 유동',time:'브리핑·리허설부터 시상식까지',tasks:['서브 카메라, 경기·이벤트·시상 클로즈업 보조','브리핑·리허설·접수 현장 스케치','웃음소리가 들리면 세로 10~15초 현장 영상 확보']},
 {name:'김춘매',role:'행사 전체 보조',place:'입구·대기열·부스',time:'세팅 → 접수 → 시상 → 참가자 배웅',tasks:['홍보 부스 배너·굿즈·테이블 세팅 및 운영','접수 데스크 운영, 참가자 응대와 이벤트 응원 유도','트로피 전달 보조 및 참가자 배웅']},
 {name:'시맥',role:'MC',place:'A구장·실내구장',time:'09:00 팀 소개 · 10:00–16:00 실내구장 챌린지',tasks:['팀 소개와 단체 몸풀기 진행','실내구장에서 원팀챌린지·등바구니 공받기·슈팅왕 속도대결 순환 진행','다음 경기팀은 호출하지 않고, 운영진 큐에 맞춰 대기팀 순서 안내']}
];
export const contentPromises = [
 ['제품샷·참가자 인증샷','민준·해인','부스 세팅 직후, 경기 사이 부스 체험','협찬사별 잔디 배경 제품샷 5컷 이상'],
 ['참가자의 생생한 참여','민준·지민','접수부터 17:10 클로징까지','접수·팀 소개·몸풀기·경기·챌린지·시상 주요 장면 확보'],
 ['협찬 릴스 제품 사용 장면','춘매·해인·민준','제품별 릴스 가이드의 촬영 타이밍 참고','각 협찬사별 필수 컷 4~5개 이상 확보'],
 ['8팀의 표정과 이야기','민준·지민','09:00 팀 소개, 경기 대기시간','8팀 모두 단체샷 + 웃는 컷'],
 ['MAIN 세로 1분 영상','민준·영상 담당','전 구간, 16:40 시상식','9:16 편집용 하이라이트·부스·챌린지·시상 소재'],
 ['배너·포토존·현수막','재민·민준','10/2 18:00 설치 직후, 당일 07:40','협찬사별 노출면 전체 설치 완료샷'],
 ['공식 SNS 인증·UGC','춘매·해인 유도 / 홍석 취합','부스 운영, 이벤트·시상 직후','인증 해시태그·게시 채널 사전 확정'],
  ['MAIN SNS 콘텐츠 5건','홍석 취합·민준','대회 직후 선별, 게시 일정 협의','게시용 사진·릴스 5건 분량 소재 확정']
];
// Sponsor Reels are separate from Simaek's two-shot instant-event coverage.
export const sponsorReelGuides = [
  {
    sponsor: '아미노코치', product: '블루레몬·자몽 제품', image: '/cup-ops/simaek/assets/products/amino-coach.webp', imageAlt: '아미노코치 제품과 풋살공',
    concept: '현장 시음 행사 — 차갑게 준비한 생수에 한 포씩 타서 함께 맛보고 응원하는 순간', timing: '홍보부스 운영 시간·경기 사이',
    shots: ['아이스박스에 얼음과 생수를 채워 차갑게 준비하는 모습', '부스에서 아미노코치 제품과 시음용 생수를 함께 보여주는 컷', '차가운 생수에 아미노코치 한 포를 직접 넣는 장면', '병을 흔들어 직접 타는 장면', '시음한 뒤 맛있게 마시며 웃는 참가자 반응', '제품을 들고 함께 “아미노코치 화이팅!”을 외치는 장면'],
    boothEvent: { title: '홍보부스 시음 운영', steps: ['아이스박스에 얼음과 생수를 넣어 차갑게 준비합니다.', '시음용 생수에 아미노코치 한 포씩 넣습니다.', '충분히 흔든 뒤 참가자에게 나눠 시음합니다.'] },
    eventAllocation: '5박스', status: '릴스 컷 가이드'
  },
  {
    sponsor: '테이블코치', product: '테이블코치 제품', image: '/cup-ops/simaek/assets/products/tablecoach.webp', imageAlt: '테이블코치 제품과 음식',
    concept: '한 끼를 함께 — 제품을 음식에 곁들이고 함께 식사하는 자연스러운 장면', timing: '교대 식사 시간·대회 종료 후',
    shots: ['패키지와 제품명이 보이는 컷', '포장을 열거나 제품을 준비하는 손', '식사에 제품을 곁들이는 과정', '선수가 한입 먹고 동료와 나누는 장면', '음식과 제품을 함께 보여주는 테이블 와이드 컷'],
    eventAllocation: '5박스', status: '릴스 컷 가이드'
  },
  {
    sponsor: '던윅', product: '종아리슬리브', image: '/cup-ops/simaek/assets/products/dunwick-calf-sleeve.webp', imageAlt: '던윅 종아리슬리브 제품',
    concept: '경기 전 장비 착용 — 착용 준비부터 워밍업까지 선수의 루틴을 따라가기', timing: '경기 전 워밍업·경기 후 휴식',
    shots: ['제품과 로고 디테일', '선수가 직접 슬리브를 착용하는 장면', '사이즈와 착용 상태를 확인하는 컷', '착용한 채 가볍게 워밍업하는 모습', '경기 후 개인적인 착용 소감을 말하는 짧은 컷'],
    eventAllocation: '5개', status: '릴스 컷 가이드', note: '사이즈별 재고를 촬영·배분 전에 확인'
  },
  {
    sponsor: '캐터피', product: '매직레이스', image: '/cup-ops/simaek/assets/products/catapty-magic-lace.webp', imageAlt: '캐터피 매직레이스 제품',
    concept: '킥오프 전 신발 준비 — 끈의 디테일과 선수가 신발을 신고 움직이는 순간', timing: '경기 전 신발 착용·워밍업',
    shots: ['신발과 매직레이스의 제품 디테일', '끈의 모양과 소재를 손으로 보여주는 컷', '신발을 신고 끈 상태를 확인하는 장면', '가볍게 방향을 바꾸거나 공을 다루는 모습', '사용자의 주관적인 착용 소감 한마디'],
    eventAllocation: '2개', status: '릴스 컷 가이드'
  },
  {
    sponsor: '니즈', product: '아이싱패치', image: '/cup-ops/simaek/assets/products/niz-icing-patch.webp', imageAlt: '니즈 아이싱패치 제품',
    concept: '경기 후 리셋 — 제품을 준비하고 사용 안내에 따라 휴식하는 순간', timing: '경기 직후·벤치 휴식',
    shots: ['패키지와 제품명을 보여주는 컷', '포장을 열어 제품을 준비하는 손', '제품 안내에 맞춰 사용하는 장면', '휴식하며 편안하게 웃는 선수의 표정', '제품을 든 선수의 짧은 개인 사용감 인터뷰'],
    eventAllocation: '10개 (5명 × 2개)', status: '릴스 컷 가이드', note: '효능 단정 없이 개인 사용감만 담기'
  },
  {
    sponsor: '썸머홀릭', product: '울트라 스포츠 선크림 50ml', image: '/cup-ops/assets/sponsors/summerholic-ultra-sport-sun-cream-v1.webp', imageAlt: '썸머홀릭 울트라 스포츠 선크림 50ml 제품',
    concept: '킥오프 전 준비 루틴 — 제품을 확인하고 사용 안내에 맞춰 바른 뒤 코트로 향하는 장면', timing: '도착 직후·경기 전 준비',
    shots: ['풋살 장비 옆에 제품을 놓고 용기 전체를 보여주는 컷', '제품명과 패키지가 읽히는 정면 클로즈업', '손등에 덜어 제형을 보여주는 장면', '제품 사용 안내에 맞춰 바르는 모습', '준비를 마친 참가자의 짧은 개인 소감과 코트 이동 장면'],
    eventAllocation: '', status: '제품 이미지 반영', note: '사용 장면은 제품 안내에 따르고, 효능을 단정하는 표현은 사용하지 않습니다.'
  },
  {
    sponsor: '준타스', product: '수상팀 유니폼 · 경기별 M.O.M 논슬립 하프삭스', image: '/cup-ops/assets/sponsors/juntas-team-equipment-v1.png', imageAlt: '준타스 유니폼과 논슬립 하프삭스 제품 구성',
    concept: '팀의 경기와 오늘의 M.O.M — 팀웨어를 입고 뛰고, 수상 순간을 함께 기록', timing: '팀 소개·워밍업·경기·M.O.M 발표',
    shots: ['유니폼의 준타스 로고와 소재 디테일', '유니폼을 입은 팀 단체 준비 컷', '경기 중 팀웨어가 보이는 플레이', 'M.O.M 논슬립 하프삭스 제품 디테일과 전달 장면', '수상 선수와 팀의 축하 반응'],
    eventAllocation: '', status: '확정 항목 기준', note: '팀조끼 활용과 매치볼 4개는 확정 여부 확인 후 촬영 반영'
  },
];
export const countdown = [
 ['NOW','운영안 공유','8팀·A조 4팀/B조 4팀, 단일 코트 시간표와 승급 기준 공유'],
 ['D−7','경기 조건 확정','조 추첨·대진·동률 및 동점 처리·단일 코트 심판 배정 확정'],
 ['D−3','촬영·장비 점검','촬영 동선, 배터리·저장공간·백업 드라이브 점검'],
 ['D−1','10/2(금) 18:00 설치','현수막·차양막 설치 · 재민 총괄 / 홍석 설치 / 민준 노출샷'],
 ['D-DAY','07:40 세팅 시작','08:00 대관 시작 · 10:00 단일 코트 경기 시작 · 18:00 정리 완료'],
 ['D+1','촬영본 정리·납품','팀·협찬사·시간대별 정리, 팀 릴스·MAIN SNS 5건 준비']
];

// 기존 FairGround 선수카드 프레임과 선수 이미지로 승급 티어를 보여줍니다.
export const promotionTiers = [
 {id:'platinum',label:'플래티넘 팀',english:'PLATINUM',rank:'1위',count:1,image:'/cup-ops/assets/tiers/platinum-player-frame.webp',portrait:'/cup-ops/assets/tiers/player-male.png'},
 {id:'gold',label:'골드팀',english:'GOLD',rank:'2~5위',count:4,image:'/cup-ops/assets/tiers/gold-player-frame.webp',portrait:'/cup-ops/assets/tiers/player-female.png'},
 {id:'silver',label:'실버팀',english:'SILVER',rank:'6~8위',count:3,image:'/cup-ops/assets/tiers/silver-player-frame.webp',portrait:'/cup-ops/assets/tiers/player-male.png'}
];

// 2026 · 1st 대회 팀 순위와 개인상별 확정 상품
export const cupAwards = [
 {id:'team-awards',title:'팀 순위 시상',awards:[
  {title:'1위',items:['스튜디오 레르 팀 프로필 촬영권','준타스 커스텀 유니폼 제작권 30만원']},
  {title:'2위',items:['준타스 커스텀 유니폼 제작권 20만원']},
  {title:'3위',items:['준타스 커스텀 유니폼 제작권 30만원']}
 ]},
 {id:'individual-awards',title:'개인상',awards:[
  {title:"MEN'S MOM",items:['트로피','니즈 10EA 1박스','썸머홀릭 선크림 1개','던윅 종아리 슬리브 1개']},
  {title:"WOMEN'S MOM",items:['트로피','니즈 10EA 1박스','썸머홀릭 선크림 1개','던윅 종아리 슬리브 1개']},
  {title:'GOLDEN GLOVE',items:['트로피','니즈 10EA 1박스','썸머홀릭 선크림 1개','던윅 종아리 슬리브 1개']},
  {title:'GOLDEN BOOT',items:['트로피','니즈 10EA 1박스','썸머홀릭 선크림 1개','던윅 종아리 슬리브 1개']}
 ]}
];
