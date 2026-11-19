export type SocialLink = { id: string; name: string; url: string };

/** Opens the https link. iOS and Android hand that to the native app when it is installed. */
export function FollowAlong({ links, heading = "Follow along" }: { links: SocialLink[]; heading?: string }) {
  if (links.length === 0) return null;
  return (
    <section className="follow">
      <h2>{heading}</h2>
      <div className="follow-row">
        {links.map((link) => (
          <a key={link.id} href={link.url} target="_blank" rel="noreferrer">
            <SocialIcon id={link.id} />
            {link.name}
          </a>
        ))}
      </div>
    </section>
  );
}

function SocialIcon({ id }: { id: string }) {
  if (id === "instagram") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3.4" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="16.6" cy="7.4" r="0.9" fill="currentColor" />
      </svg>
    );
  }
  if (id === "facebook") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M6.2 3.2h11.6a3 3 0 0 1 3 3v11.6a3 3 0 0 1-3 3H6.2a3 3 0 0 1-3-3V6.2a3 3 0 0 1 3-3zm6.9 16.3v-5.1h1.8l.3-2h-2.1v-.9c0-.55.16-.9.95-.9h1.15V8.4c-.2 0-.95-.1-1.8-.1-1.85 0-3.1 1.1-3.1 3.15v1.2H8.3v2h1.9v5.1h2.9z"
        />
      </svg>
    );
  }
  if (id === "youtube") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect
          x="3"
          y="6.5"
          width="18"
          height="11"
          rx="3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path fill="currentColor" d="M11 10.2v3.6l3.2-1.8-3.2-1.8z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
