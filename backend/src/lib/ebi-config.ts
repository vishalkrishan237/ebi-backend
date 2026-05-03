export type CoinPackage = {
  inr: number;
  coins: number;
};

export const COIN_PACKAGES: CoinPackage[] = [
  { inr: 10, coins: 1000 },
  { inr: 20, coins: 2000 },
  { inr: 25, coins: 2300 },
  { inr: 30, coins: 2500 },
  { inr: 40, coins: 3000 },
];

export function coinsForPackageInr(inr: number): number {
  const pkg = COIN_PACKAGES.find((candidate) => candidate.inr === inr);
  if (!pkg) {
    throw new Error(`Unsupported INR package: ${inr}`);
  }
  return pkg.coins;
}

export function coinsForEntryInr(inr: number): number {
  return inr * 100;
}

export function getIndiaDateStamp(now = new Date()): string {
  const shifted = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

export const DEFAULT_MATCH_DESCRIPTION = "1 kill = 10 coins, Booyah = 80 coins.";

export type OfficialMatchTemplate = {
  name: string;
  type: "free" | "paid";
  entryFeeInr: number;
  entryFee: number;
  prize: number;
  slots: number;
  minPlayersToStart: number;
  teamSize: number;
  mode: "solo" | "squad";
  isCaptainEntryOnly: boolean;
  description: string;
  startsAtOffsetHours: number;
};

export const OFFICIAL_EBI_MATCHES: OfficialMatchTemplate[] = [
  ...Array.from({ length: 10 }, (_, index) => ({
    name: `EBI ${index + 1}`,
    type: "free" as const,
    entryFeeInr: 0,
    entryFee: 0,
    prize: 0,
    slots: 50,
    minPlayersToStart: 30,
    teamSize: 1,
    mode: "solo" as const,
    isCaptainEntryOnly: false,
    description: DEFAULT_MATCH_DESCRIPTION,
    startsAtOffsetHours: 24 + index * 2,
  })),
  {
    name: "EBI Solo 1",
    type: "paid",
    entryFeeInr: 10,
    entryFee: coinsForPackageInr(10),
    prize: 8000,
    slots: 50,
    minPlayersToStart: 30,
    teamSize: 1,
    mode: "solo",
    isCaptainEntryOnly: false,
    description: DEFAULT_MATCH_DESCRIPTION,
    startsAtOffsetHours: 48,
  },
  {
    name: "EBI Solo 2",
    type: "paid",
    entryFeeInr: 20,
    entryFee: coinsForPackageInr(20),
    prize: 16000,
    slots: 50,
    minPlayersToStart: 30,
    teamSize: 1,
    mode: "solo",
    isCaptainEntryOnly: false,
    description: DEFAULT_MATCH_DESCRIPTION,
    startsAtOffsetHours: 52,
  },
  {
    name: "EBI Solo 3",
    type: "paid",
    entryFeeInr: 25,
    entryFee: coinsForPackageInr(25),
    prize: 18400,
    slots: 50,
    minPlayersToStart: 30,
    teamSize: 1,
    mode: "solo",
    isCaptainEntryOnly: false,
    description: DEFAULT_MATCH_DESCRIPTION,
    startsAtOffsetHours: 56,
  },
  {
    name: "EBI Squad Clash Alpha",
    type: "paid",
    entryFeeInr: 100,
    entryFee: coinsForEntryInr(100),
    prize: 12000,
    slots: 8,
    minPlayersToStart: 8,
    teamSize: 4,
    mode: "squad",
    isCaptainEntryOnly: true,
    description:
      "Captain pays once, then invites 3 teammates. Opponent captain pays once and invites 3 teammates. 1 kill = 10 coins, Booyah = 80 coins.",
    startsAtOffsetHours: 60,
  },
  {
    name: "EBI Squad Clash Bravo",
    type: "paid",
    entryFeeInr: 100,
    entryFee: coinsForEntryInr(100),
    prize: 12000,
    slots: 8,
    minPlayersToStart: 8,
    teamSize: 4,
    mode: "squad",
    isCaptainEntryOnly: true,
    description:
      "Captain pays once, then invites 3 teammates. Opponent captain pays once and invites 3 teammates. 1 kill = 10 coins, Booyah = 80 coins.",
    startsAtOffsetHours: 64,
  },
];
