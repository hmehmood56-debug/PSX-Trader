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
    title: "Build Starter Portfolio",
    description: "Create a balanced first PSX setup with guided allocation logic.",
    cue: "Allocation",
    badge: "Guided",
    answers: {
      amount: 250_000,
      risk: "balanced",
      goal: "starter growth",
      timeHorizon: "2-3 years",
    },
  },
  {
    id: "analyze_holdings",
    title: "Analyze My Holdings",
    description: "Review concentration, risk posture, and quality of current positions.",
    cue: "Risk Lens",
    badge: "Portfolio",
  },
  {
    id: "explain_stock",
    title: "Explain a Stock",
    description: "Get a plain-language breakdown of business quality and key watchpoints.",
    cue: "Research",
    badge: "Stock Brief",
  },
  {
    id: "learn_concept",
    title: "Learn a Concept",
    description: "Understand investing fundamentals in beginner-first Pakistani context.",
    cue: "Education",
    badge: "Learning",
  },
  {
    id: "find_dividend_stocks",
    title: "Find Dividend Stocks",
    description: "Discover income-oriented opportunities with structure and safeguards.",
    cue: "Income",
    badge: "Screening",
  },
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
        <span className="intelligence-hero-badge">PSX-focused intelligence</span>
        <h1>Perch Intelligence</h1>
        <p>
          AI-powered PSX investment guidance built for first-time Pakistan investors.
        </p>
        <div className="intelligence-hero-tags" aria-label="System capabilities">
          <span>Structured Guidance</span>
          <span>Risk-Aware Lens</span>
          <span>Beginner Friendly</span>
        </div>
      </section>

      <div className="intelligence-main-grid">
        <section className="intelligence-action-panel">
          <div className="intelligence-section-head">
            <span className="intelligence-label">Guided Workflows</span>
            <span className="intelligence-count">{actions.length} paths</span>
          </div>
          <div className="intelligence-action-grid">
            {actions.map((action) => {
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
        </section>

        <section className="intelligence-workspace">
          <div className="intelligence-section-head">
            <span className="intelligence-label">Intelligence Workspace</span>
            <span className="intelligence-count">
              {isLoading ? "Running workflow..." : "Layer 2 orchestration"}
            </span>
          </div>

          <div className={`intelligence-console ${isLoading ? "intelligence-console-loading" : ""}`}>
            {!selectedAction && !result ? (
              <div className="intelligence-empty-state">
                <div className="intelligence-empty-icon" aria-hidden>
                  <span />
                  <span />
                  <span />
                </div>
                <h2>Ready for structured guidance</h2>
                <p>
                  Choose a workflow to start your first intelligence session. Future
                  responses appear here with PSX-focused analysis and clear next
                  steps.
                </p>
              </div>
            ) : isLoading ? (
              <div className="intelligence-loading-state" aria-live="polite">
                <div className="intelligence-loading-bar" />
                <div className="intelligence-loading-bar intelligence-loading-bar-wide" />
                <div className="intelligence-loading-bar" />
                <p>Running structured intelligence checks...</p>
              </div>
            ) : requestError ? (
              <div className="intelligence-selected-state">
                <span className="intelligence-state-chip">Request failed</span>
                <h2>Unable to complete this workflow</h2>
                <p>{requestError}</p>
              </div>
            ) : result ? (
              <div className="intelligence-result-state">
                <div className="intelligence-result-header">
                  <span className="intelligence-state-chip">Workflow analysis</span>
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
                <span className="intelligence-state-chip">Workflow selected</span>
                <h2>{selectedAction.title}</h2>
                <p>{selectedAction.description}</p>
                <div className="intelligence-state-steps">
                  <div>
                    <span>01</span>
                    <p>Collect user intent and profile context.</p>
                  </div>
                  <div>
                    <span>02</span>
                    <p>Run structured PSX intelligence workflow.</p>
                  </div>
                  <div>
                    <span>03</span>
                    <p>Generate beginner-friendly action guidance.</p>
                  </div>
                </div>
              </div>
            ) : null}

            <form className="intelligence-composer" onSubmit={onSubmit}>
              <label htmlFor="intelligence-query" className="intelligence-label">
                Ask a custom question
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
                  {isLoading ? "Running..." : "Launch"}
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
