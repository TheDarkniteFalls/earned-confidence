import assert from "node:assert/strict";
import { test } from "node:test";
import {
  POLICY_BAND_INTERPRETATION,
  commitDecisionSnapshot,
  createEvidenceLedger,
  defineEvidencePolicy,
  projectKnowledge,
  recordDirectEvidence,
  stableSerialize,
  type DecisionSnapshot,
  type DirectEvidence,
  type EvidenceLedger,
} from "../src/index.ts";

function standardPolicy() {
  return defineEvidencePolicy({
    id: "test-policy-v1",
    range: { min: 0, max: 100 },
    stages: [
      { kind: "estimated", label: "initial", minSamples: 1, radius: 10 },
      {
        kind: "estimated",
        label: "corroborated",
        minSamples: 2,
        radius: 5,
      },
      { kind: "confirmed", label: "confirmed", minSamples: 3 },
    ],
  });
}

function add(
  ledger: EvidenceLedger,
  evidence: DirectEvidence,
): EvidenceLedger {
  return recordDirectEvidence({
    ledger,
    policy: standardPolicy(),
    evidence,
  });
}

function knowledgeFor(snapshot: DecisionSnapshot, key: string) {
  const entry = snapshot.knowledge.find((candidate) => candidate.key === key);
  assert.ok(entry, `Missing snapshot key: ${key}`);
  return entry.knowledge;
}

test("unknown is distinct from a directly observed zero", () => {
  const policy = standardPolicy();
  const empty = createEvidenceLedger();
  assert.deepEqual(projectKnowledge({ key: "api", ledger: empty, policy }), {
    status: "unknown",
    sampleCount: 0,
    evidenceIds: [],
  });

  const withZero = recordDirectEvidence({
    ledger: empty,
    policy,
    evidence: {
      id: "api-zero",
      key: "api",
      value: 0,
      observedAt: "2026-07-22T09:00:00Z",
    },
  });
  assert.deepEqual(projectKnowledge({ key: "api", ledger: withZero, policy }), {
    status: "estimated",
    confidence: "initial",
    sampleCount: 1,
    center: 0,
    min: 0,
    max: 10,
    evidenceIds: ["api-zero"],
    interpretation: POLICY_BAND_INTERPRETATION,
  });
});

test("evidence remains isolated by exact key", () => {
  const policy = standardPolicy();
  const ledger = recordDirectEvidence({
    ledger: createEvidenceLedger(),
    policy,
    evidence: {
      id: "api-check-1",
      key: "api",
      value: 72,
      observedAt: "2026-07-22T09:00:00Z",
    },
  });

  assert.equal(
    projectKnowledge({ key: "api", ledger, policy }).status,
    "estimated",
  );
  assert.equal(
    projectKnowledge({ key: "worker", ledger, policy }).status,
    "unknown",
  );
});

test("band width comes from configuration and is explicitly non-statistical", () => {
  const ledger = add(createEvidenceLedger(), {
    id: "api-check-1",
    key: "api",
    value: 50,
    observedAt: "2026-07-22T09:00:00Z",
  });
  const narrow = projectKnowledge({
    key: "api",
    ledger,
    policy: standardPolicy(),
  });
  const widePolicy = defineEvidencePolicy({
    id: "wide-policy-v1",
    range: { min: 0, max: 100 },
    stages: [
      { kind: "estimated", label: "initial", minSamples: 1, radius: 20 },
    ],
  });
  const wide = projectKnowledge({ key: "api", ledger, policy: widePolicy });

  assert.equal(narrow.status, "estimated");
  assert.equal(wide.status, "estimated");
  if (narrow.status !== "estimated" || wide.status !== "estimated") {
    throw new Error("Expected estimated knowledge views.");
  }
  assert.deepEqual([narrow.min, narrow.max], [40, 60]);
  assert.deepEqual([wide.min, wide.max], [30, 70]);
  assert.equal(wide.interpretation, POLICY_BAND_INTERPRETATION);
});

