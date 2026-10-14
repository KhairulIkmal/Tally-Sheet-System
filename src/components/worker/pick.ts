import type { PltType } from "@/lib/tally/constants";

/** The "add item" form across the product picker and pallet setup screens. */
export interface PickState {
  q: string;
  name: string;
  productId: string | null;
  mode: "auto" | "manual";
  total: string;
  per: string;
  count: string;
  pltType: PltType;
  contractNo: string;
}

export function blankPick(defaults?: Partial<Pick<PickState, "pltType" | "contractNo">>): PickState {
  return {
    q: "",
    name: "",
    productId: null,
    mode: "auto",
    total: "",
    per: "",
    count: "",
    pltType: defaults?.pltType ?? "L",
    contractNo: defaults?.contractNo ?? "",
  };
}

export interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
  ctnPerPallet: number | null;
}
