import { describe, expect, it } from "vitest";
import { draftToPayload } from "./payload";
import { isOwnPhotoPath, photoObjectPath, photosToUpload, withPhotoPaths } from "./photos";
import { sampleDraft } from "./sample";
import { paperFromDraft } from "./sheet";

const at = new Date("2026-11-06T02:00:00Z");
const USER = "00000000-0000-4000-8000-000000000001";
const SHEET = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("pallet photo paths", () => {
  it("go in the worker's folder for the sheet, by pallet number", () => {
    expect(photoObjectPath(USER, SHEET, 7)).toBe(`${USER}/${SHEET}/p7.jpg`);
  });

  it("are only the worker's own, in that shape", () => {
    expect(isOwnPhotoPath(`${USER}/${SHEET}/p7.jpg`, USER)).toBe(true);
    expect(isOwnPhotoPath(`00000000-0000-4000-8000-000000000002/${SHEET}/p7.jpg`, USER)).toBe(false);
    expect(isOwnPhotoPath(`${USER}/${SHEET}/p7.png`, USER)).toBe(false);
    expect(isOwnPhotoPath(`${USER}/../x/p7.jpg`, USER)).toBe(false);
    expect(isOwnPhotoPath(`${USER}/${SHEET}/p7.jpg/extra`, USER)).toBe(false);
  });
});

describe("photos on a draft", () => {
  it("are listed by their pallet number on the sheet, across items", () => {
    const d = sampleDraft(at, "lorry");
    d.items[0].pallets[1].photo = { key: "k1", takenAt: "t" };
    d.items[2].pallets[0].photo = { key: "k2", takenAt: "t" };
    // Item 1 has 4 pallets and item 2 has 2, so item 3's first pallet is number 7.
    expect(photosToUpload(d)).toEqual([
      { palletNo: 2, key: "k1" },
      { palletNo: 7, key: "k2" },
    ]);
  });

  it("go on the payload once uploaded, and nowhere else", () => {
    const d = sampleDraft(at, "lorry");
    d.signature = "data:image/png;base64,AAAA";
    const payload = withPhotoPaths(draftToPayload(d, "x"), new Map([[7, "path-7"]]));
    const photos = payload.items.flatMap((it) => it.pallets.map((p) => p.photo));
    expect(photos.filter(Boolean)).toEqual(["path-7"]);
    expect(photos[6]).toBe("path-7");
  });

  it("are not printed", () => {
    const d = sampleDraft(at, "lorry");
    d.items[0].pallets[0].photo = { key: "k1", takenAt: "t" };
    expect(JSON.stringify(paperFromDraft(d, "A"))).not.toContain("k1");
  });
});
