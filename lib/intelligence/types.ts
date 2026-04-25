export type IntelligenceIntent =
  | "build_starter_portfolio"
  | "analyze_holdings"
  | "explain_stock"
  | "learn_concept"
  | "find_dividend_stocks"
  | "custom_question";

export type IntelligenceHoldingInput = {
  ticker: string;
  shares: number;
  avgBuyPrice?: number;
};

export type IntelligenceAnswers = {
  amount?: number;
  risk?: string;
  goal?: string;
  timeHorizon?: string;
};

export type IntelligenceContext = {
  holdings?: IntelligenceHoldingInput[];
  selectedTicker?: string;
};

export type IntelligenceRequest = {
  intent: IntelligenceIntent;
  message?: string;
  answers?: IntelligenceAnswers;
  context?: IntelligenceContext;
};

export type IntelligenceRiskLevel = "Low" | "Moderate" | "Elevated" | "High";
export type IntelligenceConfidenceLabel = "High confidence" | "Moderate confidence" | "Exploratory";

export type IntelligenceCardType =
  | "recommended_stock"
  | "portfolio_allocation"
  | "concept_explanation"
  | "dividend_pick"
  | "holding_analysis"
  | "signal";

export type IntelligenceCardMetric = {
  label: string;
  value: string;
};

export type IntelligenceCard = {
  id: string;
  type: IntelligenceCardType;
  title: string;
  subtitle?: string;
  ticker?: string;
  riskLabel?: string;
  metrics?: IntelligenceCardMetric[];
  bullets?: string[];
};

export type IntelligenceResponse = {
  type: "intelligence_workflow_result";
  intent: IntelligenceIntent;
  title: string;
  summary: string;
  riskLevel: IntelligenceRiskLevel;
  confidenceLabel: IntelligenceConfidenceLabel;
  cards: IntelligenceCard[];
  suggestions: string[];
  cta: {
    label: string;
    followUpIntent?: IntelligenceIntent;
  };
};
