export const REASONING_EFFORTS = ["auto", "low", "medium", "high"] as const;

export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return (
    typeof value === "string" &&
    REASONING_EFFORTS.includes(value as ReasoningEffort)
  );
}
