# financial-decision-record-audit-stream-reference

> **AGPL-3.0 reference implementation of [`financial-decision-record-audit-stream`](https://github.com/mizcausevic-dev/financial-decision-record-audit-stream).** Runs the Meridian Financial × VendorF CreditMind v4.x credit-decisioning trajectory end-to-end. Proves the FinTech audit-stream design works: **2 orthogonal invariants** enforced at vault-request-time AND independently at verifier-time — FCRA §604 permissible-purpose on every credit-bureau pull + human-credit-officer on every adverse-action-capable recommendation.

Part of the [Kinetic Gain Protocol Suite](https://suite.kineticgain.com).

Sibling to [`fhir-resource-access-audit-reference`](https://github.com/mizcausevic-dev/fhir-resource-access-audit-reference) (HealthTech), [`matter-decision-record-audit-stream-reference`](https://github.com/mizcausevic-dev/matter-decision-record-audit-stream-reference) (LegalTech), [`grid-decision-record-audit-stream-reference`](https://github.com/mizcausevic-dev/grid-decision-record-audit-stream-reference) (EnergyTech), [`defense-decision-record-audit-stream-reference`](https://github.com/mizcausevic-dev/defense-decision-record-audit-stream-reference) (DefenseTech), and [`government-decision-record-audit-stream-reference`](https://github.com/mizcausevic-dev/government-decision-record-audit-stream-reference) (GovTech).

## What this proves

The FinTech spec ships with two invariants that interlock differently from any other vertical:

1. **FCRA §604 permissible-purpose on every credit-bureau pull** — every event with `action: "pull-credit-report"` MUST carry `agent.fcra_permissible_purpose` set to one of the 8 enumerated FCRA §604 purposes. The credit bureaus (TransUnion / Equifax / Experian) require this on every API request; failures are §604(a) violations under 15 USC §1681b. This is the **strongest per-event regulatory citation in the Suite** — no other vertical requires a specific statutory section to be named on the request.
2. **human-credit-officer on adverse-action-capable kinds** — every event whose kind is in the adverse-action-capable set AND whose `outcome.recommendation` is adverse (decline, approve-with-conditions, counter-offer, freeze, reduce-line, close) MUST carry `agent.human_credit_officer_id_tokenized`. Maps to ECOA Reg B 12 CFR §1002.9 (30-day adverse-action notice) + FCRA §615 (15 USC §1681m) which both require an identifiable human credit officer accountable for the decision. CFPB Circular 2023-03 specifically reaffirmed this requirement for AI-driven adverse actions.

## Architecture

```
orchestrator.mjs (4 steps)
   │
   ├─ requests access via credit-vault.mjs (enforces both invariants)
   │
   ├─ builds hash-chained event via event-builder.mjs (canonical-JSON SHA-256)
   │
   └─ emits to examples/meridian-creditmind-reference-stream.ndjson

verifier.mjs (independent, post-hoc)
   │
   ├─ chain integrity (each prev_hash = prior hash)
   ├─ invariant #1: FCRA §604 permissible-purpose on credit-bureau pulls
   └─ invariant #2: human-credit-officer on adverse-action-capable recommendations
```

## Run it

```bash
git clone https://github.com/mizcausevic-dev/financial-decision-record-audit-stream-reference
cd financial-decision-record-audit-stream-reference
npm install
npm start    # 4-step trajectory + verifier
npm test     # 9 unit tests including vault-denial + verifier-trip cases
```

Expected output:
```
Built 4 events → examples/meridian-creditmind-reference-stream.ndjson
OK · 4 events · chain ✓ · 2 invariants ✓ (FCRA §604 permissible-purpose + human-credit-officer)
```

## Canonical trajectory — Meridian Financial × VendorF CreditMind v4.x

| Step | Event | Invariant exercised |
| --- | --- | --- |
| 1 | Credit application received | (none — informational) |
| 2 | Credit-bureau report pulled | **#1 — cites FCRA §604(a)(3)(A) "credit transaction initiated by consumer"** |
| 3 | AI score produced (advisory-only) | (none — informational, not adverse-action-capable) |
| 4 | Application decision recommended (approve-with-conditions) | **#2 — adverse-recommendation requires human credit officer ID** |

Even step 4's `approve-with-conditions` triggers the human-officer rule because conditional approvals carry adverse-action notification obligations under Reg B (counter-offer terms must be disclosed with reasons).

## FCRA §604 permissible-purpose enumeration

The vault + verifier recognize 8 statutory purposes:

| Purpose | Common operational use |
| --- | --- |
| `604(a)(1)-court-order-or-subpoena` | Litigation discovery |
| `604(a)(2)-consumer-written-instructions` | Customer-authorized inquiries (e.g. mortgage prequalification) |
| `604(a)(3)(A)-credit-transaction-initiated-by-consumer` | **Most common** — applicant applied for credit |
| `604(a)(3)(B)-employment-purposes-with-disclosure-and-consent` | Background checks (separate FCRA workflow) |
| `604(a)(3)(C)-insurance-underwriting` | Insurance applications |
| `604(a)(3)(D)-license-determination` | Government licensing |
| `604(a)(3)(E)-legitimate-business-need-account-review` | Existing-customer account reviews |
| `604(a)(3)(F)-legitimate-business-need-transaction-initiated` | Existing-customer new-transaction requests |

The verifier rejects any purpose string outside this set.

## Vault denial scenarios (covered by tests)

| Failure mode | Reason |
| --- | --- |
| Bureau pull without FCRA permissible purpose | "Credit-bureau pull requires fcra_permissible_purpose citation per FCRA §604" |
| Bureau pull with unrecognized purpose | `"i-just-want-the-credit-report"` → rejected as not in the §604 enumeration |
| Adverse credit decision without human credit officer | "Adverse-action-capable kind X with recommendation Y requires human_credit_officer_id_tokenized" |
| Non-adverse decision (clean approve) without human officer | Permitted — clean approvals don't trigger adverse-action notice obligations |

## Composes with

- [`financial-decision-record-audit-stream`](https://github.com/mizcausevic-dev/financial-decision-record-audit-stream) — the spec this implements
- [`cfpb-readiness-evidence-bundle`](https://github.com/mizcausevic-dev/cfpb-readiness-evidence-bundle) — evidence bundle that ingests events produced here
- [`financial-ai-incident-card-profile`](https://github.com/mizcausevic-dev/financial-ai-incident-card-profile) — any invariant failure becomes a published Incident Card
- [`state-financial-ai-disclosure-tracker`](https://github.com/mizcausevic-dev/state-financial-ai-disclosure-tracker) — regulatory-lifecycle context (NY Part 500, CA CCFPL, CO SB 24-205, etc.)
- [`financial-customer-data-vault-contract-profile`](https://github.com/mizcausevic-dev/financial-customer-data-vault-contract-profile) — vault contract for the 17 financial data categories
- [Kinetic Gain Protocol Suite](https://suite.kineticgain.com) — umbrella

## Compliance posture

Reference implementation **readiness scaffolding** for CFPB + OCC 2011-12 + FRB SR 11-7 + ECOA Reg B + FCRA Reg V + GLBA Safeguards + BSA/AML + Section 1071 + Section 1033 + CFPB UDAAP. Does NOT constitute CFPB examination approval, OCC fair-lending compliance, or model-risk-management attestation. The mock credit vault is in-memory — production deployments must route real bureau pulls through TransUnion/Equifax/Experian APIs with the cited purpose in the request header, log per-pull audit trails meeting ECOA's 25-month recordkeeping requirement, and integrate with the lender's identified credit-officer workforce. Per the standing Suite public-language guardrail: *readiness · evidence · posture · controls · scaffolding* — never "compliant" / "certified" without external attestation.

## License

AGPL-3.0-only. Spec repos this depends on remain MIT.
