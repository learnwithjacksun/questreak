export type UploadSignature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
};

export async function getUploadSignature(): Promise<UploadSignature> {
  const res = await fetch("/api/media/sign", { method: "POST" });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Uploads are unavailable right now.");
  return json;
}

/** Direct, signed browser upload to Cloudinary with progress. */
export function uploadFile(
  file: File,
  sign: UploadSignature,
  onProgress: (p: number) => void,
) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("api_key", sign.apiKey);
    form.append("timestamp", String(sign.timestamp));
    form.append("signature", sign.signature);
    form.append("folder", sign.folder);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${sign.cloudName}/auto/upload`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText);
        if (xhr.status < 300) resolve(json);
        else reject(new Error(json.error?.message ?? "Upload failed"));
      } catch {
        reject(new Error("Upload failed"));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(form);
  });
}
