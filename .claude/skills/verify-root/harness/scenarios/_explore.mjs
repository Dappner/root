// Discovery helper: screenshot + ARIA snapshot of routes. Not a proof.
// Usage: EXPLORE_ROUTES="/,/library,/ask" node run.mjs _explore --no-video
import fs from "node:fs";
import path from "node:path";

export default async ({ page, shot }) => {
  const routes = (process.env.EXPLORE_ROUTES ?? "/").split(",");
  const snapshots = {};
  for (const route of routes) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    await shot(route.replace(/\W+/g, "_") || "root");
    snapshots[route] = await page.locator("body").ariaSnapshot();
  }
  const dir = path.dirname(await shot("last"));
  fs.writeFileSync(path.join(dir, "aria.yml"), Object.entries(snapshots).map(([r, s]) => `# ${r}\n${s}`).join("\n\n"));
  return { routes };
};
