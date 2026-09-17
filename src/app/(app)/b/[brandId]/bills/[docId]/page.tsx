import { DocumentDetailPage } from "@/lib/doc-pages";

export default async function Page({
  params,
}: {
  params: Promise<{ brandId: string; docId: string }>;
}) {
  const { brandId, docId } = await params;
  return <DocumentDetailPage brandId={brandId} docId={docId} />;
}
