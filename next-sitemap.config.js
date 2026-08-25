/** @type {import('next-sitemap').IConfig} */
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://fairground-kor.com")
  .replace("https://fairground-footsal.vercel.app", "https://fairground-kor.com")
  .replace("https://fairground-futsal.vercel.app", "https://fairground-kor.com")
  .replace(/\/$/, "");

module.exports = {
  siteUrl,
  generateRobotsTxt: true,
  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/*", "/auth/*", "/login", "/register", "/my", "/my/*"],
      },
    ],
  },
  changefreq: "weekly",
  priority: 0.7,
  exclude: [
    "/admin",
    "/admin/*",
    "/auth/*",
    "/login",
    "/register",
    "/my",
    "/my/*",
    "/offline",
    "/onboarding",
  ],
  transform: async (config, path) => {
    const highIntentPaths = new Set([
      "/",
      "/tournaments",
    ]);
    const sportsDataPaths = new Set([
      "/live",
      "/leaderboard",
      "/standings",
      "/players",
      "/teams",
    ]);
    const contentPaths = new Set(["/notices", "/board", "/feed", "/rulebook", "/about"]);

    if (path === "/") {
      return {
        loc: path,
        changefreq: "daily",
        priority: 1.0,
        lastmod: new Date().toISOString(),
      };
    }

    if (highIntentPaths.has(path)) {
      return {
        loc: path,
        changefreq: "daily",
        priority: 0.95,
        lastmod: new Date().toISOString(),
      };
    }

    if (sportsDataPaths.has(path)) {
      return {
        loc: path,
        changefreq: "daily",
        priority: 0.86,
        lastmod: new Date().toISOString(),
      };
    }

    if (contentPaths.has(path)) {
      return {
        loc: path,
        changefreq: "weekly",
        priority: 0.78,
        lastmod: new Date().toISOString(),
      };
    }

    return {
      loc: path,
      changefreq: config.changefreq,
      priority: config.priority,
      lastmod: new Date().toISOString(),
    };
  },
};