test("projection rejects selected evidence outside the active policy range", () => {
  const ledger = add(createEvidenceLedger(), {
    id: "api-check-1",
    key: "api",
    value: 72,
    observedAt: "2026-07-22T09:00:00Z",
  });
  const narrowPolicy = defineEvidencePolicy({
    id: "narrow-policy-v1",
    range: { min: 0, max: 10 },
    stages: [
      { kind: "estimated", label: "initial", minSamples: 1, radius: 2 },
    ],
  });

  assert.throws(
    () => projectKnowledge({ key: "api", ledger, policy: narrowPolicy }),
    /Evidence api-check-1 value 72 is outside active policy range 0\.\.10\./,
  );
  assert.equal(
    projectKnowledge({ key: "worker", ledger, policy: narrowPolicy }).status,
    "unknown",
  );
});

test("later evidence cannot mutate a committed decision snapshot", () => {
  const policy = standardPolicy();
  let ledger = createEvidenceLedger();
  const before = commitDecisionSnapshot({
    decisionId: "release-review-001",
    committedAt: "2026-07-22T08:00:00Z",
    keys: ["worker", "api"],
    ledger,
    policy,
  });

  ledger = add(ledger, {
    id: "api-check-1",
    key: "api",
    value: 72,
    observedAt: "2026-07-22T09:00:00Z",
  });
  ledger = add(ledger, {
    id: "api-check-2",
    key: "api",
    value: 76,
    observedAt: "2026-07-22T10:00:00Z",
  });
  ledger = add(ledger, {
    id: "api-check-3",
    key: "api",
    value: 74,
    observedAt: "2026-07-22T11:00:00Z",
  });
  const after = commitDecisionSnapshot({
    decisionId: "release-review-002",
    committedAt: "2026-07-22T12:00:00Z",
    keys: ["api", "worker"],
    ledger,
    policy,
  });

  assert.equal(knowledgeFor(before, "api").status, "unknown");
  assert.deepEqual(knowledgeFor(after, "api"), {
    status: "confirmed",
    confidence: "confirmed",
    sampleCount: 3,
    value: 74,
    evidenceIds: ["api-check-1", "api-check-2", "api-check-3"],
    interpretation: "policy-confirmed aggregate; not objective ground truth",
  });
  assert.equal(knowledgeFor(after, "worker").status, "unknown");
  assert.equal(Object.isFrozen(before), true);
  assert.equal(Object.isFrozen(before.knowledge), true);
  assert.equal(Reflect.set(knowledgeFor(before, "api"), "status", "changed"), false);
  assert.equal(knowledgeFor(before, "api").status, "unknown");
});

test("canonical serialization is independent of evidence and key insertion order", () => {
  const samples: readonly DirectEvidence[] = [
    {
      id: "api-check-2",
      key: "api",
      value: 76,
      observedAt: "2026-07-22T10:00:00Z",
    },
    {
      id: "worker-check-1",
      key: "worker",
      value: 61,
      observedAt: "2026-07-22T09:30:00Z",
    },
    {
      id: "api-check-1",
      key: "api",
      value: 72,
      observedAt: "2026-07-22T09:00:00Z",
    },
  ];
  let first = createEvidenceLedger();
  for (const sample of samples) first = add(first, sample);
  let second = createEvidenceLedger();
  for (const sample of [...samples].reverse()) second = add(second, sample);

  assert.equal(stableSerialize(first), stableSerialize(second));
  const firstSnapshot = commitDecisionSnapshot({
    decisionId: "same-decision",
    committedAt: "2026-07-22T12:00:00Z",
    keys: ["worker", "api"],
    ledger: first,
    policy: standardPolicy(),
  });
  const secondSnapshot = commitDecisionSnapshot({
    decisionId: "same-decision",
    committedAt: "2026-07-22T12:00:00Z",
    keys: ["api", "worker"],
    ledger: second,
    policy: standardPolicy(),
  });
  assert.equal(stableSerialize(firstSnapshot), stableSerialize(secondSnapshot));
});

test("duplicate evidence ids and invalid policies fail closed", () => {
  const first = add(createEvidenceLedger(), {
    id: "duplicate",
    key: "api",
    value: 72,
    observedAt: "2026-07-22T09:00:00Z",
  });
  assert.throws(
    () =>
      add(first, {
        id: "duplicate",
        key: "worker",
        value: 61,
        observedAt: "2026-07-22T10:00:00Z",
      }),
    /already exists/,
  );
  assert.throws(
    () =>
      defineEvidencePolicy({
        id: "invalid",
        range: { min: 0, max: 100 },
        stages: [
          { kind: "estimated", label: "late", minSamples: 2, radius: 5 },
        ],
      }),
    /begin at one sample/,
  );
});
