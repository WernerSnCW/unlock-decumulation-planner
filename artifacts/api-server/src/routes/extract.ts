import { Router, type IRouter } from "express";
import { investorAuth } from "../middlewares/investor-auth";

const router: IRouter = Router();

const EXTRACTION_PROMPT = `You are an expert at reading financial documents and extracting asset register data.

Analyze the following text extracted from a financial document (could be a portfolio statement, spreadsheet dump, or advisor report). Extract every identifiable investment asset.

For EACH asset, provide these fields (use null if not identifiable):
- label: Asset name (e.g. "Vanguard LifeStrategy 60 ISA", "NatWest Premium Saver")
- current_value: Current market value as a number (no currency symbols)
- asset_class: One of: cash, isa, pension, property_investment, property_residential, vct, eis, aim_shares
- wrapper_type: One of: unwrapped, isa, pension (infer from context if not explicit)
- assumed_growth_rate: Annual growth rate as decimal (e.g. 0.06 for 6%). Estimate if not stated.
- income_generated: Annual income (dividends, rent, interest) as a number. 0 if none.
- acquisition_cost: Original purchase price as a number. null if unknown.
- acquisition_date: Date acquired in YYYY-MM-DD format. null if unknown.
- mortgage_balance: Outstanding mortgage as a number. 0 if none/not applicable.
- is_iht_exempt: true if asset qualifies for BPR (typically EIS, AIM shares held 2+ years). false otherwise.
- pension_type: "sipp", "ssas", or "db" for pensions. null for non-pensions.
- tax_relief_claimed: Amount of relief already claimed as a number. 0 if none.
- original_subscription_amount: Original amount invested (for EIS/VCT). null if not applicable.
- relief_claimed_type: One of: none, income_tax_relief, cgt_deferral, both. "none" if not applicable.
- estimated_disposal_cost_pct: Estimated selling cost as decimal (e.g. 0.025 for 2.5%). 0 for liquid assets.
- owner: Who owns the asset if multiple people are mentioned (initials or name). null if single owner.

IMPORTANT RULES:
- Use the MOST RECENT values if multiple dates/periods are shown
- If the document shows multiple people's assets, extract ALL of them and tag with owner
- If you see abbreviations (ISA, SIPP, VCT, EIS, BTL, etc.), interpret them correctly
- For property, distinguish between investment (rental/BTL) and residential (home)
- If growth rates aren't stated, estimate: cash ~4.5%, ISA ~6%, pension ~5.5%, property ~3%, VCT ~7%, EIS ~12%, AIM ~6.5%
- Convert any percentage values to decimals (6% → 0.06)
- Skip totals, subtotals, and summary rows — only extract individual assets
- If something looks like an asset but you're unsure, include it and set a low confidence

Return a JSON object with this exact structure:
{
  "assets": [...array of asset objects...],
  "notes": "Brief description of what you found and any assumptions made",
  "confidence": "high" | "medium" | "low",
  "issues": ["list of any problems or ambiguities encountered"]
}

Return ONLY the JSON object, no markdown code fences or other text.`;

router.post("/investor/extract-assets", investorAuth, async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
    return;
  }

  const { text, filename } = req.body;
  if (!text || typeof text !== "string") {
    res.status(400).json({ error: "Missing 'text' field in request body" });
    return;
  }

  // Truncate text to keep API calls fast and within limits
  const truncatedText = text.slice(0, 30000);

  const callApi = async (attempt: number): Promise<Response> => {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: `${EXTRACTION_PROMPT}\n\n--- DOCUMENT TEXT (from file: ${filename ?? "unknown"}) ---\n\n${truncatedText}`,
          },
        ],
      }),
    });

    // Retry on 529 (overloaded) up to 2 times
    if (response.status === 529 && attempt < 3) {
      const wait = 2000 * attempt;
      console.log(`Anthropic API overloaded (529), retrying in ${wait}ms (attempt ${attempt})...`);
      await new Promise(r => setTimeout(r, wait));
      return callApi(attempt + 1);
    }

    return response;
  };

  try {
    const response = await callApi(1);

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Anthropic API error:", response.status, errBody);
      const hint = response.status === 529
        ? "The AI service is temporarily busy. Please try again in a moment."
        : `AI extraction failed (${response.status}). Try CSV or Excel import instead.`;
      res.status(502).json({ error: hint });
      return;
    }

    const data = await response.json() as any;
    const content = data.content?.[0]?.text;

    if (!content) {
      res.status(502).json({ error: "AI returned empty response" });
      return;
    }

    // Parse the JSON response
    try {
      // Strip any markdown code fences if present
      const cleaned = content.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      const result = JSON.parse(cleaned);
      res.json(result);
    } catch {
      console.error("Failed to parse AI response as JSON:", content.slice(0, 500));
      res.status(502).json({ error: "AI returned invalid data. Try CSV or Excel import instead." });
    }
  } catch (err: any) {
    console.error("Extract-assets error:", err);
    res.status(500).json({ error: `Extraction failed: ${err.message ?? "Unknown error"}` });
  }
});

export default router;
