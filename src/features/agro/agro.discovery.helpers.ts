import { AgroDiscoveryResponseDraft } from "./agro.discovery.types";

export function buildDiscoveryDraft(answers: Record<string, string>): AgroDiscoveryResponseDraft {
  return {
    moduleKey: "agro",
    version: "v1",
    answeredAt: new Date().toISOString(),
    answers: Object.entries(answers)
      .filter(([, selectedOption]) => Boolean(selectedOption))
      .map(([questionId, selectedOption]) => ({
        questionId,
        selectedOption
      }))
  };
}
