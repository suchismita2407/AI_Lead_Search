/** Server-only Groq deal review. Numbers are supplied by the investor, not verified market data. */
import { requireWorkspaceAccess } from "./auth.server";
import { computeDeal, type DealInputs } from "./analyzer";
import { openAiChatCompletion } from "./ai.server";

export type DealAiReview = { summary: string } | { error: string };

export async function reviewDealWithAi(inputs: DealInputs): Promise<DealAiReview> {
  await requireWorkspaceAccess();
  const result = computeDeal(inputs);
  if (!result.complete || result.totalCost === null || result.estimatedProfit === null || result.roi === null) {
    return { error: "Enter a purchase price and ARV before requesting an AI review." };
  }
  if (!process.env.GROQ_API_KEY || process.env.AI_PROVIDER !== "groq") {
    return { error: "Groq is not configured for this environment." };
  }
  const money = (n: number | null) => n == null ? "not provided" : `$${Math.round(n).toLocaleString("en-US")}`;
  try {
    const summary = await openAiChatCompletion([
      {
        role: "system",
        content: "You are a cautious US residential real-estate deal analyst. Explain in plain English for a beginner. Do not state that a deal is guaranteed, do not give legal advice, and do not present contract assignment/wholesaling as legal in every location. Assess only the supplied numbers. Use short headings: Bottom line, Flip, Wholesale / assignment, Buy and hold, Biggest risks, Next checks. For every strategy, say Proceed, Negotiate lower, or Pass and explain why. Mention that local laws, the purchase contract, buyer demand, title, inspection, financing, taxes, rents, and comparable sales need professional verification. Keep the answer under 450 words.",
      },
      {
        role: "user",
        content: `Review these unverified deal assumptions:\nPurchase: ${money(inputs.purchase)}\nRehab: ${money(inputs.rehab)}\nClosing: ${money(inputs.closing)}\nHolding: ${money(inputs.holding)}\nSelling: ${money(inputs.selling)}\nARV: ${money(inputs.arv)}\nTotal cost: ${money(result.totalCost)}\nEstimated profit: ${money(result.estimatedProfit)}\nROI: ${result.roi.toFixed(1)}%\nRule-based recommendation: ${result.recommendation}.`,
      },
    ], { temperature: 0.25, maxTokens: 650 });
    return { summary };
  } catch (error) {
    console.error("[deal-analysis] Groq review failed", error);
    return { error: "The AI review is temporarily unavailable. Check your Groq configuration and try again." };
  }
}
