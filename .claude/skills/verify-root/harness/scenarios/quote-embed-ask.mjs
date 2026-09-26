// Feature: highlights → embeddings → Ask. Add a quote to a new source, prove the
// background task embedded it (rag_embeddings row + fake Voyage call), then ask a
// question in /ask and see the stubbed answer stream back.
// Answers are "[stub-llm] ..." text from fake_providers.py, not a real model.
import fs from "node:fs";
import path from "node:path";

const poll = async (fn, ms = 15000) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) return v;
    await new Promise((r) => setTimeout(r, 500));
  }
};

export default async ({ page, shot, sql, state, expect }) => {
  const stamp = Date.now();
  const title = `Verify Quotes ${stamp}`;
  const quote = `Compounding curiosity turns small daily reading into durable insight ${stamp}`;
  const logFile = path.join(state.RUN_DIR, "fake-providers.jsonl");
  const embedCallsBefore = fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8").split("\n").filter((l) => l.includes('"embed"')).length : 0;

  // Source to hang the quote on.
  await page.goto("/library");
  await page.getByRole("button", { name: "Add Source" }).click();
  const addSource = page.getByRole("dialog", { name: "Add Source" });
  await addSource.getByRole("textbox", { name: "Title *" }).fill(title);
  await addSource.getByRole("button", { name: "Create Source" }).click();
  await addSource.waitFor({ state: "hidden" });
  const sourceId = await poll(() => sql(`select id from sources where title = '${title}'`));
  expect(sourceId, "source row");

  // Quote via the source page's Quote button.
  await page.goto(`/library/${sourceId}`);
  await page.getByRole("button", { name: "Quote" }).click();
  const dlg = page.getByRole("dialog", { name: "Add Citation" });
  await dlg.getByRole("textbox", { name: "Text *" }).fill(quote);
  await shot("quote-filled");
  await dlg.getByRole("button", { name: "Create Citation" }).click();
  await dlg.waitFor({ state: "hidden" });

  await page.goto(`/library/${sourceId}/highlights`);
  await page.getByText(quote).first().waitFor();
  await shot("highlights");

  // Side effect: background embedding task wrote a vector for the citation.
  const emb = await poll(() =>
    sql(`select e.model, vector_dims(e.embedding) from rag_embeddings e join citations c on c.id = e.citation_id where c.text = '${quote}'`)
  );
  const embedCallsAfter = fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf8").split("\n").filter((l) => l.includes('"embed"')).length : 0;
  // Checked at the end so the Ask half still runs (and records evidence) when embedding is broken.

  // Ask.
  await page.goto("/ask");
  await page.getByRole("textbox", { name: "Ask anything..." }).fill("What does compounding curiosity do for reading?");
  await page.getByRole("textbox", { name: "Ask anything..." }).press("Enter");
  const answer = page.getByText("[stub-llm]").first();
  await answer.waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot("ask-answer");

  const geminiCalls = fs.readFileSync(logFile, "utf8").split("\n").filter((l) => l.includes('"gemini"')).length;
  expect(geminiCalls > 0, "fake Gemini received a call");
  expect(embedCallsAfter > embedCallsBefore, "fake Voyage received an embed call for the new citation");
  expect(emb, "rag_embeddings row for the new citation");
  return { source_id: Number(sourceId), embedding: emb, gemini_calls: geminiCalls, answer_url: page.url() };
};
