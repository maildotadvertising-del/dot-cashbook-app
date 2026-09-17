import { createClient } from "@/lib/supabase/client";

const MAX_EDGE = 1600;

/** Phone photos are several MB; a 1600px JPEG stays legible at a fraction of that. */
async function shrink(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 900_000) return file;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.82),
  );
}

export async function uploadReceipt(brandId: string, file: File) {
  const body = await shrink(file);
  const isJpeg = body !== file || file.type === "image/jpeg";
  const ext = isJpeg ? "jpg" : (file.name.split(".").pop() ?? "bin").toLowerCase();
  const path = `${brandId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await createClient()
    .storage.from("receipts")
    .upload(path, body, { contentType: isJpeg ? "image/jpeg" : file.type });

  if (error) throw new Error(error.message);
  return path;
}

export async function receiptUrl(path: string) {
  const { data } = await createClient().storage.from("receipts").createSignedUrl(path, 60 * 10);
  return data?.signedUrl ?? null;
}
