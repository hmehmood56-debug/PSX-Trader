"use client";

import { FormEvent, useMemo, useState } from "react";

import { usePortfolioState } from "@/hooks/usePortfolioState";
import type {
  IntelligenceIntent,
  IntelligenceRequest,
  IntelligenceResponse,
} from "@/lib/intelligence/types";

type IntelligenceAction = {
  id: IntelligenceIntent;
  title: string;
  description: string;
  cue: string;
  badge: string;
  answers?: IntelligenceRequest["answers"];
};

const actions: IntelligenceAction[] = [
  {
    id: "build_starter_portfolio",
    title: "Build My First Portfolio",
    description: "Start with a balanced PSX mix and simple allocation guidance.",
    cue: "Starter Allocation",
    badge: "Beginner Pick",
    answers: {
      amount: 250_000,
      risk: "balanced",
      goal: "starter growth",
      timeHorizon: "2-3 years",
    },
  },
  {
    id: "analyze_holdings",
    title: "Analyze Portfolio",
    description: "Review your holdings for balance, risk, and overall quality.",
    cue: "Portfolio Guidance",
    badge: "Portfolio",
  },
  {
    id: "explain_stock",
    title: "Explain a Stock",
    description: "Understand any stock in plain language before you decide.",
    cue: "Market Insight",
    badge: "Quick Brief",
  },
  {
    id: "learn_concept",
    title: "Learn a Concept",
    description: "Learn core investing ideas with simple examples for Pakistan investors.",
    cue: "Education",
    badge: "Beginner Guide",
  },
  {
    id: "find_dividend_stocks",
    title: "Explore Safe Picks",
    description: "Find dividend opportunities with practical guardrails and context.",
    cue: "Income Focus",
    badge: "Stock Filter",
  },
];

const primaryActionOrder: IntelligenceIntent[] = [
  "build_starter_portfolio",
  "analyze_holdings",
  "explain_stock",
];

