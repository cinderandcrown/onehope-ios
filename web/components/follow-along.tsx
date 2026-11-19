export type SocialLink = { id: string; name: string; url: string };

const MARK: Record<string, string> = {
  instagram: "IG",
  facebook: "f",
  youtube: "▶",
};

/** Opens the https link. iOS and Android hand that to the native app when it is installed. */
export function FollowAlong({ links, heading = "Follow along" }: { links: SocialLink[]; heading?: string }) {
  if (links.length === 0) return null;
  return (
    <section>
      <h2>{heading}</h2>
      <div className="follow-row">
        {links.map((link) => (
          <a key={link.id} href={link.url} target="_blank" rel="noreferrer">
            <span aria-hidden="true">{MARK[link.id] ?? "↗"}</span>
            {link.name}
          </a>
        ))}
      </div>
    </section>
  );
}
