# Public-safety receipt

Status: validated local public candidate on 2026-07-22.

## Public-content boundary

This repository was created from an empty directory as a fresh generic
reference implementation. Its allowlist is limited to:

- the evidence policy, immutable snapshot, and canonical serialization source;
- one synthetic software-deployment example;
- focused tests, package configuration, CI configuration, and public docs;
- the standard MIT license.

No source, formula, schema, fixture, UI, content, documentation, history, save,
log, transcript, credential, personal data, connector export, or machine path
was copied from a private project.

## Data and behavior

- All names, ids, values, and timestamps are synthetic.
- The package has no runtime dependencies.
- The implementation makes no network, filesystem, model, telemetry, or
  persistence calls.
- Confidence bands are labeled in code and docs as policy-defined, not
  statistical intervals.
- `confirmed` means a configured evidence threshold was met; it does not claim
  objective truth.

## Validation

- `npm ci --offline --ignore-scripts` installed the three pinned development
  packages from a local package cache. The install reported 4 packages audited
  and 0 vulnerabilities.
- `npm run check` passed strict TypeScript checking, all 7 behavioral tests,
  and the synthetic deployment example.
- `npm audit --offline --ignore-scripts` reported 0 vulnerabilities. A live
  registry audit was attempted but the managed environment could not resolve
  the npm registry, so this is explicitly an offline result rather than a
  current registry claim.
- The publication-lane safety gate reported no obvious findings and no
  symlinks.
- A focused content scan found none of the known excluded project terms, the
  owner's personal name, or absolute machine paths. A whitespace scan also
  passed.
- The dependency tree contains no runtime packages. Development tooling is
  limited to TypeScript (Apache-2.0), Node.js type declarations (MIT), and their
  type-only `undici-types` dependency (MIT), all pinned in `package-lock.json`.
- The candidate contains 15 public-content files, excluding `.git` and
  `node_modules`.

## Publication boundary

This receipt is evidence, not permission to publish. At validation time the
repository had no commits, staged files, or remotes. Any staging, commit, push,
hosting, upload, release, or publication requires separate authorization.
