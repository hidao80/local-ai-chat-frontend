/** Heuristically determine whether a model name identifies a reasoning model. */
export function isReasoningModel(modelName: string | undefined): boolean {
  if (!modelName) return false;
  const lowerName = modelName.toLowerCase();
  // Check for o1-family, reasoning, gpt-oss and similar patterns
  return (
    lowerName.includes("o1") ||
    lowerName.includes("reasoning") ||
    lowerName.includes("gpt-oss") ||
    lowerName.includes("deepseek-r1")
  );
}
