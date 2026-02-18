"use client";

export function SiteFooter() {
  return (
    <footer
      className="py-16 px-6 md:px-10"
      style={{ background: "#0D1B2A", borderTop: "1px solid rgba(0,200,83,0.1)" }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          {/* Logo & tagline */}
          <div>
            <img
              src="/images/logo-horizontal.png"
              alt="FairGround"
              style={{ height: 36, width: "auto" }}
            />
            <p
              className="mt-3 text-sm"
              style={{
                color: "#627D98",
                fontFamily: "var(--font-space-mono)",
                letterSpacing: "1px",
              }}
            >
              모두가 승리하는 그라운드
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            {[
              { href: "/live", label: "라이브" },
              { href: "/tournaments", label: "대회" },
              { href: "/standings", label: "순위" },
              { href: "/players", label: "FA선수" },
              { href: "/teams", label: "팀" },
              { href: "/notices", label: "공지사항" },
              { href: "/board", label: "자유게시판" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm transition-colors"
                style={{ color: "#627D98" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#00C853"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#627D98"; }}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>

        <div
          className="mt-12 pt-8 flex items-center justify-between text-xs"
          style={{ borderTop: "1px solid rgba(217,226,236,0.1)", color: "#627D98" }}
        >
          <span>© 2025 FairGround. All rights reserved.</span>
          <span
            style={{ fontFamily: "var(--font-space-mono)", letterSpacing: "1px" }}
          >
            FUTSAL LEAGUE PLATFORM
          </span>
        </div>
      </div>
    </footer>
  );
}
