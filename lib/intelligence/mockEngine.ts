import { MOCK_STOCKS } from "@/lib/mockData";

import { formatCurrency, formatPercent, toTitleCase } from "./formatters";
import type {
  IntelligenceCard,
  IntelligenceHoldingInput,
  IntelligenceIntent,
  IntelligenceRequest,
  IntelligenceResponse,
} from "./types";

type StockAllocation = {
  ticker: string;
  percent: number;
};

const VALID_INTENTS: IntelligenceIntent[] = [
  "build_starter_portfolio",
  "analyze_holdings",
  "explain_stock",
  "learn_concept",
  "find_dividend_stocks",
  "custom_question",
];

function isValidIntent(value: unknown): value is IntelligenceIntent {
  return typeof value === "string" && VALID_INTENTS.includes(value as IntelligenceIntent);
}

function getStockByTicker(ticker: string) {
  return MOCK_STOCKS.find((item) => item.ticker === ticker.toUpperCase());
}

function parseRiskBucket(riskValue?: string): "conservative" | "balanced" | "growth" {
  if (!riskValue) return "balanced";
  const normalized = riskValue.toLowerCase();
  if (normalized.includes("low") || normalized.includes("conservative")) return "conservative";
  if (normalized.includes("high") || normalized.includes("aggressive") || normalized.includes("growth")) return "growth";
  return "balanced";
}

function selectStarterAllocations(riskBucket: "conservative" | "balanced" | "growth"): StockAllocation[] {
  if (riskBucket === "conservative") {
    return [
      { ticker: "UBL", percent: 30 },
      { ticker: "HBL", percent: 25 },
      { ticker: "OGDC", percent: 25 },
      { ticker: "HUBC", percent: 20 },
    ];
  }

  if (riskBucket === "growth") {
    return [
      { ticker: "LUCK", percent: 30 },
      { ticker: "TRG", percent: 25 },
      { ticker: "MARI", percent: 25 },
      { ticker: "ENGRO", percent: 20 },
    ];
  }

  return [
    { ticker: "HBL", percent: 30 },
    { ticker: "OGDC", percent: 25 },
    { ticker: "ENGRO", percent: 25 },
    { ticker: "LUCK", percent: 20 },
  ];
}

function toAllocationCards(allocations: StockAllocation[], amount: number): IntelligenceCard[] {
  const mappedCards = allocations.map((allocation): IntelligenceCard | null => {
      const stock = getStockByTicker(allocation.ticker);
      if (!stock) return null;
      const capital = (amount * allocation.percent) / 100;
      return {
        id: `${stock.ticker}-allocation`,
        type: "portfolio_allocation",
        title: `${stock.ticker} allocation`,
        subtitle: stock.name,
        ticker: stock.ticker,
        riskLabel: stock.changePercent >= 0 ? "Momentum positive" : "Mean reversion candidate",
        metrics: [
          { label: "Target weight", value: formatPercent(allocation.percent) },
          { label: "Estimated capital", value: formatCurrency(capital) },
          { label: "Last close", value: `PKR ${stock.price.toFixed(2)}` },
        ],
        bullets: [
          `Sector exposure: ${stock.sector}`,
          `Recent move: ${stock.changePercent >= 0 ? "+" : ""}${stock.changePercent.toFixed(2)}%`,
        ],
      } satisfies IntelligenceCard;
    });

  return mappedCards.filter((card): card is IntelligenceCard => card !== null);
}

