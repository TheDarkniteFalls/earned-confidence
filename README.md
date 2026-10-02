# Earned Confidence

Keep missing evidence visible and preserve what you knew when you made a
decision. Earned Confidence is a small TypeScript reference implementation for
recording observations, applying a policy you choose, and saving an immutable
decision snapshot—a record that later observations cannot change.

Try the synthetic deployment example below. An API check changes the API’s
estimate while the worker stays unknown. A later decision can use new evidence;
the earlier decision keeps the information it originally had.

The same pattern is intended for release reviews, simulations, agent memory,
and risk tools. Its ranges are rules you configure, not statistical confidence
intervals or evidence that those applications are safe to use.

<a id="60-second-use"></a>

## Try the example

Requirements: Node.js 22.6 or later and npm.

```bash
npm ci
npm run check
```

`npm run check` type-checks the library, runs the Node test suite, and executes
the synthetic deployment-readiness example. Read the printed sequence:

1. The original decision keeps both `api` and `worker` unknown.
2. One API observation produces the policy-defined range `60–84`.
3. Three API observations meet this policy’s `confirmed` threshold; the worker
   still has no observations and stays unknown.

Here, `confirmed` means the configured threshold was met. It does not mean the
observation is authenticated or that a deployment is approved.

<!-- toolkit-trust-card:placement -->

<!-- toolkit-trust-card:start -->
> **Public contract:** Experimental pattern · about 5 min · Node.js 22.6+ · no model · no network
>
> **Operation:** Read-only check; examples may use temporary files
>
> **A pass establishes:** Type checking, behavioral tests, and the synthetic example preserve unknown state, evidence-key isolation, policy-defined bands, immutable snapshots, and deterministic serialization.
>
> **It does not establish:** Observations are not authenticated, bands are not statistical, and the package supplies no persistence or authorization.
>
> **First check:** `npm run check`
<!-- toolkit-trust-card:end -->

## What it guarantees

- **Unknown stays unknown.** A missing observation is not converted to `0`.
- **Evidence stays scoped.** An API check cannot change the worker's status.
- **Bands follow your policy.** They are policy-defined ranges, explicitly not
  statistical confidence intervals.
- **Earlier snapshots stay unchanged.** Later evidence can inform a later decision but
  cannot mutate a committed one.
- **Serialized records are reproducible.** Converting the ledger and snapshots
  to text gives the same canonical result regardless of insertion order.

## Example policy

This policy chooses how many observations each stage needs and how wide an
estimated range should be. Each observation belongs to one exact key, such as
`api`; it cannot supply evidence for a different key such as `worker`.

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

<a id="deliberate-boundaries"></a>

## What this example shows

The example shows how a fixed policy handles supplied observations and keeps
old decisions intact. The package is a deterministic policy pattern, not a
statistical library, prediction model, recommendation engine, or claim of
ground truth. A
`confirmed` value means only that the configured evidence threshold was met.
Callers remain responsible for deciding what qualifies as direct evidence and
whether a policy is appropriate for their domain. The package does not
authenticate observations, persist records, or authorize actions.

The package has no runtime dependencies, network calls, storage backend, UI, or
hidden scoring model.

## License and safety

MIT licensed. See [`PUBLIC_SAFETY.md`](PUBLIC_SAFETY.md) for the public-content,
dependency, data, and validation receipt dated 22 July 2026. That receipt
describes the checks at the time; it is not a current dependency audit.
