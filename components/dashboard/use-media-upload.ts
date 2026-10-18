"use client";

import { useState } from "react";
import { toast } from "sonner";
import { recordMedia } from "@/app/actions/media";
import { getUploadSignature, uploadFile } from "@/lib/upload";

export type UploadItem = { id: string; name: string; progress: number };
export type UploadedMedia = {
  id: string;
  url: string;
  resourceType: "image" | "video";
  name: string;
};

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/**
 * Validates, uploads (direct to Cloudinary, with progress) and records files in the
 * user's media library. Resolves with the files that succeeded; failures are toasted.
 */
export function useMediaUpload() {
  const [uploads, setUploads] = useState<UploadItem[]>([]);

  async function upload(files: FileList | File[]): Promise<UploadedMedia[]> {
    const list = Array.from(files).filter((f) => {
      if (!/^(image|video)\//.test(f.type)) {
        toast.error(`${f.name} isn't an image or video.`);
        return false;
      }
      if (f.size > MAX_UPLOAD_BYTES) {
        toast.error(`${f.name} is larger than 100 MB.`);
        return false;
      }
      return true;
    });
    if (!list.length) return [];

    let sign;
    try {
      sign = await getUploadSignature();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Uploads are unavailable right now.");
      return [];
    }

    const done = await Promise.all(
      list.map(async (file): Promise<UploadedMedia | null> => {
        const id = `${file.name}-${file.size}-${Math.random()}`;
        setUploads((u) => [...u, { id, name: file.name, progress: 0 }]);
        try {
          const r = await uploadFile(file, sign, (progress) =>
            setUploads((u) => u.map((x) => (x.id === id ? { ...x, progress } : x))),
          );
          const resourceType = r.resource_type === "video" ? "video" : "image";
          const saved = await recordMedia({
            publicId: String(r.public_id),
            url: String(r.secure_url),
            resourceType,
            format: r.format ? String(r.format) : undefined,
            bytes: Number(r.bytes ?? file.size),
            width: r.width ? Number(r.width) : undefined,
            height: r.height ? Number(r.height) : undefined,
            duration: r.duration ? Number(r.duration) : undefined,
            name: file.name,
          });
          if (!saved.ok) throw new Error(saved.error);
          return { id: saved.id, url: String(r.secure_url), resourceType, name: file.name };
        } catch (e) {
          toast.error(`${file.name}: ${e instanceof Error ? e.message : "Upload failed"}`);
          return null;
        } finally {
          setUploads((u) => u.filter((x) => x.id !== id));
        }
      }),
    );
    return done.filter((m): m is UploadedMedia => m !== null);
  }

  return { uploads, upload };
}