function analyzeHoldings(holdings: IntelligenceHoldingInput[]): IntelligenceResponse {
  if (holdings.length === 0) {
    return {
      type: "intelligence_workflow_result",
      intent: "analyze_holdings",
      title: "Portfolio analysis needs active positions",
      summary:
        "No holdings were provided yet. Add one or more PSX positions to unlock diversification and risk diagnostics.",
      riskLevel: "Low",
      confidenceLabel: "Moderate confidence",
      cards: [
        {
          id: "analysis-empty",
          type: "signal",
          title: "No analyzable positions detected",
          subtitle: "Start with 2-4 starter positions across sectors",
          bullets: [
            "Use Build Starter Portfolio for a guided basket.",
            "Aim for at least two sectors before concentrating.",
          ],
        },
      ],
      suggestions: [
        "Build a starter portfolio first.",
        "Fund a sample allocation and return for analysis.",
      ],
      cta: {
        label: "Build starter portfolio",
        followUpIntent: "build_starter_portfolio",
      },
    };
  }

  const enriched = holdings
    .map((holding) => {
      const stock = getStockByTicker(holding.ticker);
      if (!stock) return null;
      const marketValue = stock.price * holding.shares;
      return {
        ...holding,
        stock,
        marketValue,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const totalValue = enriched.reduce((sum, item) => sum + item.marketValue, 0);
  const sectorWeights = new Map<string, number>();
  for (const row of enriched) {
    sectorWeights.set(row.stock.sector, (sectorWeights.get(row.stock.sector) ?? 0) + row.marketValue);
  }

  const topHolding = [...enriched].sort((a, b) => b.marketValue - a.marketValue)[0];
  const topWeight = totalValue > 0 ? (topHolding.marketValue / totalValue) * 100 : 0;
  const sectorCount = sectorWeights.size;
  const concentrationRisk = topWeight > 50 || sectorCount <= 1;
  const responseRisk = concentrationRisk ? "Elevated" : topWeight > 35 ? "Moderate" : "Low";

  const cards: IntelligenceCard[] = [
    {
      id: "analysis-overview",
      type: "holding_analysis",
      title: "Concentration and diversification snapshot",
      metrics: [
        { label: "Holdings tracked", value: `${enriched.length}` },
        { label: "Sector breadth", value: `${sectorCount}` },
        { label: "Largest position", value: `${topHolding.stock.ticker} (${formatPercent(topWeight)})` },
      ],
      bullets: [
        concentrationRisk
          ? "Portfolio concentration is high relative to beginner risk norms."
          : "Position sizing is reasonably diversified for a starter portfolio.",
      ],
    },
  ];

  for (const row of enriched.slice(0, 3)) {
    const weight = totalValue > 0 ? (row.marketValue / totalValue) * 100 : 0;
    cards.push({
      id: `holding-${row.stock.ticker}`,
      type: "holding_analysis",
      title: `${row.stock.ticker} holding check`,
      subtitle: row.stock.name,
      ticker: row.stock.ticker,
      riskLabel: weight > 40 ? "High concentration" : "Within range",
      metrics: [
        { label: "Portfolio weight", value: formatPercent(weight) },
        { label: "Market value", value: formatCurrency(row.marketValue) },
        { label: "Sector", value: row.stock.sector },
      ],
      bullets: [
        row.stock.description,
        "Review this position if its weight rises above 35%-40%.",
      ],
    });
  }

  return {
    type: "intelligence_workflow_result",
    intent: "analyze_holdings",
    title: "Holdings risk diagnostic",
    summary:
      "Perch Intelligence reviewed your live holdings context and generated concentration and sector-breadth signals.",
    riskLevel: responseRisk,
    confidenceLabel: "Moderate confidence",
    cards,
    suggestions: [
      "Keep largest single position under 35% for beginner stability.",
      "Target 3+ sectors to reduce single-theme drawdowns.",
      "Re-run this analysis after each major buy/sell.",
    ],
    cta: {
      label: "Find dividend names to balance risk",
      followUpIntent: "find_dividend_stocks",
    },
  };
}

function explainStock(tickerInput?: string): IntelligenceResponse {
  const fallback = MOCK_STOCKS[0];
  const ticker = (tickerInput ?? fallback.ticker).toUpperCase();
  const stock = getStockByTicker(ticker) ?? fallback;

  return {
    type: "intelligence_workflow_result",
    intent: "explain_stock",
    title: `${stock.ticker} in plain language`,
    summary: "This stock brief focuses on business quality, sector context, and beginner watchpoints.",
    riskLevel: stock.sector === "Technology" ? "Elevated" : "Moderate",
    confidenceLabel: "Moderate confidence",
    cards: [
      {
        id: `${stock.ticker}-brief`,
        type: "recommended_stock",
        title: `${stock.ticker} business brief`,
        subtitle: stock.name,
        ticker: stock.ticker,
        metrics: [
          { label: "Sector", value: stock.sector },
          { label: "Market cap", value: formatCurrency(stock.marketCap) },
          { label: "Last close", value: `PKR ${stock.price.toFixed(2)}` },
        ],
        bullets: [
          stock.description,
          "Watch quarterly earnings quality and sector demand cycles.",
          "Avoid over-allocating until trend and conviction improve.",
        ],
      },
    ],
    suggestions: [
      "Compare this stock against one peer before buying.",
      "Set a max allocation cap based on your risk profile.",
    ],
    cta: {
      label: "Analyze my holdings with this stock included",
      followUpIntent: "analyze_holdings",
    },
  };
}

function learnConcept(message?: string): IntelligenceResponse {
  const text = (message ?? "").toLowerCase();
  const concept = text.includes("dividend")
    ? "dividend"
    : text.includes("volatility")
      ? "volatility"
      : text.includes("market cap")
        ? "market cap"
        : "diversification";

  const conceptMap: Record<string, { title: string; bullets: string[]; riskLevel: "Low" | "Moderate" }> = {
    dividend: {
      title: "Dividend",
      bullets: [
        "A dividend is cash paid by a company to shareholders, usually from profits.",
        "Stable dividend names can support income-focused beginners.",
        "Dividend yield alone is not enough; evaluate payout sustainability too.",
      ],
      riskLevel: "Low",
    },
    volatility: {
      title: "Volatility",
      bullets: [
        "Volatility describes how sharply a stock price moves over time.",
        "Higher volatility can mean both bigger upside and deeper drawdowns.",
        "New investors should size volatile positions smaller.",
      ],
      riskLevel: "Moderate",
    },
    "market cap": {
      title: "Market Cap",
      bullets: [
        "Market cap is company size: share price multiplied by total shares.",
        "Large-cap names are often more stable than small-cap names.",
        "Use market cap with sector and earnings quality before deciding.",
      ],
      riskLevel: "Low",
    },
    diversification: {
      title: "Diversification",
      bullets: [
        "Diversification spreads risk across sectors and business models.",
        "A simple beginner target is 3-5 names across at least 3 sectors.",
        "Diversification reduces single-stock or single-sector shocks.",
      ],
      riskLevel: "Low",
    },
  };

  const selected = conceptMap[concept];
  return {
    type: "intelligence_workflow_result",
    intent: "learn_concept",
    title: `Concept guide: ${selected.title}`,
    summary: "Perch Intelligence converted the concept into practical beginner guidance for PSX investing.",
    riskLevel: selected.riskLevel,
    confidenceLabel: "High confidence",
    cards: [
      {
        id: `concept-${concept.replace(" ", "-")}`,
        type: "concept_explanation",
        title: selected.title,
        bullets: selected.bullets,
      },
    ],
    suggestions: [
      "Ask for an example using your current holdings.",
      "Apply this concept before your next buy decision.",
    ],
    cta: {
      label: "Build a starter portfolio using this concept",
      followUpIntent: "build_starter_portfolio",
    },
  };
}

function findDividendStocks(): IntelligenceResponse {
  const picks = ["HUBC", "UBL", "HBL", "OGDC"]
    .map((ticker) => getStockByTicker(ticker))
    .filter((item): item is NonNullable<typeof item> => item !== undefined);

  return {
    type: "intelligence_workflow_result",
    intent: "find_dividend_stocks",
    title: "Income-oriented PSX shortlist",
    summary:
      "This shortlist prioritizes mature sectors and established businesses often considered by income-focused beginners.",
    riskLevel: "Moderate",
    confidenceLabel: "Moderate confidence",
    cards: picks.map((stock) => ({
      id: `dividend-${stock.ticker}`,
      type: "dividend_pick",
      title: `${stock.ticker} dividend profile`,
      subtitle: stock.name,
      ticker: stock.ticker,
      metrics: [
        { label: "Sector", value: stock.sector },
        { label: "Income profile", value: "Established payer candidate" },
        { label: "Price trend", value: `${stock.changePercent >= 0 ? "+" : ""}${stock.changePercent.toFixed(2)}%` },
      ],
      bullets: [
        "Focus on payout consistency and cash flow quality.",
        "Combine with at least one growth-oriented position for balance.",
      ],
    })),
    suggestions: [
      "Check if these names overlap too heavily in one sector.",
      "Pair income names with a growth sleeve for total return.",
    ],
    cta: {
      label: "Analyze holdings after adding dividend names",
      followUpIntent: "analyze_holdings",
    },
  };
}

function buildStarterPortfolio(request: IntelligenceRequest): IntelligenceResponse {
  const amount = request.answers?.amount && request.answers.amount > 0 ? request.answers.amount : 250_000;
  const riskBucket = parseRiskBucket(request.answers?.risk);
  const goal = request.answers?.goal ? toTitleCase(request.answers.goal) : "Balanced starter growth";
  const timeHorizon = request.answers?.timeHorizon ? toTitleCase(request.answers.timeHorizon) : "2-3 years";
  const allocations = selectStarterAllocations(riskBucket);

  const cards = toAllocationCards(allocations, amount);
  return {
    type: "intelligence_workflow_result",
    intent: "build_starter_portfolio",
    title: "Starter portfolio blueprint",
    summary:
      "Perch Intelligence generated a guided starter allocation using current PSX universe names and your risk profile.",
    riskLevel: riskBucket === "growth" ? "Elevated" : riskBucket === "conservative" ? "Low" : "Moderate",
    confidenceLabel: "Moderate confidence",
    cards: [
      {
        id: "starter-plan",
        type: "signal",
        title: "Portfolio construction signal",
        metrics: [
          { label: "Capital base", value: formatCurrency(amount) },
          { label: "Risk posture", value: toTitleCase(riskBucket) },
          { label: "Time horizon", value: timeHorizon },
        ],
        bullets: [
          `Primary goal: ${goal}`,
          "Deploy in staggered entries to reduce timing risk.",
        ],
      },
      ...cards,
    ],
    suggestions: [
      "Start with 2 tranches instead of one full deployment.",
      "Rebalance if any position crosses 35% weight.",
      "Re-run analysis monthly while learning.",
    ],
    cta: {
      label: "Run holdings analysis after first buys",
      followUpIntent: "analyze_holdings",
    },
  };
}

function customQuestion(message?: string): IntelligenceResponse {
  const cleanMessage = message?.trim() || "Custom question received.";
  return {
    type: "intelligence_workflow_result",
    intent: "custom_question",
    title: "Custom intelligence response",
    summary:
      "Perch Intelligence logged your custom request and returned a structured response block to keep workflow outputs consistent.",
    riskLevel: "Moderate",
    confidenceLabel: "Exploratory",
    cards: [
      {
        id: "custom-answer",
        type: "signal",
        title: "Answer snapshot",
        subtitle: cleanMessage,
        bullets: [
          "Detailed reasoning will be upgraded in the DeepSeek integration layer.",
          "For now, use workflow actions for the strongest structured guidance.",
        ],
      },
    ],
    suggestions: [
      "Try a guided workflow for richer structured output.",
      "Add holdings context to increase personalization.",
    ],
    cta: {
      label: "Build starter portfolio",
      followUpIntent: "build_starter_portfolio",
    },
  };
}

export function runMockIntelligence(request: IntelligenceRequest): IntelligenceResponse {
  if (!isValidIntent(request.intent)) {
    return customQuestion("Unsupported intent fallback.");
  }

  switch (request.intent) {
    case "build_starter_portfolio":
      return buildStarterPortfolio(request);
    case "analyze_holdings":
      return analyzeHoldings(request.context?.holdings ?? []);
    case "explain_stock":
      return explainStock(request.context?.selectedTicker);
    case "learn_concept":
      return learnConcept(request.message);
    case "find_dividend_stocks":
      return findDividendStocks();
    case "custom_question":
      return customQuestion(request.message);
    default:
      return customQuestion("Unsupported intent fallback.");
  }
}
