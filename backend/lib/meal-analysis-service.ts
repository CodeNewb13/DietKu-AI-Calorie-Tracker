import {
  MEAL_ANALYSIS_MAX_TOKENS,
  MEAL_ANALYSIS_MAX_TOKENS_COMPACT,
  buildMealAnalysisPrompt,
  extractOpenAIContent,
  systemPromptForMeal,
  validateMealAnalysisFromContent,
  type OpenAIChatResponse,
} from "../../utils/mealAnalysisCore";
import type { MealAnalysis } from "../../types/nutrition";

const OPENAI_BASE_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";

/** Google exposes an OpenAI-compatible surface, so only URL + model + key differ. */
const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
// "*-latest" alias survives Google's model retirements; pinned versions get dropped for new keys.
const GEMINI_DEFAULT_MODEL = "gemini-flash-lite-latest";

export type MealAnalysisProvider = {
  name: "openai" | "gemini";
  baseUrl: string;
  model: string;
  apiKey: string;
};

/** Dev override: AI_PROVIDER=gemini routes meal scans to Google AI Studio. */
export function configuredProviderName(): "openai" | "gemini" {
  return process.env.AI_PROVIDER?.trim().toLowerCase() === "gemini" ? "gemini" : "openai";
}

export function resolveMealAnalysisProvider(): MealAnalysisProvider {
  if (configuredProviderName() === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
    return {
      name: "gemini",
      baseUrl: process.env.GEMINI_BASE_URL?.trim() || GEMINI_BASE_URL,
      model: process.env.GEMINI_MODEL?.trim() || GEMINI_DEFAULT_MODEL,
      apiKey,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");
  return { name: "openai", baseUrl: OPENAI_BASE_URL, model: OPENAI_MODEL, apiKey };
}

/** True when a meal scan can actually be served by the selected provider. */
export function mealAnalysisConfigured(): boolean {
  return configuredProviderName() === "gemini"
    ? Boolean(process.env.GEMINI_API_KEY?.trim())
    : Boolean(process.env.OPENAI_API_KEY?.trim());
}

export type MealAnalysisAttemptLog = {
  attempt: number;
  compact: boolean;
  finishReason: string | null;
  contentLength: number;
  itemCount?: number;
  ok: boolean;
};

async function callChatCompletions(
  provider: MealAnalysisProvider,
  payload: unknown
): Promise<OpenAIChatResponse> {
  const response = await fetch(provider.baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${provider.name} request failed: ${response.status} ${errorText}`);
  }
  return response.json() as Promise<OpenAIChatResponse>;
}

export async function analyzeMealImage(options: {
  /** Optional: omit to resolve the provider from env (AI_PROVIDER / *_API_KEY). */
  apiKey?: string;
  dataUrl: string;
  language: "id" | "en";
}): Promise<{ analysis: MealAnalysis; rawContent: string; logs: MealAnalysisAttemptLog[] }> {
  const { dataUrl, language } = options;
  const resolved = resolveMealAnalysisProvider();
  // An explicitly passed key only applies to the default (OpenAI) provider.
  const provider: MealAnalysisProvider =
    options.apiKey && resolved.name === "openai"
      ? { ...resolved, apiKey: options.apiKey }
      : resolved;
  const attempts: Array<{ compact: boolean; maxTokens: number }> = [
    { compact: false, maxTokens: MEAL_ANALYSIS_MAX_TOKENS },
    { compact: true, maxTokens: MEAL_ANALYSIS_MAX_TOKENS_COMPACT },
  ];

  const logs: MealAnalysisAttemptLog[] = [];
  let lastError = "MEAL_ANALYSIS_PARSE_FAILED";

  for (let i = 0; i < attempts.length; i += 1) {
    const { compact, maxTokens } = attempts[i];
    const prompt = buildMealAnalysisPrompt(language, compact);

    const openAIData = await callChatCompletions(provider, {
      model: provider.model,
      temperature: 0.2,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPromptForMeal(language) },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: dataUrl, detail: "low" },
            },
          ],
        },
      ],
    });

    const { content, refusal, finishReason } = extractOpenAIContent(openAIData);

    if (refusal) {
      throw new Error(refusal);
    }

    const log: MealAnalysisAttemptLog = {
      attempt: i + 1,
      compact,
      finishReason,
      contentLength: content?.length ?? 0,
      ok: false,
    };

    if (!content?.trim() || finishReason === "length") {
      lastError = finishReason === "length" ? "MEAL_ANALYSIS_TRUNCATED" : "MEAL_ANALYSIS_PARSE_FAILED";
      logs.push(log);
      continue;
    }

    const validated = validateMealAnalysisFromContent(content, language);
    if (validated.ok) {
      log.ok = true;
      log.itemCount = validated.analysis.items.length;
      logs.push(log);
      return { analysis: validated.analysis, rawContent: content, logs };
    }

    lastError = validated.error;
    logs.push(log);
  }

  const err = new Error(lastError);
  (err as Error & { logs?: MealAnalysisAttemptLog[] }).logs = logs;
  throw err;
}
