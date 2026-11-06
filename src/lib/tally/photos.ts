import type { Draft } from "./draft";
import type { SubmitPayload } from "./payload";

/**
 * Pallet photos: optional evidence of each pallet's condition when it left.
 * Taken on the phone, kept there (IndexedDB) until the sheet is sent, then
 * uploaded to a private bucket the office can view. Never printed.
 */
export const PHOTO_BUCKET = "tally-pallet-photos";
/** The bucket's own limit is 2 MB; photos are shrunk well under it on the phone. */
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Where a pallet's photo is stored: the worker's folder, the sheet's folder, the pallet number. */
export function photoObjectPath(userId: string, clientId: string, palletNo: number): string {
  return `${userId}/${clientId}/p${palletNo}.jpg`;
}

/** A path this worker may upload to (the database checks it again). */
export function isOwnPhotoPath(path: string, userId: string): boolean {
  return new RegExp(`^${userId.replace(/[^0-9a-f-]/gi, "")}/${UUID}/p[0-9]{1,3}\\.jpg$`).test(path);
}

/** The photos taken on a draft, by pallet number on the sheet. */
export function photosToUpload(draft: Pick<Draft, "items">): { palletNo: number; key: string }[] {
  const out: { palletNo: number; key: string }[] = [];
  let n = 0;
  for (const it of draft.items)
    for (const p of it.pallets) {
      n += 1;
      if (p.photo?.key) out.push({ palletNo: n, key: p.photo.key });
    }
  return out;
}

/** The payload with the uploaded photos' paths on their pallets. */
export function withPhotoPaths(payload: SubmitPayload, paths: Map<number, string>): SubmitPayload {
  let n = 0;
  return {
    ...payload,
    items: payload.items.map((it) => ({
      ...it,
      pallets: it.pallets.map((p) => {
        n += 1;
        return { ...p, photo: paths.get(n) ?? "" };
      }),
    })),
  };
}
