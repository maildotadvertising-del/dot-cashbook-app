import { DocumentNewPage } from "@/lib/doc-pages";

export default async function Page({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { brandId } = await params;
  return <DocumentNewPage brandId={brandId} docType="invoice" />;
}
