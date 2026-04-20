export type OptionsSide = "call" | "put";

export type SimulatedOptionPosition = {
  id: string;
  ownerKey: string;
  ticker: string;
  side: OptionsSide;
  strike: number;
  expiry: string;
  premiumPaid: number;
  quantity: number;
  createdAt: string;
};

export type OptionsPositionsFile = {
  version: 1;
  positions: SimulatedOptionPosition[];
};
