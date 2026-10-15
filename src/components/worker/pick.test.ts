import { describe, expect, it } from "vitest";
import { suggestItems, type ItemSuggestion } from "./pick";

const h = (name: string): ItemSuggestion => ({ name, unit: "CTN", qtyPerPallet: null, useCount: 1 });
const history = [h("PALM OLEIN 17KG"), h("MARGARINE 5KG"), h("GHEE 2KG"), h("BAKERY MARGARINE 20KG"), h("SHORTENING 2KG")];

describe("suggestItems", () => {
  it("lists the most recent items when nothing is typed", () => {
    expect(suggestItems("", history, 2).map((x) => x.name)).toEqual(["PALM OLEIN 17KG", "MARGARINE 5KG"]);
  });

  it("ranks names starting with the text, then word starts, then anywhere", () => {
    expect(suggestItems("mar", history).map((x) => x.name)).toEqual(["MARGARINE 5KG", "BAKERY MARGARINE 20KG"]);
    expect(suggestItems("2kg", history).map((x) => x.name)).toEqual(["GHEE 2KG", "SHORTENING 2KG"]);
  });

  it("hides an exact match, since there is nothing left to suggest", () => {
    expect(suggestItems("ghee 2kg", history)).toEqual([]);
  });
});
