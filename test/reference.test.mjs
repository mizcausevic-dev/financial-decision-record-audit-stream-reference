import { test } from "node:test";
import assert from "node:assert/strict";
import { orchestrate } from "../src/orchestrator.mjs";
import { verify } from "../src/verifier.mjs";
import { requestCreditAccess } from "../src/credit-vault.mjs";

test("orchestrator produces 4 events with no vault denials", () => {
  const { events, denials } = orchestrate();
  assert.equal(events.length, 4);
  assert.equal(denials.length, 0);
});

test("produced stream passes verifier (chain + 2 invariants)", () => {
  const { events } = orchestrate();
  const r = verify(events);
  assert.ok(r.ok, JSON.stringify(r.errors, null, 2));
});

test("vault denies bureau pull without FCRA permissible purpose", () => {
  const r = requestCreditAccess({
    kind: "fintech.credit.bureau-report-pulled",
    action: "pull-credit-report",
    fcra_permissible_purpose: null
  });
  assert.equal(r.allowed, false);
  assert.match(r.reason, /FCRA §604/);
});

test("vault denies invalid FCRA permissible purpose string", () => {
  const r = requestCreditAccess({
    kind: "fintech.credit.bureau-report-pulled",
    action: "pull-credit-report",
    fcra_permissible_purpose: "i-just-want-the-credit-report"
  });
  assert.equal(r.allowed, false);
  assert.match(r.reason, /not a recognized FCRA §604 purpose/);
});

test("vault denies adverse credit decision without human credit officer", () => {
  const r = requestCreditAccess({
    kind: "fintech.credit.application-decision-recommended",
    action: "recommend",
    outcome_recommendation: "decline",
    human_credit_officer_id_tokenized: null
  });
  assert.equal(r.allowed, false);
  assert.match(r.reason, /human_credit_officer_id_tokenized/);
});

test("vault permits non-adverse credit decision without human officer", () => {
  // "approve" (clean approval) is NOT adverse — no officer required
  const r = requestCreditAccess({
    kind: "fintech.credit.application-decision-recommended",
    action: "recommend",
    outcome_recommendation: "approve",
    human_credit_officer_id_tokenized: null
  });
  assert.equal(r.allowed, true);
});

test("verifier catches tampered hash", () => {
  const { events } = orchestrate();
  const tampered = JSON.parse(JSON.stringify(events));
  tampered[2].hash = "0".repeat(64);
  const r = verify(tampered);
  assert.ok(!r.ok);
  assert.ok(r.errors.some((e) => e.includes("hash")));
});

test("verifier catches missing FCRA permissible purpose on bureau pull (invariant #1)", () => {
  const { events } = orchestrate();
  const tampered = JSON.parse(JSON.stringify(events));
  delete tampered[1].agent.fcra_permissible_purpose;
  const r = verify(tampered);
  assert.ok(!r.ok);
  assert.ok(r.errors.some((e) => e.includes("invariant#1")));
});

test("verifier catches missing human credit officer on adverse recommendation (invariant #2)", () => {
  const { events } = orchestrate();
  const tampered = JSON.parse(JSON.stringify(events));
  delete tampered[3].agent.human_credit_officer_id_tokenized;
  const r = verify(tampered);
  assert.ok(!r.ok);
  assert.ok(r.errors.some((e) => e.includes("invariant#2")));
});