export function IntelligenceSurface() {
  const portfolio = usePortfolioState();
  const [selectedActionId, setSelectedActionId] = useState<IntelligenceIntent | null>(null);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<IntelligenceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const selectedAction = useMemo(
    () => actions.find((item) => item.id === selectedActionId) ?? null,
    [selectedActionId]
  );
  const primaryActions = useMemo(
    () => primaryActionOrder.map((id) => actions.find((item) => item.id === id)).filter(Boolean) as IntelligenceAction[],
    []
  );
  const secondaryActions = useMemo(
    () => actions.filter((item) => !primaryActionOrder.includes(item.id)),
    []
  );

  const primaryTicker = portfolio.holdings[0]?.ticker;

  const launchWorkflow = async (requestBody: IntelligenceRequest) => {
    setIsLoading(true);
    setRequestError(null);
    try {
      const response = await fetch("/api/intelligence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        throw new Error("The intelligence engine is temporarily unavailable.");
      }
      const payload = (await response.json()) as IntelligenceResponse;
      setResult(payload);
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : "Unable to load intelligence output right now."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const onActionClick = async (action: IntelligenceAction) => {
    setSelectedActionId(action.id);
    await launchWorkflow({
      intent: action.id,
      answers: action.answers,
      context: {
        holdings: portfolio.holdings,
        selectedTicker: primaryTicker,
      },
    });
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.trim()) return;
    setSelectedActionId("custom_question");
    await launchWorkflow({
      intent: "custom_question",
      message: query.trim(),
      context: {
        holdings: portfolio.holdings,
        selectedTicker: primaryTicker,
      },
    });
  };

  return (
    <div className="perch-shell perch-shell-wide intelligence-shell">
      <section className="intelligence-hero">
        <div className="intelligence-hero-grid">
          <div>
            <span className="intelligence-hero-badge">PSX-focused intelligence</span>
            <h1>Perch Intelligence</h1>
            <p>
              Premium guidance for Pakistan&apos;s markets, designed to help first-time investors
              make clearer, calmer decisions with confidence.
            </p>
            <div className="intelligence-hero-tags" aria-label="System capabilities">
              <span>Beginner Friendly</span>
              <span>Portfolio Guidance</span>
              <span>Market Insight</span>
            </div>
          </div>
          <div className="intelligence-hero-graphic" aria-hidden>
            <span className="intelligence-hero-graphic-label">Perch Market Signals</span>
            <div className="intelligence-hero-lines">
              <span />
              <span />
              <span />
            </div>
            <div className="intelligence-hero-graph">
              <span />
            </div>
          </div>
        </div>
      </section>

      <div className="intelligence-main-grid">
        <section className="intelligence-action-panel">
          <div className="intelligence-section-head">
            <span className="intelligence-label">Guided Workflows</span>
            <span className="intelligence-count">{actions.length} guidance paths</span>
          </div>
          <div className="intelligence-action-tier">
            <span className="intelligence-tier-label">Primary workflows</span>
            <div className="intelligence-action-grid intelligence-action-grid-primary">
              {primaryActions.map((action) => {
                const active = selectedActionId === action.id;
                return (
                  <button
                    key={action.id}
                    type="button"
                    className={`intelligence-action-card intelligence-action-card-primary ${active ? "intelligence-action-card-active" : ""}`}
                    onClick={() => void onActionClick(action)}
                  >
                    <div className="intelligence-action-row">
                      <span className="intelligence-action-cue">{action.cue}</span>
                      <span className="intelligence-action-badge">{action.badge}</span>
                    </div>
                    <h3>{action.title}</h3>
                    <p>{action.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="intelligence-action-tier intelligence-action-tier-secondary">
            <span className="intelligence-tier-label">Secondary tools</span>
            <div className="intelligence-action-grid intelligence-action-grid-secondary">
              {secondaryActions.map((action) => {
              const active = selectedActionId === action.id;
              return (
                <button
                  key={action.id}
                  type="button"
                  className={`intelligence-action-card ${active ? "intelligence-action-card-active" : ""}`}
                  onClick={() => void onActionClick(action)}
                >
                  <div className="intelligence-action-row">
                    <span className="intelligence-action-cue">{action.cue}</span>
                    <span className="intelligence-action-badge">{action.badge}</span>
                  </div>
                  <h3>{action.title}</h3>
                  <p>{action.description}</p>
                </button>
              );
              })}
            </div>
          </div>
        </section>

        <section className="intelligence-workspace">
          <div className="intelligence-section-head">
            <span className="intelligence-label">Live Analysis</span>
            <div className="intelligence-workspace-head">
              <span className="intelligence-workspace-chip">Perch Guidance</span>
              <span className="intelligence-count">
                {isLoading ? "Analyzing your request..." : "Ready for your next question"}
              </span>
            </div>
          </div>

          <div className={`intelligence-console ${isLoading ? "intelligence-console-loading" : ""}`}>
            {!selectedAction && !result ? (
              <div className="intelligence-empty-state">
                <div className="intelligence-empty-icon" aria-hidden>
                  <span />
                  <span />
                  <span />
                </div>
                <h2>Choose a workflow to get started</h2>
                <p>
                  We&apos;ll help you build your first PSX portfolio, review your current holdings,
                  and discover practical next steps.
                </p>
              </div>
            ) : isLoading ? (
              <div className="intelligence-loading-state" aria-live="polite">
                <div className="intelligence-loading-bar" />
                <div className="intelligence-loading-bar intelligence-loading-bar-wide" />
                <div className="intelligence-loading-bar" />
                <p>Preparing your guidance...</p>
              </div>
            ) : requestError ? (
              <div className="intelligence-selected-state">
                <span className="intelligence-state-chip">Analysis paused</span>
                <h2>We couldn&apos;t complete this request</h2>
                <p>{requestError}</p>
              </div>
            ) : result ? (
              <div className="intelligence-result-state">
                <div className="intelligence-result-header">
                  <span className="intelligence-state-chip">Portfolio Guidance</span>
                  <span className="intelligence-result-pill">{result.confidenceLabel}</span>
                </div>
                <h2>{result.title}</h2>
                <p>{result.summary}</p>
                <div className="intelligence-meta-row">
                  <span>Risk: {result.riskLevel}</span>
                  <span>Cards: {result.cards.length}</span>
                </div>

                <div className="intelligence-output-grid">
                  {result.cards.map((card) => (
                    <article key={card.id} className="intelligence-output-card">
                      <div className="intelligence-output-head">
                        <span>{card.type.replaceAll("_", " ")}</span>
                        {card.riskLabel ? <span>{card.riskLabel}</span> : null}
                      </div>
                      <h3>{card.title}</h3>
                      {card.subtitle ? <p className="intelligence-card-subtitle">{card.subtitle}</p> : null}
                      {card.metrics?.length ? (
                        <div className="intelligence-card-metrics">
                          {card.metrics.map((metric) => (
                            <div key={`${card.id}-${metric.label}`}>
                              <span>{metric.label}</span>
                              <strong>{metric.value}</strong>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {card.bullets?.length ? (
                        <ul>
                          {card.bullets.map((item) => (
                            <li key={`${card.id}-${item}`}>{item}</li>
                          ))}
                        </ul>
                      ) : null}
                    </article>
                  ))}
                </div>

                <div className="intelligence-suggestions">
                  <h3>Suggested next steps</h3>
                  <ul>
                    {result.suggestions.map((suggestion) => (
                      <li key={suggestion}>{suggestion}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => {
                      const followUpAction = actions.find(
                        (action) => action.id === result.cta.followUpIntent
                      );
                      if (followUpAction) {
                        void onActionClick(followUpAction);
                      }
                    }}
                  >
                    {result.cta.label}
                  </button>
                </div>
              </div>
            ) : selectedAction ? (
              <div className="intelligence-selected-state">
                <span className="intelligence-state-chip">Guidance selected</span>
                <h2>{selectedAction.title}</h2>
                <p>{selectedAction.description}</p>
                <div className="intelligence-state-steps">
                  <div>
                    <span>01</span>
                    <p>Understand your goal and current portfolio context.</p>
                  </div>
                  <div>
                    <span>02</span>
                    <p>Review PSX data and spot useful signals for your case.</p>
                  </div>
                  <div>
                    <span>03</span>
                    <p>Share clear, beginner-friendly next steps.</p>
                  </div>
                </div>
              </div>
            ) : null}

            <form className="intelligence-composer" onSubmit={onSubmit}>
              <label htmlFor="intelligence-query" className="intelligence-label">
                Ask Perch
              </label>
              <div className="intelligence-composer-row">
                <input
                  id="intelligence-query"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="e.g. What is a safe allocation style for a first PSX portfolio?"
                  aria-label="Perch Intelligence prompt"
                />
                <button type="submit" aria-label="Submit intelligence request" disabled={isLoading}>
                  {isLoading ? "Analyzing..." : "Get Guidance"}
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
