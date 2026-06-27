function compress(file: File, maxWidth: number, quality: number): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Compress a single-subject photo (a bumper, a key tag) to a small JPEG data URL —
 * fast and plenty of detail for one subject.
 */
export function compressImage(file: File): Promise<string> {
  return compress(file, 800, 0.72);
}

/**
 * Compress a dense DOCUMENT (e.g. a multi-week schedule grid) at higher resolution —
 * ~1568px is Claude vision's full-detail sweet spot, so small text stays legible.
 */
export function compressDocumentImage(file: File): Promise<string> {
  return compress(file, 1600, 0.85);
}
