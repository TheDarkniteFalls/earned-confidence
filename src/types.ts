export const POLICY_BAND_INTERPRETATION =
  "policy-defined band; not a statistical confidence interval" as const;

export const POLICY_CONFIRMATION_INTERPRETATION =
  "policy-confirmed aggregate; not objective ground truth" as const;

export interface EstimatedStage {
  readonly kind: "estimated";
  readonly label: string;
  readonly minSamples: number;
  readonly radius: number;
}

export interface ConfirmedStage {
  readonly kind: "confirmed";
  readonly label: string;
  readonly minSamples: number;
}

export type ConfidenceStage = EstimatedStage | ConfirmedStage;

export interface EvidencePolicyInput {
  readonly id: string;
  readonly range: {
    readonly min: number;
    readonly max: number;
  };
  readonly precision?: number;
  readonly stages: readonly ConfidenceStage[];
}

export interface EvidencePolicy {
  readonly id: string;
  readonly range: {
    readonly min: number;
    readonly max: number;
  };
  readonly precision: number;
  readonly stages: readonly ConfidenceStage[];
}

export interface DirectEvidence {
  readonly id: string;
  readonly key: string;
  readonly value: number;
  readonly observedAt: string;
}

export interface EvidenceRecord {
  readonly key: string;
  readonly samples: readonly DirectEvidence[];
}

export interface EvidenceLedger {
  readonly records: readonly EvidenceRecord[];
}

export interface UnknownKnowledge {
  readonly status: "unknown";
  readonly sampleCount: 0;
  readonly evidenceIds: readonly [];
}

export interface EstimatedKnowledge {
  readonly status: "estimated";
  readonly confidence: string;
  readonly sampleCount: number;
  readonly center: number;
  readonly min: number;
  readonly max: number;
  readonly evidenceIds: readonly string[];
  readonly interpretation: typeof POLICY_BAND_INTERPRETATION;
}

export interface ConfirmedKnowledge {
  readonly status: "confirmed";
  readonly confidence: string;
  readonly sampleCount: number;
  readonly value: number;
  readonly evidenceIds: readonly string[];
  readonly interpretation: typeof POLICY_CONFIRMATION_INTERPRETATION;
}

export type KnowledgeView =
  | UnknownKnowledge
  | EstimatedKnowledge
  | ConfirmedKnowledge;

export interface KeyedKnowledgeView {
  readonly key: string;
  readonly knowledge: KnowledgeView;
}

export interface DecisionSnapshot {
  readonly schemaVersion: 1;
  readonly decisionId: string;
  readonly committedAt: string;
  readonly policyId: string;
  readonly knowledge: readonly KeyedKnowledgeView[];
}
