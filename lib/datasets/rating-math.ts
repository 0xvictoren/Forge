/**
 * A dataset's rating out of 10. It starts as its originality score and moves
 * as real buyers and agents use it:
 *
 *   rating = (K x originality + n x market + 2r x buyerAverage) / (K + n + 2r)
 *
 * market (0-10) = 10 x (0.4 conversion + 0.35 repeat + 0.25 (1 - walkaway))
 *   conversion  buyers / (viewers + agents that looked), full marks at 20%
 *   repeat      share of agent buyers that came back on another day
 *   walkaway    share of agents that looked or asked a price and never bought
 * n = distinct buyers (humans + agents), r = ratings left by licence holders.
 * K = 5, so a handful of buyers cannot swing a new listing either way.
 */

const K = 5;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round1 = (x: number) => Math.round(x * 10) / 10;

export function combineRating(input: {
  originality: number | null;
  viewers: number;
  agentsLooked: number;
  humanBuyers: number;
  agentBuyers: number;
  repeatAgents: number;
  walkaways: number;
  ratings: number[];
}) {
  const buyers = input.humanBuyers + input.agentBuyers;
  const audience = Math.max(buyers, input.viewers + input.agentsLooked);
  let market: number | null = null;
  if (audience > 0) {
    const conversion = clamp01(buyers / audience / 0.2);
    const repeat = input.agentBuyers ? input.repeatAgents / input.agentBuyers : 0.5;
    const walkaway = input.agentsLooked ? input.walkaways / input.agentsLooked : 0;
    market = 10 * (0.4 * conversion + 0.35 * repeat + 0.25 * (1 - walkaway));
  }
  const r = input.ratings.length;
  const buyerAverage = r ? input.ratings.reduce((s, x) => s + x, 0) / r : null;
  const prior = input.originality ?? 5;
  const n = market == null ? 0 : buyers;
  const rating = (K * prior + n * (market ?? 0) + 2 * r * (buyerAverage ?? 0)) / (K + n + 2 * r);
  return { rating: round1(rating), market: market == null ? null : round1(market), buyerAverage: buyerAverage == null ? null : round1(buyerAverage), buyers };
}

