// credit-vault.mjs — Mock credit decisioning vault with FCRA §604 permissible-purpose gate.
//
// FCRA §604 (15 USC §1681b) — "A consumer reporting agency may furnish a consumer
// report under the following circumstances and no other..." — lists ~7 statutory
// permissible purposes. Every credit bureau pull MUST cite one.
//
// In production this would route to TransUnion/Equifax/Experian APIs with
// the cited purpose embedded in the request header. The bureaus log purpose
// per pull and audit downstream usage.

// FCRA §604 permissible purposes (most common operational subset)
const FCRA_PERMISSIBLE_PURPOSES = new Set([
  "604(a)(1)-court-order-or-subpoena",
  "604(a)(2)-consumer-written-instructions",
  "604(a)(3)(A)-credit-transaction-initiated-by-consumer",
  "604(a)(3)(B)-employment-purposes-with-disclosure-and-consent",
  "604(a)(3)(C)-insurance-underwriting",
  "604(a)(3)(D)-license-determination",
  "604(a)(3)(E)-legitimate-business-need-account-review",
  "604(a)(3)(F)-legitimate-business-need-transaction-initiated"
]);

// Adverse-action-capable kinds — these are the actions that, if taken without
// a human credit officer, could constitute a Reg B / ECOA / FCRA §615
// adverse-action notification violation.
const ADVERSE_ACTION_CAPABLE_KINDS = new Set([
  "fintech.credit.application-decision-recommended",
  "fintech.credit.line-reduced-recommended",
  "fintech.credit.account-closed-recommended",
  "fintech.deposit.account-restricted-recommended"
]);

/**
 * Returns { allowed, reason, requires_human_credit_officer }.
 * Two checks:
 *   1. If the event pulls a credit report (action === "pull-credit-report"),
 *      it MUST carry a valid FCRA permissible-purpose citation.
 *   2. If the event is adverse-action-capable, it MUST have human_credit_officer_id_tokenized.
 */
export function requestCreditAccess({ kind, action, fcra_permissible_purpose, human_credit_officer_id_tokenized, outcome_recommendation }) {
  if (action === "pull-credit-report") {
    if (!fcra_permissible_purpose) {
      return { allowed: false, reason: "Credit-bureau pull requires fcra_permissible_purpose citation per FCRA §604" };
    }
    if (!FCRA_PERMISSIBLE_PURPOSES.has(fcra_permissible_purpose)) {
      return { allowed: false, reason: `fcra_permissible_purpose "${fcra_permissible_purpose}" is not a recognized FCRA §604 purpose` };
    }
  }
  if (ADVERSE_ACTION_CAPABLE_KINDS.has(kind)) {
    const adverseRecommendations = new Set(["decline", "approve-with-conditions", "counter-offer", "freeze", "reduce-line", "close"]);
    if (adverseRecommendations.has(outcome_recommendation) && !human_credit_officer_id_tokenized) {
      return { allowed: false, reason: `Adverse-action-capable kind "${kind}" with recommendation "${outcome_recommendation}" requires human_credit_officer_id_tokenized (ECOA Reg B 12 CFR §1002.9 + FCRA §615 adverse-action notice requires identifiable human credit officer)` };
    }
  }
  return { allowed: true, reason: null };
}

export { FCRA_PERMISSIBLE_PURPOSES, ADVERSE_ACTION_CAPABLE_KINDS };
