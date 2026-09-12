export type MarketActionState = {
  status: "idle" | "failure" | "success";
  message: string;
  fieldErrors?: {
    quantityKwh?: string[];
    price?: string[];
  };
  result?: {
    id: string;
    state: string;
    quantityKwh: string;
  };
};

export const initialMarketActionState: MarketActionState = {
  status: "idle",
  message: "",
};
