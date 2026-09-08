"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ProposalImage, ProposalLogoTreatment } from "@/features/sponsor-proposal/types";
import styles from "@/features/sponsor-proposal/sponsor-proposal.module.css";

const NAV_ITEMS = [
  { href: "#value", label: "혜택" },
  { href: "#event", label: "대회" },
  { href: "#system", label: "선수카드" },
  { href: "#promotion", label: "팀승급" },
  { href: "#exposure", label: "노출" },
  { href: "#deliverables", label: "제작물" },
  { href: "#package", label: "패키지" },
  { href: "#timeline", label: "일정" },
  { href: "#contact", label: "문의" },
] as const;

type ProposalNavigationProps = {
  fairgroundLogo: ProposalImage;
  sponsorLogo: ProposalImage;
  sponsorLogoTreatment?: ProposalLogoTreatment;
  responseLabel?: string;
  productionLabel?: string;
  showTimeline?: boolean;
};

export function ProposalNavigation({
  fairgroundLogo,
  sponsorLogo,
  sponsorLogoTreatment = "plain",
  responseLabel,
  productionLabel,
  showTimeline = true,
}: ProposalNavigationProps) {
  const [activeSection, setActiveSection] = useState(responseLabel ? "response" : "value");
  const [progress, setProgress] = useState(0);
  const navItems = [
    ...(responseLabel ? [{ href: "#response", label: responseLabel }] : []),
    ...NAV_ITEMS.slice(0, 4),
    ...(productionLabel ? [{ href: "#proof", label: productionLabel }] : []),
    ...NAV_ITEMS.slice(4),
  ].filter((item) => showTimeline || item.href !== "#timeline");

  useEffect(() => {
    const updateProgress = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(maxScroll > 0 ? (window.scrollY / maxScroll) * 100 : 0);
    };

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-25% 0px -65% 0px" },
    );

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.setAttribute("data-visible", "true");
          revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
    );

    document.querySelectorAll<HTMLElement>("[data-proposal-page] section[id]").forEach((section) => {
      sectionObserver.observe(section);
    });
    document.querySelectorAll<HTMLElement>("[data-proposal-page] [data-reveal]").forEach((element) => {
      revealObserver.observe(element);
    });

    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateProgress);
      sectionObserver.disconnect();
      revealObserver.disconnect();
    };
  }, []);

  return (
    <>
      <div className={styles.progress} style={{ width: `${progress}%` }} aria-hidden="true" />
      <nav className={styles.proposalNav} aria-label="후원 제안서 목차">
        <div className={styles.navInner}>
          <span className={styles.navBrand}>
            <Link href="/" aria-label="FairGround 홈으로 이동">
              <Image src={fairgroundLogo.src} alt={fairgroundLogo.alt} width={1000} height={187} priority />
            </Link>
            <span aria-hidden="true">×</span>
            <span className={styles.navSponsorLogo} data-logo-treatment={sponsorLogoTreatment}>
              <Image src={sponsorLogo.src} alt={sponsorLogo.alt} width={189} height={80} priority />
            </span>
          </span>
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={activeSection === item.href.slice(1) ? styles.navLinkActive : styles.navLink}
            >
              {item.label}
            </a>
          ))}
        </div>
      </nav>
    </>
  );
}
