/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: "https://fairground.kr",
  generateRobotsTxt: true,
  robotsTxtOptions: {
    policies: [{ userAgent: "*", allow: "/" }],
  },
  changefreq: "weekly",
  priority: 0.7,
  exclude: ["/login", "/register", "/my/*", "/admin/*"],
};
