import { DocumentListPage } from "@/lib/doc-pages";

export default async function Page({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  return <DocumentListPage brandId={brandId} docType="invoice" />;
}
