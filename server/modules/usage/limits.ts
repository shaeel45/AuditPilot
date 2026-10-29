import { LIMITS, planOf, isUnlimited } from "../../config/plans";
import type { UserDocument } from "../../models/User";

/**
 * Plan-limit gate (refactored out of routes.ts, same semantics as before).
 * This is the LEGACY check living on the User document; the atomic usage
 * service with monthly windows and refunds replaces it in a later commit.
 */
type LimitedAction = "audits" | "pullRequests";

const PLAN_LIMITS = LIMITS as Record<string, Record<LimitedAction, number>>;

export function planLimitError(
  user: UserDocument,
  action: LimitedAction,
): { message: string; details: string } | null {
  const plan = planOf(user.plan);
  const limit = PLAN_LIMITS[plan][action];

  if (isUnlimited(limit)) return null;

  const used = action === "audits" ? user.auditsUsed : user.pullRequestsUsed;
  if (used >= limit) {
    return {
      message: `${plan.charAt(0).toUpperCase() + plan.slice(1)} ${action === "audits" ? "limit" : "PR limit"} reached.`,
      details: `You have used all ${limit} ${action === "audits" ? "audits included in your plan. Upgrade for more scans." : "PR actions included in your plan. Upgrade for more reviews."}`,
    };
  }
  return null;
}
