import { notFound } from "next/navigation";

import { SectionView } from "@/components/section-view";
import { copy, isSectionId } from "@/lib/i18n";
import { staffSession } from "@/lib/session";

export default async function SectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { section } = await params;
  const query = await searchParams;
  if (!isSectionId(section)) notFound();
  const { token, language } = await staffSession();
  const text = copy(language);
  return (
    <>
      <p className="muted">{text[section]}</p>
      <SectionView section={section} token={token} query={query} />
    </>
  );
}
