# Changelog

## 1.0.0-prod — 2026-05-31

- Hardened to v1.0-prod per squad doctrine; member of the FinTech vertical 6-pack.
- Spec-component repo (no Pages deploy required); AGPL-3.0-or-later, synthetic example data only.
- Pulse universe entry not applicable (no custom subdomain).



## [0.1] — 2026-05-31

### Added

- Initial AGPL-3.0 reference implementation.
- **`credit-vault.mjs`** — In-memory mock credit decisioning vault with FCRA §604 permissible-purpose gate (8 enumerated purposes) + adverse-action-capable kind enforcement.
- **`event-builder.mjs`** — Canonical-JSON SHA-256 hash-chained `Chain` class (same shape as sibling reference impls).
- **`orchestrator.mjs`** — 4-step Meridian Financial × VendorF CreditMind v4.x trajectory: application receipt → credit-bureau pull with FCRA §604(a)(3)(A) citation → AI score (advisory-only) → adverse-action-capable decision recommendation with human credit officer.
- **`verifier.mjs`** — Independent post-hoc verifier: chain integrity + 2 invariants:
  - **#1 FCRA §604 permissible-purpose** — every credit-bureau pull MUST cite a §604 purpose from the enumerated set
  - **#2 human-credit-officer** — every adverse-action-capable kind with adverse recommendation MUST carry `agent.human_credit_officer_id_tokenized` (Reg B + FCRA §615 + CFPB Circular 2023-03)
- **`cli.mjs`** — `npm start` orchestrates + writes stream + runs verifier in one command.
- 9 unit tests covering: orchestrator output, verifier on canonical stream, vault denial on bureau pull without/with invalid FCRA purpose, vault denial on adverse decision without human officer, vault permit on clean-approve without officer (non-adverse), tampered-hash detection, verifier trips for both invariants.

### Notable

- **Strongest per-event regulatory citation in the Suite** — no other vertical requires a specific statutory section (FCRA §604) to be named on the request. The 8-purpose enumeration is the real list from 15 USC §1681b.
- Adverse-action recognition includes `approve-with-conditions` and `counter-offer` (Reg B treats these as adverse since they require disclosure of reasons), not just decline/close.

### Not yet

- Real bureau API integration (TransUnion / Equifax / Experian gateway adapters).
- BSA/AML SAR-trigger flow (deferred — covered by sibling spec's separate kind).
- Section 1071 small-business demographic data flow (deferred — separate trajectory).
- Section 1033 financial-data-rights consumer-portability flow.
- ed25519 event signing.