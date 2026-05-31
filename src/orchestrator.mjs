// orchestrator.mjs — Meridian Financial × VendorF CreditMind v4.x trajectory.
//
// 4-step credit decisioning flow:
//   1. Receive credit application (no credit-bureau pull yet)
//   2. Pull credit report from bureau (FCRA §604(a)(3)(A) purpose required)
//   3. AI scores the application (informational, no adverse action yet)
//   4. Final credit decision recommended (adverse-action-capable, human required)

import { requestCreditAccess } from "./credit-vault.mjs";
import { Chain } from "./event-builder.mjs";

const AGENT_BASE = {
  ai_tool_card_url:     "https://vendorf-creditmind.example/.well-known/ai-tool-cards/creditmind-4.x.json",
  ai_decision_card_url: "https://meridian-financial.example/.well-known/decisions/MERIDIAN-DEC-2026-FIN-0033.json"
};
const DECISION_CARD = AGENT_BASE.ai_decision_card_url;

const STEPS = [
  // 1. Credit application received — no bureau pull, no decision yet
  {
    event_id: "0190ft-r-0001", timestamp: "2026-11-15T09:00:00Z",
    kind: "fintech.credit.application-received",
    source: "meridian-app-intake-prod",
    subject_ref: { scheme: "applicant-id-tokenized", value: "tok_app_meridian_001" },
    resource: { type: "credit-application", id_tokenized: "tok_res_creditapp_001", product_line: "personal-installment-loan" },
    action: "stamp",
    outcome: { status: "received", recommendation: null },
    agent: { ...AGENT_BASE, human_credit_officer_id_tokenized: null },
    regulatory_basis: ["ecoa-reg-b-12-cfr-1002", "gramm-leach-bliley-safeguards"],
    decision_card_ref: DECISION_CARD
  },
  // 2. Credit bureau pull — FCRA §604(a)(3)(A) "credit transaction initiated by consumer"
  {
    event_id: "0190ft-r-0002", timestamp: "2026-11-15T09:00:15Z",
    kind: "fintech.credit.bureau-report-pulled",
    source: "meridian-bureau-pull-prod",
    subject_ref: { scheme: "applicant-id-tokenized", value: "tok_app_meridian_001" },
    resource: { type: "credit-bureau-report", id_tokenized: "tok_res_bureau_002", bureau: "transunion" },
    action: "pull-credit-report",
    outcome: { status: "success" },
    agent: { ...AGENT_BASE, fcra_permissible_purpose: "604(a)(3)(A)-credit-transaction-initiated-by-consumer", human_credit_officer_id_tokenized: null },
    regulatory_basis: ["fcra-15-usc-1681b-section-604", "ecoa-reg-b-12-cfr-1002"],
    decision_card_ref: DECISION_CARD
  },
  // 3. AI scoring — informational, no adverse action
  {
    event_id: "0190ft-r-0003", timestamp: "2026-11-15T09:00:30Z",
    kind: "fintech.credit.ai-score-produced",
    source: "meridian-ai-scoring-prod",
    subject_ref: { scheme: "applicant-id-tokenized", value: "tok_app_meridian_001" },
    resource: { type: "ai-credit-score", id_tokenized: "tok_res_score_003", model_version: "v4.x" },
    action: "score",
    outcome: { status: "success", recommendation: "advisory-only" },
    agent: { ...AGENT_BASE, human_credit_officer_id_tokenized: null },
    regulatory_basis: ["fcra-15-usc-1681b-section-604", "ecoa-reg-b-12-cfr-1002", "cfpb-circular-2023-03-adverse-action-with-ai"],
    decision_card_ref: DECISION_CARD
  },
  // 4. Credit decision recommended — ADVERSE-ACTION-CAPABLE, requires human credit officer
  {
    event_id: "0190ft-r-0004", timestamp: "2026-11-15T09:15:00Z",
    kind: "fintech.credit.application-decision-recommended",
    source: "meridian-decision-engine-prod",
    subject_ref: { scheme: "applicant-id-tokenized", value: "tok_app_meridian_001" },
    resource: { type: "credit-application", id_tokenized: "tok_res_creditapp_001", product_line: "personal-installment-loan" },
    action: "recommend",
    outcome: { status: "success", recommendation: "approve-with-conditions" },
    agent: { ...AGENT_BASE, human_credit_officer_id_tokenized: "tok_off_meridian_credit_22", fcra_permissible_purpose: "604(a)(3)(A)-credit-transaction-initiated-by-consumer" },
    regulatory_basis: ["ecoa-reg-b-12-cfr-1002-section-9-adverse-action-notice", "fcra-15-usc-1681m-section-615-adverse-action"],
    decision_card_ref: DECISION_CARD
  }
];

export function orchestrate({ skipVaultCheck = false } = {}) {
  const chain = new Chain();
  const events = [];
  const denials = [];
  for (const step of STEPS) {
    if (!skipVaultCheck) {
      const check = requestCreditAccess({
        kind: step.kind,
        action: step.action,
        fcra_permissible_purpose: step.agent?.fcra_permissible_purpose,
        human_credit_officer_id_tokenized: step.agent?.human_credit_officer_id_tokenized,
        outcome_recommendation: step.outcome?.recommendation
      });
      if (!check.allowed) { denials.push({ event_id: step.event_id, reason: check.reason }); continue; }
    }
    events.push(chain.build(step));
  }
  return { events, denials };
}
