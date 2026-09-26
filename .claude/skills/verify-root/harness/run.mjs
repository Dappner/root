#!/usr/bin/env node
// Run one feature scenario and print its evidence directory.
// Usage: node run.mjs <scenario> [--no-video]
//   <scenario> is a file in scenarios/ (with or without .mjs), or a path.
// A scenario exports `default async ({ page, shot, sql, state, expect }) => result`.
// Throwing fails the run; evidence is still written (result.json has "ok": false).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { session, sql } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = process.argv[2];
if (!arg) {
  console.error("usage: run.mjs <scenario> [--no-video]\nscenarios:", fs.readdirSync(path.join(HERE, "scenarios")).join(", "));
  process.exit(2);
}
const file = fs.existsSync(arg) ? path.resolve(arg) : path.join(HERE, "scenarios", arg.endsWith(".mjs") ? arg : `${arg}.mjs`);
const name = path.basename(file, ".mjs");
const { default: scenario } = await import(pathToFileURL(file).href);

const expect = (cond, msg) => { if (!cond) throw new Error(`expectation failed: ${msg}`); };
const s = await session({ label: name, video: !process.argv.includes("--no-video") });
let result;
try {
  const out = await scenario({ page: s.page, shot: s.shot, sql, state: s.state, expect });
  result = { ok: true, ...out };
} catch (err) {
  await s.shot("failure").catch(() => {});
  result = { ok: false, error: String(err?.stack ?? err) };
}
const dir = await s.finish(result);
console.log(JSON.stringify({ ok: result.ok, evidence: dir, ...(result.ok ? {} : { error: result.error.split("\n")[0] }) }, null, 2));
process.exit(result.ok ? 0 : 1);
