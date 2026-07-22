import {
  commitDecisionSnapshot,
  createEvidenceLedger,
  defineEvidencePolicy,
  projectKnowledge,
  recordDirectEvidence,
  stableSerialize,
  type KnowledgeView,
} from "../src/index.ts";

const policy = defineEvidencePolicy({
  id: "deployment-readiness-v1",
  range: { min: 0, max: 100 },
  stages: [
    { kind: "estimated", label: "initial", minSamples: 1, radius: 12 },
    {
      kind: "estimated",
      label: "corroborated",
      minSamples: 2,
      radius: 6,
    },
    { kind: "confirmed", label: "confirmed", minSamples: 3 },
  ],
});

let ledger = createEvidenceLedger();
const originalDecision = commitDecisionSnapshot({
  decisionId: "release-review-001",
  committedAt: "2026-07-22T08:00:00Z",
  keys: ["api", "worker"],
  ledger,
  policy,
});

ledger = addApiEvidence(ledger, "api-check-1", 72, "2026-07-22T09:00:00Z");
const afterOneCheck = projectKnowledge({ key: "api", ledger, policy });
ledger = addApiEvidence(ledger, "api-check-2", 76, "2026-07-22T10:00:00Z");
ledger = addApiEvidence(ledger, "api-check-3", 74, "2026-07-22T11:00:00Z");

const nextDecision = commitDecisionSnapshot({
  decisionId: "release-review-002",
  committedAt: "2026-07-22T12:00:00Z",
  keys: ["api", "worker"],
  ledger,
  policy,
});

console.log("Original committed decision");
for (const entry of originalDecision.knowledge) {
  console.log(`- ${entry.key}: ${describe(entry.knowledge)}`);
}
console.log("\nAfter one direct API check");
console.log(`- api: ${describe(afterOneCheck)}`);
console.log(
  `- worker: ${describe(projectKnowledge({ key: "worker", ledger, policy }))}`,
);
console.log("\nNext committed decision");
for (const entry of nextDecision.knowledge) {
  console.log(`- ${entry.key}: ${describe(entry.knowledge)}`);
}
console.log("\nCanonical ledger");
console.log(stableSerialize(ledger));

function addApiEvidence(
  current: ReturnType<typeof createEvidenceLedger>,
  id: string,
  value: number,
  observedAt: string,
) {
  return recordDirectEvidence({
    ledger: current,
    policy,
    evidence: { id, key: "api", value, observedAt },
  });
}

function describe(knowledge: KnowledgeView): string {
  if (knowledge.status === "unknown") return "unknown";
  if (knowledge.status === "confirmed") {
    return `${knowledge.value} (${knowledge.confidence}; ${knowledge.sampleCount} direct checks)`;
  }
  return `${knowledge.min}–${knowledge.max} (${knowledge.confidence}; ${knowledge.sampleCount} direct checks; non-statistical band)`;
}
