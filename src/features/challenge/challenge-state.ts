import type { Challenge } from "@/shared/contracts";

export type ChallengePhase = "inactive" | "upcoming" | "active" | "ended";

function dateInTimeZone(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getChallengePhase(
  challenge: Challenge,
  now: Date = new Date(),
): ChallengePhase {
  if (challenge.status === "draft") return "inactive";
  if (challenge.status === "ended") return "ended";

  const today = dateInTimeZone(now, challenge.timeZone);
  if (today < challenge.startDate) return "upcoming";
  if (today > challenge.endDate) return "ended";
  return "active";
}
