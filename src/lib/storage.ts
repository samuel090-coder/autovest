import { supabase } from "@/integrations/supabase/client";

/**
 * Upload a file to a storage bucket and return a long-lived signed URL
 * (10 years). Used because workspace blocks public buckets.
 */
export async function uploadAndGetUrl(
  bucket: "investment-images" | "banners" | "avatars",
  file: File,
  path?: string,
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const key = path ?? `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(key, file, {
    upsert: true,
    contentType: file.type,
  });
  if (error) throw error;
  const { data, error: signErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(key, 60 * 60 * 24 * 365 * 10);
  if (signErr) throw signErr;
  return data.signedUrl;
}
