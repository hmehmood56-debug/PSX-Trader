"use client";

import { FormEvent, useMemo, useState } from "react";

type IntelligenceAction = {
  id: string;
  title: string;
  description: string;
  cue: string;
  badge: string;
};

const actions: IntelligenceAction[] = [
  {
    id: "starter-portfolio",
    title: "Build Starter Portfolio",
    description: "Create a balanced first PSX setup with guided allocation logic.",
    cue: "Allocation",
    badge: "Guided",
  },
  {
    id: "analyze-holdings",
    title: "Analyze My Holdings",
    description: "Review concentration, risk posture, and quality of current positions.",
    cue: "Risk Lens",
    badge: "Portfolio",
  },
  {
    id: "explain-stock",
    title: "Explain a Stock",
    description: "Get a plain-language breakdown of business quality and key watchpoints.",
    cue: "Research",
    badge: "Stock Brief",
  },
  {
    id: "learn-concept",
    title: "Learn a Concept",
    description: "Understand investing fundamentals in beginner-first Pakistani context.",
    cue: "Education",
    badge: "Learning",
  },
  {
    id: "find-dividend-stocks",
    title: "Find Dividend Stocks",
    description: "Discover income-oriented opportunities with structure and safeguards.",
    cue: "Income",
    badge: "Screening",
  },
];

export function IntelligenceSurface() {
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const selectedAction = useMemo(
    () => actions.find((item) => item.id === selectedActionId) ?? null,
    [selectedActionId]
  );

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
                  onClick={() => setSelectedActionId(action.id)}
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
            <span className="intelligence-count">Layer 1 surface</span>
          </div>

          <div className="intelligence-console">
            {!selectedAction ? (
              <div className="intelligence-empty-state">
                <div className="intelligence-empty-icon" aria-hidden>
                  <span />
                  <span />
                  <span />
                </div>
                <h2>Ready for structured guidance</h2>
                <p>
                  Choose a workflow to start your first intelligence session. Future
                  responses will appear here with PSX-focused analysis and clear next
                  steps.
                </p>
              </div>
            ) : (
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
            )}

            <form className="intelligence-composer" onSubmit={onSubmit}>
              <label htmlFor="intelligence-query" className="intelligence-label">
                Ask a custom question
              </label>
              <div className="intelligence-composer-row">
                <input
                  id="intelligence-query"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="e.g. Explain what makes a PSX stock risky for beginners"
                  aria-label="Perch Intelligence prompt"
                />
                <button type="submit" aria-label="Submit intelligence request">
                  Launch
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
