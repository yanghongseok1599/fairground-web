"use client";

type ClubLogoPreset = {
  code: string;
  from: string;
  to: string;
  paper: string;
  variant: number;
  asset?: string;
};

const CLUB_LOGO_PRESETS: Array<{ match: string; logo: ClubLogoPreset }> = [
  { match: "블루웨이브", logo: { code: "BW", from: "#2F80ED", to: "#0B1F47", paper: "#F7FBFF", variant: 5, asset: "/images/team-logos/ref-blue7.png?v=7" } },
  { match: "한강", logo: { code: "HU", from: "#35A7FF", to: "#063A66", paper: "#F2FBFF", variant: 0, asset: "/images/team-logos/ref-nova.png?v=7" } },
  { match: "성수", logo: { code: "SS", from: "#F7C948", to: "#201609", paper: "#FFF9E6", variant: 2, asset: "/images/team-logos/ref-volt.png?v=7" } },
  { match: "마포", logo: { code: "MR", from: "#FF5A5F", to: "#261016", paper: "#FFF3F0", variant: 1, asset: "/images/team-logos/ref-rift.png?v=7" } },
  { match: "강남", logo: { code: "GS", from: "#FF8A00", to: "#2A1605", paper: "#FFF0DA", variant: 4, asset: "/images/team-logos/ref-bulls.png?v=9" } },
  { match: "을지로", logo: { code: "EP", from: "#5B8DEF", to: "#071E49", paper: "#EDF5FF", variant: 6, asset: "/images/team-logos/ref-afc.png?v=7" } },
  { match: "노원", logo: { code: "NT", from: "#9B5CFF", to: "#101333", paper: "#F4EDFF", variant: 3, asset: "/images/team-logos/ref-orion.png?v=8" } },
  { match: "관악", logo: { code: "GD", from: "#18D5FF", to: "#072B3A", paper: "#EAFBFF", variant: 0, asset: "/images/team-logos/ref-nova.png?v=7" } },
  { match: "ITN", logo: { code: "ITN", from: "#D872E8", to: "#18122C", paper: "#FFF1FB", variant: 4, asset: "/images/team-logo-cards/itn-fc-logo.png" } },
];

const AUTO_TEAM_LOGO_ASSETS = [
  "/images/team-logos/ref-blue7.png?v=7",
  "/images/team-logos/ref-nova.png?v=7",
  "/images/team-logos/ref-volt.png?v=7",
  "/images/team-logos/ref-rift.png?v=7",
  "/images/team-logos/ref-bulls.png?v=9",
  "/images/team-logos/ref-afc.png?v=7",
  "/images/team-logos/ref-orion.png?v=8",
];

function hasCustomLogo(logoSrc?: string) {
  const value = logoSrc?.trim();
  if (!value || value.includes("/images/default-team.png")) return false;
  if (value.startsWith("data:image/")) return true;
  if (value.startsWith("http://") || value.startsWith("https://")) return true;
  return !value.startsWith("/images/team-logos/");
}

export function getClubLogoPreset(name: string, index: number): ClubLogoPreset {
  const found = CLUB_LOGO_PRESETS.find((preset) => name.includes(preset.match));
  if (found) return found.logo;

  const autoAsset = AUTO_TEAM_LOGO_ASSETS[index % AUTO_TEAM_LOGO_ASSETS.length];
  const fallback = [
    { code: "AX", from: "#2DD4BF", to: "#082F2C", paper: "#EFFFFB", variant: 6, asset: autoAsset },
    { code: "VX", from: "#F05D7B", to: "#260912", paper: "#FFF0F5", variant: 1, asset: autoAsset },
    { code: "FC", from: "#F7C948", to: "#201609", paper: "#FFF9E6", variant: 2, asset: autoAsset },
  ];

  return fallback[index % fallback.length];
}

