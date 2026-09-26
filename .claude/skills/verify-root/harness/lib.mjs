// Playwright harness for verify-root. Drives the real SPA as the seeded user and
// writes evidence to .verify/evidence/<timestamp>-<label>/ (survives down.sh).
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SKILL_DIR = path.resolve(HERE, "..");
export const REPO_ROOT = path.resolve(SKILL_DIR, "../../..");

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const roots = [HERE];
  try { roots.push(execSync("npm root -g", { encoding: "utf8" }).trim()); } catch {}
  for (const name of ["playwright", "playwright-core"]) {
    try { return require(require.resolve(name, { paths: roots })); } catch {}
  }
  throw new Error(
    "playwright not found. Install once: npm install --prefix .claude/skills/verify-root/harness playwright-core"
  );
}

export function readState() {
  const offset = process.env.VERIFY_PORT_OFFSET ?? "0";
  const file = path.join(REPO_ROOT, ".verify/run", `i${offset}`, "state.env");
  if (!fs.existsSync(file)) throw new Error(`no instance state at ${file}; run scripts/up.sh`);
  return Object.fromEntries(
    fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    })
  );
}

export function sql(query) {
  const state = readState();
  return execSync(
    `docker exec -i ${state.PG_CONTAINER} psql -U postgres -d root -tA -F '|' -c ${JSON.stringify(query)}`,
    { encoding: "utf8" }
  ).trim();
}

/**
 * Open a logged-in browser session.
 * opts.label  evidence folder suffix
 * opts.video  record video (default true)
 * opts.login  log in through /login first (default true)
 */
export async function session(opts = {}) {
  const { chromium } = loadPlaywright();
  const state = readState();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(REPO_ROOT, ".verify/evidence", `${stamp}-${opts.label ?? "run"}`);
  fs.mkdirSync(dir, { recursive: true });

  // Provider calls made during this session end up in the evidence (the run dir
  // itself is deleted by down.sh).
  const providerLog = path.join(state.RUN_DIR ?? "", "fake-providers.jsonl");
  const readProviderLog = () =>
    fs.existsSync(providerLog) ? fs.readFileSync(providerLog, "utf8").split("\n").filter(Boolean) : [];
  const providerLinesBefore = readProviderLog().length;

  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: state.WEB_URL,
    viewport: { width: 1280, height: 800 },
    ...(opts.video === false ? {} : { recordVideo: { dir, size: { width: 1280, height: 800 } } }),
  });
  const page = await context.newPage();
  const events = [];
  page.on("console", (m) => { if (m.type() === "error") events.push({ kind: "console.error", text: m.text() }); });
  page.on("pageerror", (e) => events.push({ kind: "pageerror", text: String(e) }));
  page.on("response", (r) => {
    if (r.url().includes("/rag-api/") || r.url().includes("/api/auth/")) {
      events.push({ kind: "api", status: r.status(), method: r.request().method(), url: r.url().replace(state.WEB_URL, "") });
    }
  });

  let n = 0;
  const shot = async (name) => {
    const file = path.join(dir, `${String(++n).padStart(2, "0")}-${name}.png`);
    // Let queries settle so shots show data, not loading skeletons.
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    await page.screenshot({ path: file, fullPage: true });
    return file;
  };

  if (opts.login !== false) {
    await page.goto("/login");
    await page.locator("input#email").fill(state.VERIFY_EMAIL);
    await page.locator("input#password").fill(state.VERIFY_PASSWORD);
    await page.locator("button[type=submit]").click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
  }

  const finish = async (result = {}) => {
    const video = page.video();
    await context.close();
    await browser.close();
    if (video) {
      const src = await video.path();
      fs.renameSync(src, path.join(dir, "video.webm"));
    }
    fs.writeFileSync(path.join(dir, "events.json"), JSON.stringify(events, null, 2));
    const calls = readProviderLog().slice(providerLinesBefore);
    fs.writeFileSync(path.join(dir, "provider-calls.jsonl"), calls.join("\n") + (calls.length ? "\n" : ""));
    fs.writeFileSync(
      path.join(dir, "result.json"),
      JSON.stringify({ label: opts.label, git_head: state.GIT_HEAD, web_url: state.WEB_URL, ...result }, null, 2)
    );
    return dir;
  };

  return { page, context, state, dir, shot, events, finish };
}
