import { describe, expect, it } from "vitest";
import { isReasoningModel } from "./model";

describe("isReasoningModel", () => {
  it("returns false for undefined or empty model names", () => {
    expect(isReasoningModel(undefined)).toBe(false);
    expect(isReasoningModel("")).toBe(false);
  });

  it.each([
    "o1",
    "o1-mini",
    "my-reasoning-model",
    "gpt-oss:20b",
    "deepseek-r1:7b",
  ])("returns true for reasoning model %s", (name) => {
    expect(isReasoningModel(name)).toBe(true);
  });

  it("matches case-insensitively", () => {
    expect(isReasoningModel("O1-Preview")).toBe(true);
    expect(isReasoningModel("DeepSeek-R1")).toBe(true);
    expect(isReasoningModel("GPT-OSS")).toBe(true);
  });

  it.each(["gpt-4o", "llama3", "gpt-3.5-turbo", "mistral"])(
    "returns false for non-reasoning model %s",
    (name) => {
      expect(isReasoningModel(name)).toBe(false);
    },
  );

  it("matches 'o1' as a substring anywhere (current heuristic behavior)", () => {
    // 部分一致のため "o1" を含む非推論モデル名も true になる（現仕様）
    expect(isReasoningModel("foo10")).toBe(true);
  });
});
