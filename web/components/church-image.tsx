import Image from "next/image";

function remote({ src }: { src: string }) {
  return src;
}

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
  return <Image className={className} src={src} alt={alt} width={1400} height={900} loader={remote} unoptimized />;
}
