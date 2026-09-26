import { describe, expect, it } from "vitest";
import type { ApiConfig } from "./apiConfig";
import {
  getReasoningRequest,
  resolveReasoningSupport,
  showsReasoningMark,
} from "./reasoning";

describe("showsReasoningMark", () => {
  it.each([
    ["effort", true],
    ["toggle", true],
    ["fixed", true],
    ["none", false],
  ] as const)("returns %s -> %s", (support, expected) => {
    expect(showsReasoningMark(support)).toBe(expected);
  });
});

const base: ApiConfig = {
  endpoint: "http://localhost:1234",
  apiKey: "",
  provider: "lmstudio",
  model: "google/gemma-4-e4b",
  reasoningEffort: "high",
};

describe("resolveReasoningSupport", () => {
  it("prefers the detected support", () => {
    expect(
      resolveReasoningSupport({
        ...base,
        model: "gpt-oss:20b",
        reasoningSupport: "toggle",
      }),
    ).toBe("toggle");
  });

  it("guesses from the model name when nothing was detected", () => {
    expect(resolveReasoningSupport({ ...base, model: "gpt-oss:20b" })).toBe(
      "effort",
    );
    expect(resolveReasoningSupport({ ...base, model: "llama3" })).toBe("none");
  });
});

describe("getReasoningRequest", () => {
  it("sends the effort level for effort models", () => {
    expect(
      getReasoningRequest({ ...base, reasoningSupport: "effort" }),
    ).toEqual({ params: { reasoning_effort: "high" }, label: "high" });
  });

  it("sends nothing for effort models without a level", () => {
    expect(
      getReasoningRequest({
        ...base,
        reasoningSupport: "effort",
        reasoningEffort: undefined,
      }),
    ).toEqual({ params: {} });
  });

  it("disables reasoning with 'none' when a toggle model is switched off", () => {
    expect(
      getReasoningRequest({
        ...base,
        reasoningSupport: "toggle",
        reasoningEnabled: false,
      }),
    ).toEqual({ params: { reasoning_effort: "none" }, label: "off" });
  });

  it("enables reasoning with an effort value when a toggle model is switched on", () => {
    expect(
      getReasoningRequest({
        ...base,
        reasoningSupport: "toggle",
        reasoningEnabled: true,
      }),
    ).toEqual({ params: { reasoning_effort: "medium" }, label: "on" });
  });

  it("keeps the model default when the toggle was never changed", () => {
    expect(
      getReasoningRequest({ ...base, reasoningSupport: "toggle" }),
    ).toEqual({ params: {} });
  });

  it.each(["fixed", "none"] as const)(
    "sends nothing for %s models",
    (reasoningSupport) => {
      expect(getReasoningRequest({ ...base, reasoningSupport })).toEqual({
        params: {},
      });
    },
  );

  it("never sends the invalid value 'on'", () => {
    const { params } = getReasoningRequest({
      ...base,
      reasoningSupport: "toggle",
      reasoningEnabled: true,
    });
    expect(params.reasoning_effort).not.toBe("on");
  });
});
