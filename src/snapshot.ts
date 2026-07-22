import { projectKnowledge } from "./policy.ts";
import type {
  DecisionSnapshot,
  EvidenceLedger,
  EvidencePolicy,
} from "./types.ts";

export function commitDecisionSnapshot(input: {
  readonly decisionId: string;
  readonly committedAt: string;
  readonly keys: readonly string[];
  readonly ledger: EvidenceLedger;
  readonly policy: EvidencePolicy;
}): DecisionSnapshot {
  const decisionId = requiredText(input.decisionId, "Decision id");
  const committedAt = requiredText(input.committedAt, "Commit timestamp");
  const keys = [...new Set(input.keys.map((key) => requiredText(key, "Key")))]
    .toSorted((left, right) => left.localeCompare(right));
  if (keys.length === 0) {
    throw new Error("A decision snapshot must include at least one key.");
  }

  const knowledge = Object.freeze(
    keys.map((key) =>
      Object.freeze({
        key,
        knowledge: projectKnowledge({
          key,
          ledger: input.ledger,
          policy: input.policy,
        }),
      }),
    ),
  );

  return Object.freeze({
    schemaVersion: 1,
    decisionId,
    committedAt,
    policyId: input.policy.id,
    knowledge,
  });
}

export function stableSerialize(
  value: EvidenceLedger | DecisionSnapshot,
): string {
  return JSON.stringify(canonicalize(value, new WeakSet<object>()));
}

type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

function canonicalize(value: unknown, seen: WeakSet<object>): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Stable serialization rejects non-finite numbers.");
    }
    return value;
  }
  if (typeof value !== "object") {
    throw new Error(`Stable serialization rejects ${typeof value} values.`);
  }
  if (seen.has(value)) {
    throw new Error("Stable serialization rejects cyclic values.");
  }
  seen.add(value);

  if (Array.isArray(value)) {
    const result = value.map((entry) => canonicalize(entry, seen));
    seen.delete(value);
    return result;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error("Stable serialization accepts plain data objects only.");
  }
  const source = value as Record<string, unknown>;
  const result: Record<string, JsonValue> = {};
  for (const key of Object.keys(source).toSorted()) {
    const child = source[key];
    if (child === undefined) {
      throw new Error(`Stable serialization rejects undefined at ${key}.`);
    }
    result[key] = canonicalize(child, seen);
  }
  seen.delete(value);
  return result;
}

function requiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty.`);
  return normalized;
}