export function ClubEmblem({
  name,
  logoSrc,
  index = 0,
  className = "h-full w-full",
}: {
  name: string;
  logoSrc?: string;
  index?: number;
  className?: string;
}) {
  const preset = getClubLogoPreset(name, index);
  const resolvedAsset = hasCustomLogo(logoSrc) ? logoSrc?.trim() : preset.asset;

  if (resolvedAsset) {
    return (
      <img
        src={resolvedAsset}
        alt={`${name} 엠블럼`}
        className={`${className} object-contain`}
        draggable={false}
      />
    );
  }

  const initials = preset.code;
  const gradId = `club-grad-${index}-${initials}`;
  const accentId = `club-accent-${index}-${initials}`;
  const shadowId = `club-shadow-${index}-${initials}`;

  return (
    <svg
      viewBox="0 0 160 160"
      className={className}
      role="img"
      aria-label={`${name} 엠블럼`}
    >
      <defs>
        <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={preset.from} />
          <stop offset="100%" stopColor={preset.to} />
        </linearGradient>
        <linearGradient id={accentId} x1="0" x2="1" y1="1" y2="0">
          <stop offset="0%" stopColor={preset.paper} />
          <stop offset="100%" stopColor={preset.from} />
        </linearGradient>
        <filter id={shadowId} x="-35%" y="-35%" width="170%" height="170%">
          <feDropShadow dx="0" dy="12" stdDeviation="8" floodColor={preset.from} floodOpacity="0.38" />
        </filter>
      </defs>

      {preset.variant === 0 && (
        <g filter={`url(#${shadowId})`}>
          <circle cx="80" cy="80" r="62" fill={`url(#${gradId})`} />
          <circle cx="80" cy="80" r="50" fill={preset.paper} stroke="rgba(13,27,42,0.72)" strokeWidth="5" />
          <path d="M80 34 L88 66 L122 66 L94 84 L105 118 L80 97 L55 118 L66 84 L38 66 L72 66 Z" fill={preset.from} />
          <path d="M40 80 H120" stroke={preset.to} strokeWidth="5" strokeLinecap="round" opacity="0.85" />
        </g>
      )}

      {preset.variant === 1 && (
        <g filter={`url(#${shadowId})`}>
          <path d="M80 12 L145 132 H15 Z" fill={`url(#${gradId})`} />
          <path d="M80 30 L125 120 H35 Z" fill={preset.paper} opacity="0.96" />
          <path d="M42 108 C70 56 96 40 125 30 C111 66 91 90 42 108 Z" fill={preset.to} />
          <path d="M54 96 C80 72 101 58 120 52" stroke={preset.from} strokeWidth="9" strokeLinecap="round" fill="none" />
        </g>
      )}

      {preset.variant === 2 && (
        <g filter={`url(#${shadowId})`}>
          <path d="M80 10 L139 45 V115 L80 150 L21 115 V45 Z" fill={`url(#${gradId})`} />
          <path d="M80 25 L124 52 V107 L80 134 L36 107 V52 Z" fill="rgba(255,255,255,0.92)" />
          <path d="M80 42 L101 80 H84 L96 116 L59 70 H78 Z" fill={preset.to} />
          <circle cx="54" cy="104" r="8" fill={preset.from} />
          <circle cx="111" cy="55" r="7" fill={preset.from} />
        </g>
      )}

      {preset.variant === 3 && (
        <g filter={`url(#${shadowId})`}>
          <rect x="29" y="29" width="102" height="102" rx="25" fill={`url(#${gradId})`} transform="rotate(45 80 80)" />
          <rect x="44" y="44" width="72" height="72" rx="18" fill={preset.paper} transform="rotate(45 80 80)" />
          <path d="M80 42 L88 60 L108 62 L92 75 L98 96 L80 84 L62 96 L68 75 L52 62 L72 60 Z" fill={preset.from} />
          <text x="80" y="104" textAnchor="middle" fontSize="38" fontWeight="900" fill={preset.to} fontFamily="Arial, sans-serif">
            {initials}
          </text>
        </g>
      )}

      {preset.variant === 4 && (
        <g filter={`url(#${shadowId})`}>
          <circle cx="80" cy="80" r="64" fill={`url(#${gradId})`} />
          <circle cx="80" cy="80" r="49" fill="rgba(13,27,42,0.9)" />
          <path d="M45 88 C53 48 107 48 115 88 C104 77 94 77 86 91 C80 103 58 107 45 88 Z" fill={preset.paper} />
          <path d="M48 65 L31 45 L61 54 M112 65 L129 45 L99 54" stroke={preset.from} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="63" cy="78" r="5" fill={preset.to} />
          <circle cx="97" cy="78" r="5" fill={preset.to} />
        </g>
      )}

      {preset.variant === 5 && (
        <g filter={`url(#${shadowId})`}>
          <path d="M39 16 H121 L132 126 L80 150 L28 126 Z" fill={`url(#${gradId})`} />
          <path d="M50 32 H110 L118 116 L80 134 L42 116 Z" fill={preset.paper} opacity="0.96" />
          <path d="M50 102 C70 72 75 47 83 30 C91 61 102 75 116 92 C93 86 73 94 50 102 Z" fill={preset.from} />
          <path d="M43 50 C66 60 96 60 119 50" stroke={preset.to} strokeWidth="7" strokeLinecap="round" fill="none" />
        </g>
      )}

      {preset.variant === 6 && (
        <g filter={`url(#${shadowId})`}>
          <path d="M80 13 L132 34 L144 91 L108 140 H52 L16 91 L28 34 Z" fill={`url(#${gradId})`} />
          <path d="M80 31 L116 46 L124 86 L98 121 H62 L36 86 L44 46 Z" fill="rgba(255,255,255,0.94)" />
          <path d="M39 96 C70 28 112 31 122 54 C94 49 80 68 75 98 C70 81 54 86 39 96 Z" fill={preset.from} />
          <path d="M77 100 C94 98 108 105 119 118" stroke={preset.to} strokeWidth="8" strokeLinecap="round" fill="none" />
        </g>
      )}

      {preset.variant !== 3 && (
        <text
          x="80"
          y="88"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={initials.length > 2 ? 30 : 38}
          fontWeight="900"
          fill={preset.variant === 4 ? preset.from : preset.to}
          fontFamily="Arial, sans-serif"
          opacity="0.94"
        >
          {initials}
        </text>
      )}
    </svg>
  );
}
