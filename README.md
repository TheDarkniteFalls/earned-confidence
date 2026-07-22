# Earned Confidence

> Unknown is a state, not zero.

Earned Confidence is a small TypeScript reference implementation for systems
that must make decisions with incomplete information. Evidence is scoped to an
exact key, configurable bands are explicitly policy-defined rather than
statistical, and a committed decision preserves what was known at that moment.

It is designed for release reviews, simulations, agent memory, risk tools, and
other systems where later evidence must not rewrite earlier decisions.

## What it guarantees

- **Unknown stays unknown.** A missing observation is not converted to `0`.
- **Evidence stays scoped.** An API check cannot change the worker's status.
- **Bands are honest.** They are policy-defined ranges, explicitly not
  statistical confidence intervals.
- **Snapshots do not backfill.** Later evidence can inform a later decision but
  cannot mutate a committed one.
- **Receipts are reproducible.** Ledger and snapshot serialization is canonical
  regardless of insertion order.

## 60-second use

Requirements: Node.js 22.6 or later and npm.

```bash
npm ci
npm run check
```

`npm run check` type-checks the library, runs the Node test suite, and executes
the synthetic deployment-readiness example.

## Example policy

```ts
import {
  createEvidenceLedger,
  defineEvidencePolicy,
  projectKnowledge,
  recordDirectEvidence,
} from "./src/index.ts";

const policy = defineEvidencePolicy({
  id: "deployment-readiness-v1",
  range: { min: 0, max: 100 },
  stages: [
    { kind: "estimated", label: "initial", minSamples: 1, radius: 12 },
    { kind: "estimated", label: "corroborated", minSamples: 2, radius: 6 },
    { kind: "confirmed", label: "confirmed", minSamples: 3 },
  ],
});

let ledger = createEvidenceLedger();
ledger = recordDirectEvidence({
  ledger,
  policy,
  evidence: {
    id: "api-check-1",
    key: "api",
    value: 72,
    observedAt: "2026-07-22T09:00:00Z",
  },
});

projectKnowledge({ key: "api", ledger, policy });
// estimated: 60–84, initial, one direct observation

projectKnowledge({ key: "worker", ledger, policy });
// unknown: evidence for api does not cross keys
```

See [`examples/deployment-readiness.ts`](examples/deployment-readiness.ts) for
the complete flow, including two immutable decision snapshots.

## Deliberate boundaries

This package is a deterministic policy pattern, not a statistical library,
prediction model, recommendation engine, or claim of ground truth. A
`confirmed` value means only that the configured evidence threshold was met.
Callers remain responsible for deciding what qualifies as direct evidence and
whether a policy is appropriate for their domain.

The package has no runtime dependencies, network calls, storage backend, UI, or
hidden scoring model.

## License and safety

MIT licensed. See [`PUBLIC_SAFETY.md`](PUBLIC_SAFETY.md) for the public-content,
dependency, data, and validation receipt.
