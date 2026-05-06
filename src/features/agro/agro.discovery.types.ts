export interface AgroDiscoveryQuestionDefinition {
  id: string;
  title: string;
  helper: string;
  options: string[];
}

export interface AgroDiscoveryAnswerInput {
  questionId: string;
  selectedOption: string;
}

export interface AgroDiscoveryResponseDraft {
  moduleKey: "agro";
  version: "v1";
  answeredAt: string;
  answers: AgroDiscoveryAnswerInput[];
}

export interface AgroDiscoveryResponseRecord extends AgroDiscoveryResponseDraft {
  id: number;
  tenantId: number;
  createdAt: string;
  updatedAt: string;
}
