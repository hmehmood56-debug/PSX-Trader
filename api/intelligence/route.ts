import { NextResponse } from "next/server";

import { runMockIntelligence } from "@/lib/intelligence/mockEngine";
import type { IntelligenceIntent, IntelligenceRequest } from "@/lib/intelligence/types";

const SUPPORTED_INTENTS: IntelligenceIntent[] = [
  "build_starter_portfolio",
  "analyze_holdings",
  "explain_stock",
  "learn_concept",
  "find_dividend_stocks",
  "custom_question",
];

function isSupportedIntent(value: unknown): value is IntelligenceIntent {
  return typeof value === "string" && SUPPORTED_INTENTS.includes(value as IntelligenceIntent);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<IntelligenceRequest>;
    if (!body || !isSupportedIntent(body.intent)) {
      return NextResponse.json(
        {
          error: "Invalid intelligence request. Provide a supported intent.",
          supportedIntents: SUPPORTED_INTENTS,
        },
        { status: 400 }
      );
    }

    const responsePayload = runMockIntelligence({
      intent: body.intent,
      message: typeof body.message === "string" ? body.message : undefined,
      answers: body.answers,
      context: body.context,
    });

    return NextResponse.json(responsePayload, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        error: "Unable to process intelligence request.",
      },
      { status: 500 }
    );
  }
}
