const GPT_5_6_PREFERENCE_BOOSTS: Record<string, number> = {
  "openai/gpt-5.6-luna": 78,
  "openai/gpt-5.6-sol": 70,
  "openai/gpt-5.6-terra": 80,
};

export function getModelPreferenceBoost(modelId: string): number {
  const canonicalId = modelId.replace(/^openrouter\//, "").toLowerCase();

  return GPT_5_6_PREFERENCE_BOOSTS[canonicalId] ?? 0;
}
