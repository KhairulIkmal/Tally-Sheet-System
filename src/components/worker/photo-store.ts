/**
 * Pallet photos on the phone until the sheet is sent. They are too big for
 * localStorage (where the draft lives), so they go in IndexedDB, keyed
 * "<sheet client id>/<pallet id>/<taken at>". A retaken or removed photo is
 * kept until the sheet is sent or discarded, so Undo can bring it back.
 */

const DB = "tally-photos";
const STORE = "photos";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("No IndexedDB"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req ? req.result : undefined);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function putPhoto(key: string, blob: Blob): Promise<void> {
  await run("readwrite", (s) => s.put(blob, key));
}

export async function getPhoto(key: string): Promise<Blob | null> {
  try {
    const b = await run<Blob>("readonly", (s) => s.get(key));
    return b instanceof Blob ? b : null;
  } catch {
    return null;
  }
}

/** Every photo of one sheet, once it has been sent or thrown away. */
export async function deletePhotosFor(clientId: string): Promise<void> {
  try {
    await run("readwrite", (s) => s.delete(IDBKeyRange.bound(`${clientId}/`, `${clientId}/￿`)));
  } catch {
    // Nothing stored, or storage unavailable.
  }
}

/** A photo from the camera, shrunk to at most 1600 px on its long side as a JPEG. */
export async function shrinkPhoto(file: Blob): Promise<Blob> {
  const MAX = 1600;
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  for (const quality of [0.75, 0.6, 0.45]) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    if (blob && blob.size <= 1_500_000) return blob;
  }
  const last = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.35));
  if (!last) throw new Error("Couldn't read the photo.");
  return last;
}
