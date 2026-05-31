import { createHash } from "node:crypto";

export const ZERO_HASH = "0".repeat(64);

export function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(value[k])).join(",") + "}";
}

export function sha256(s) { return createHash("sha256").update(s, "utf8").digest("hex"); }

export class Chain {
  constructor() { this.prevHash = ZERO_HASH; }
  build(partial) {
    const event = { ...partial, prev_hash: this.prevHash };
    const { hash: _h, ...body } = event;
    event.hash = sha256(canonicalize(body));
    this.prevHash = event.hash;
    return event;
  }
}
