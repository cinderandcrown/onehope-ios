/**
 * Social links printed on weareonehope.com (home, plan-your-visit, resources)
 * on Nov 19, 2026. No other networks appeared in the header, footer, or those
 * pages. Contact is not a page on the site (404). Staff can replace this list.
 */

export type SocialLink = { id: string; name: string; url: string };

export const SITE_SOCIAL: readonly SocialLink[] = [
  {
    id: "instagram",
    name: "Instagram",
    url: "https://www.instagram.com/iamonehope/?igshid=YmMyMTA2M2Y%3D",
  },
  { id: "facebook", name: "Facebook", url: "https://www.facebook.com/iamonehope/" },
  { id: "youtube", name: "YouTube", url: "https://www.youtube.com/@Weareonehope" },
];

const HTTPS = /^https:\/\/[^\s]+$/;

export function cleanSocialLinks(links: readonly SocialLink[]): SocialLink[] {
  if (links.length > 8) {
    throw new Error("Too many links.");
  }
  const seen = new Set<string>();
  return links.map((link) => {
    const id = link.id.trim().toLowerCase();
    const name = link.name.trim();
    const url = link.url.trim();
    if (!/^[a-z0-9-]{1,40}$/.test(id)) throw new Error("Bad link id.");
    if (!name || name.length > 40) throw new Error("Bad link name.");
    if (!HTTPS.test(url) || url.length > 300) throw new Error("Links must be https.");
    if (seen.has(id)) throw new Error("Duplicate link.");
    seen.add(id);
    return { id, name, url };
  });
}
