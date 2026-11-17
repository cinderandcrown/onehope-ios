import { notFound } from "next/navigation";

import { SectionView } from "@/components/section-view";
import { copy, isSectionId } from "@/lib/i18n";
import { staffSession } from "@/lib/session";

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!isSectionId(section)) notFound();
  const { token, language } = await staffSession();
  const text = copy(language);
  return (
    <>
      <p className="muted">{text[section]}</p>
      <SectionView section={section} token={token} />
    </>
  );
}
