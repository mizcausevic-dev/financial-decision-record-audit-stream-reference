// verifier.mjs — Validates the produced stream against the 2 FinTech invariants.
//
// Two orthogonal invariants on every event:
//   #1: FCRA §604 permissible-purpose — any credit-bureau pull (action === "pull-credit-report")
//       MUST cite a valid FCRA §604 permissible purpose
//   #2: human-credit-officer — any adverse-action-capable kind producing an adverse recommendation
//       MUST carry agent.human_credit_officer_id_tokenized

import { canonicalize, sha256, ZERO_HASH } from "./event-builder.mjs";

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

const ADVERSE_ACTION_CAPABLE_KINDS = new Set([
  "fintech.credit.application-decision-recommended",
  "fintech.credit.line-reduced-recommended",
  "fintech.credit.account-closed-recommended",
  "fintech.deposit.account-restricted-recommended"
]);

const ADVERSE_RECOMMENDATIONS = new Set(["decline", "approve-with-conditions", "counter-offer", "freeze", "reduce-line", "close"]);

export function verify(events) {
  const errors = [];

  // Chain integrity
  let expectedPrev = ZERO_HASH;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.prev_hash !== expectedPrev) errors.push(`chain: event[${i}] (${e.event_id}) prev_hash mismatch`);
    const { hash: _h, ...body } = e;
    if (e.hash !== sha256(canonicalize(body))) errors.push(`chain: event[${i}] (${e.event_id}) hash mismatch`);
    expectedPrev = e.hash;
  }

  // Invariant #1: FCRA §604 permissible-purpose on every credit-bureau pull
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.action === "pull-credit-report") {
      const p = e.agent?.fcra_permissible_purpose;
      if (!p) {
        errors.push(`invariant#1: event[${i}] (${e.event_id}) credit-bureau pull missing agent.fcra_permissible_purpose (FCRA §604)`);
      } else if (!FCRA_PERMISSIBLE_PURPOSES.has(p)) {
        errors.push(`invariant#1: event[${i}] (${e.event_id}) fcra_permissible_purpose "${p}" not in FCRA §604 enumerated purposes`);
      }
    }
  }

  // Invariant #2: human-credit-officer on adverse-action-capable events
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (ADVERSE_ACTION_CAPABLE_KINDS.has(e.kind) && ADVERSE_RECOMMENDATIONS.has(e.outcome?.recommendation)) {
      if (!e.agent?.human_credit_officer_id_tokenized) {
        errors.push(`invariant#2: event[${i}] (${e.event_id}) adverse-action-capable kind "${e.kind}" with recommendation "${e.outcome.recommendation}" requires agent.human_credit_officer_id_tokenized (ECOA Reg B + FCRA §615)`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
