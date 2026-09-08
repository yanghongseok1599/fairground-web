import type { Player } from "@/types";

export type ProposalImage = {
  src: string;
  alt: string;
};

export type ProposalLogoTreatment = "plain" | "dark-surface";

export type ProposalBenefit = {
  title: string;
  description: string;
};

export type ProposalMetric = {
  value: string;
  label: string;
};

export type ProposalFact = {
  title: string;
  detail: string;
};

export type ProposalPlayerCardStep = {
  title: string;
  description: string;
};

export type ProposalPlayerCardImage = ProposalImage & {
  /** Corrects artwork bounds when source files have different internal margins. */
  scaleX?: number;
};

export type ProposalOfficialPlayerCard = {
  player: Player;
  teamLogo?: string;
  label?: string;
};

export type ProposalTeamProgression = {
  title: string;
  description: string;
  image: ProposalImage;
  tiers: Array<{
    label: string;
    title: string;
    detail: string;
  }>;
  sponsorValue: string;
};

export type ProposalSponsorResponse = {
  eyebrow: string;
  title: string;
  description: string;
  accepted: Array<{
    title: string;
    description: string;
    items: string[];
  }>;
  counterProposal: {
    title: string;
    description: string;
    image?: ProposalImage;
    plan: Array<{
      label: string;
      detail: string;
    }>;
    deliverables: string[];
    additionalRequest?: {
      title: string;
      description: string;
      image?: ProposalImage;
      items: string[];
      link?: {
        label: string;
        href: string;
      };
    };
  };
};

export type ProposalExposure = {
  label: string;
  title: string;
  description: string;
  image: ProposalImage;
  variant?: "image" | "official-card" | "social-reel";
  officialCard?: ProposalOfficialPlayerCard;
};

export type ProposalDeliverable = {
  title: string;
  description: string;
};

export type ProposalProductionShowcase = {
  eyebrow: string;
  title: string;
  description: string;
  note: string;
  layout?: "editorial" | "square-grid";
  images: Array<{
    label: string;
    title: string;
    image: ProposalImage;
    variant?: "wide" | "portrait";
  }>;
  videos: Array<{
    label: string;
    title: string;
    description: string;
    src: string;
    poster: ProposalImage;
  }>;
  outputs: Array<{
    label: string;
    title: string;
    description: string;
  }>;
};

export type ProposalPackage = {
  name: string;
  price: string;
  summary: string;
  items: string[];
  recommended?: boolean;
};

export type ProposalComparisonRow = {
  label: string;
  inKind?: string;
  official: string;
  main: string;
};

export type ProposalPhase = {
  label: string;
  title: string;
  description: string;
  output: string;
  tone: "soft" | "primary" | "deep";
};

export type SponsorProposal = {
  slug: string;
  sponsor: {
    name: string;
    logo: ProposalImage;
    logoTreatment?: ProposalLogoTreatment;
  };
  fairgroundLogo: ProposalImage;
  copy: {
    benefits: { title: string; description: string };
    exposure: { title: string; description: string };
    deliverablesTitle: string;
    packagesTitle: string;
    timelineTitle: string;
    contact: { title: string; ctaTitle: string; ctaDescription: string };
  };
  event: {
    date: string;
    time: string;
    venue: string;
    category: string;
    title: string;
    image: ProposalImage;
    metrics: ProposalMetric[];
    facts: ProposalFact[];
  };
  hero: {
    eyebrow: string;
    title: string;
    benefits: string;
    priceSummary: string;
    image: ProposalImage;
    caption: string;
  };
  benefits: ProposalBenefit[];
  benefitExamples: Array<{
    title: string;
    note: string;
    image: ProposalImage;
    video?: {
      src: string;
    };
    variant?: "standard" | "social-video";
    officialCard?: ProposalOfficialPlayerCard;
  }>;
  playerCard: {
    title: string;
    description: string;
    images: ProposalPlayerCardImage[];
    officialCards?: ProposalOfficialPlayerCard[];
    steps: ProposalPlayerCardStep[];
  };
  teamProgression: ProposalTeamProgression;
  sponsorResponse?: ProposalSponsorResponse;
  exposures: ProposalExposure[];
  productionShowcase?: ProposalProductionShowcase;
  exposureSummary: {
    official: string;
    main: string;
  };
  /** Optional multi-image visual for the deliverables section. */
  deliverablesImages?: ProposalImage[];
  /** Aspect treatment for the single deliverables visual. */
  deliverablesImageVariant?: "landscape" | "portrait";
  deliverables: ProposalDeliverable[];
  deliverablesImage?: ProposalImage;
  packages: ProposalPackage[];
  comparison: ProposalComparisonRow[];
  packageNote: string;
  phases: ProposalPhase[];
  contact: {
    representative: string;
    phone: string;
    phoneHref: string;
    email: string;
    emailHref: string;
    website: string;
    websiteHref: string;
    proof: string;
  };
};
