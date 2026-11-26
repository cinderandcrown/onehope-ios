import Image from "next/image";

/**
 * The church's own hosted photo, or a brand-colored block when none is set.
 * `unoptimized` serves the URL as-is. No custom `loader`: this renders in server components, and a function
 * prop cannot cross into next/image (a client component), which made /login and Home fail with a 500 whenever
 * a photo was configured.
 */
export function ChurchImage({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  if (!src) {
    return <div className={`church-fallback ${className ?? ""}`} role="img" aria-label={alt} />;
  }
  return <Image className={className} src={src} alt={alt} width={1400} height={900} unoptimized />;
}
