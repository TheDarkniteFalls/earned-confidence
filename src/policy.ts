import {
  POLICY_BAND_INTERPRETATION,
  POLICY_CONFIRMATION_INTERPRETATION,
  type ConfidenceStage,
  type DirectEvidence,
  type EvidenceLedger,
  type EvidencePolicy,
  type EvidencePolicyInput,
  type EvidenceRecord,
  type KnowledgeView,
} from "./types.ts";

export function defineEvidencePolicy(
  input: EvidencePolicyInput,
): EvidencePolicy {
  const id = requiredText(input.id, "Policy id");
  const min = requiredFiniteNumber(input.range.min, "Policy range minimum");
  const max = requiredFiniteNumber(input.range.max, "Policy range maximum");
  if (max <= min) {
    throw new Error("Policy range maximum must be greater than its minimum.");
  }

  const precision = input.precision ?? 0;
  if (!Number.isInteger(precision) || precision < 0 || precision > 8) {
    throw new Error("Policy precision must be an integer from 0 through 8.");
  }
  if (input.stages.length === 0) {
    throw new Error("An evidence policy needs at least one confidence stage.");
  }

  const stages = input.stages
    .map(normalizeStage)
    .toSorted(
      (left, right) =>
        left.minSamples - right.minSamples ||
        left.label.localeCompare(right.label),
    );
  if (stages[0]?.minSamples !== 1) {
    throw new Error("The first confidence stage must begin at one sample.");
  }
  if (new Set(stages.map((stage) => stage.minSamples)).size !== stages.length) {
    throw new Error("Confidence stages must use distinct sample thresholds.");
  }
  if (new Set(stages.map((stage) => stage.label)).size !== stages.length) {
    throw new Error("Confidence stages must use distinct labels.");
  }

  const confirmedIndex = stages.findIndex(
    (stage) => stage.kind === "confirmed",
  );
  if (
    confirmedIndex >= 0 &&
    (confirmedIndex !== stages.length - 1 ||
      stages.some(
        (stage, index) => stage.kind === "confirmed" && index !== confirmedIndex,
      ))
  ) {
    throw new Error("A policy may have one confirmed stage, and it must be last.");
  }

  return Object.freeze({
    id,
    range: Object.freeze({ min, max }),
    precision,
    stages: Object.freeze(stages),
  });
}

export function createEvidenceLedger(): EvidenceLedger {
  return Object.freeze({ records: Object.freeze([]) });
}

export function recordDirectEvidence(input: {
  readonly ledger: EvidenceLedger;
  readonly policy: EvidencePolicy;
  readonly evidence: DirectEvidence;
}): EvidenceLedger {
  const evidence = normalizeEvidence(input.evidence, input.policy);
  if (
    input.ledger.records.some((record) =>
      record.samples.some((sample) => sample.id === evidence.id),
    )
  ) {
    throw new Error(`Evidence id already exists: ${evidence.id}.`);
  }

  const existing = input.ledger.records.find(
    (record) => record.key === evidence.key,
  );
  const nextRecord: EvidenceRecord = Object.freeze({
    key: evidence.key,
    samples: Object.freeze(
      [...(existing?.samples ?? []), evidence].toSorted(compareEvidence),
    ),
  });
  const records = [
    ...input.ledger.records.filter((record) => record.key !== evidence.key),
    nextRecord,
  ].toSorted((left, right) => left.key.localeCompare(right.key));

  return Object.freeze({ records: Object.freeze(records) });
}

export function projectKnowledge(input: {
  readonly key: string;
  readonly ledger: EvidenceLedger;
  readonly policy: EvidencePolicy;
}): KnowledgeView {
  const key = requiredText(input.key, "Evidence key");
  const samples =
    input.ledger.records.find((record) => record.key === key)?.samples ?? [];
  if (samples.length === 0) {
    const evidenceIds: readonly [] = Object.freeze([]);
    return Object.freeze({
      status: "unknown",
      sampleCount: 0,
      evidenceIds,
    });
  }

  for (const sample of samples) {
    if (
      !Number.isFinite(sample.value) ||
      sample.value < input.policy.range.min ||
      sample.value > input.policy.range.max
    ) {
      throw new Error(
        `Evidence ${sample.id} value ${sample.value} is outside active policy range ${input.policy.range.min}..${input.policy.range.max}.`,
      );
    }
  }

  const stage = activeStage(input.policy.stages, samples.length);
  const center = roundToPrecision(
    samples.reduce((total, sample) => total + sample.value, 0) /
      samples.length,
    input.policy.precision,
  );
  const evidenceIds = Object.freeze(samples.map((sample) => sample.id));
  if (stage.kind === "confirmed") {
    return Object.freeze({
      status: "confirmed",
      confidence: stage.label,
      sampleCount: samples.length,
      value: center,
      evidenceIds,
      interpretation: POLICY_CONFIRMATION_INTERPRETATION,
    });
  }

  return Object.freeze({
    status: "estimated",
    confidence: stage.label,
    sampleCount: samples.length,
    center,
    min: roundToPrecision(
      clamp(center - stage.radius, input.policy.range),
      input.policy.precision,
    ),
    max: roundToPrecision(
      clamp(center + stage.radius, input.policy.range),
      input.policy.precision,
    ),
    evidenceIds,
    interpretation: POLICY_BAND_INTERPRETATION,
  });
}

function normalizeStage(stage: ConfidenceStage): ConfidenceStage {
  const label = requiredText(stage.label, "Confidence label");
  const minSamples = requiredPositiveInteger(
    stage.minSamples,
    `Minimum samples for ${label}`,
  );
  if (stage.kind === "confirmed") {
    return Object.freeze({ kind: "confirmed", label, minSamples });
  }
  const radius = requiredFiniteNumber(
    stage.radius,
    `Band radius for ${label}`,
  );
  if (radius <= 0) {
    throw new Error(`Estimated stage ${label} needs a positive band radius.`);
  }
  return Object.freeze({ kind: "estimated", label, minSamples, radius });
}

function normalizeEvidence(
  evidence: DirectEvidence,
  policy: EvidencePolicy,
): DirectEvidence {
  const id = requiredText(evidence.id, "Evidence id");
  const key = requiredText(evidence.key, "Evidence key");
  const observedAt = requiredText(evidence.observedAt, "Evidence timestamp");
  const value = requiredFiniteNumber(evidence.value, "Evidence value");
  if (value < policy.range.min || value > policy.range.max) {
    throw new Error(
      `Evidence value ${value} is outside policy range ${policy.range.min}..${policy.range.max}.`,
    );
  }
  return Object.freeze({ id, key, value, observedAt });
}

function activeStage(
  stages: readonly ConfidenceStage[],
  sampleCount: number,
): ConfidenceStage {
  let active = stages[0];
  if (!active) throw new Error("Evidence policy has no confidence stages.");
  for (const stage of stages) {
    if (stage.minSamples <= sampleCount) active = stage;
  }
  return active;
}

function compareEvidence(left: DirectEvidence, right: DirectEvidence): number {
  return (
    left.observedAt.localeCompare(right.observedAt) ||
    left.id.localeCompare(right.id)
  );
}

function clamp(
  value: number,
  range: EvidencePolicy["range"],
): number {
  return Math.min(range.max, Math.max(range.min, value));
}

function roundToPrecision(value: number, precision: number): number {
  const rounded = Number(value.toFixed(precision));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function requiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty.`);
  return normalized;
}

function requiredFiniteNumber(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
  return value;
}

function requiredPositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}
