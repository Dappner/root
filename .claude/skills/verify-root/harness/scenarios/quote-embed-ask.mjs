// Feature: highlights → embeddings → Ask. Add a quote to a new source, prove the
// background task embedded it (rag_embeddings row + fake Voyage call), then ask a
// question in /ask and see the answer stream back.
// LLM_MODE=fake (default): FakeLLMClient calls the real search tool once, then
//   answers "[fake-llm] ... Tool results: 1 ...".
// LLM_MODE=http: live Gemini client → fake_providers.py, answer "[stub-llm] ...".
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
  const fakeMode = (state.LLM_MODE ?? "fake") === "fake";
  const answer = page.getByText(fakeMode ? "[fake-llm] Stubbed answer" : "[stub-llm]").first();
  await answer.waitFor({ timeout: 30000 });
  await page.waitForTimeout(1000);
  await shot("ask-answer");

  const answerText = await answer.textContent();
  const log = fs.readFileSync(logFile, "utf8").split("\n");
  const geminiCalls = log.filter((l) => l.includes('"gemini"')).length;
  const queryEmbeds = log.filter((l) => l.includes('"input_type": "query"')).length;
  if (fakeMode) {
    // The fake called the real search tool: query embedding went to Voyage (fake).
    expect(answerText.includes("Tool results: 1"), `answer used search results (got: ${answerText})`);
    expect(queryEmbeds > 0, "search embedded the query via the Embedder");
  } else {
    expect(geminiCalls > 0, "fake Gemini received a call");
  }
  expect(embedCallsAfter > embedCallsBefore, "fake Voyage received an embed call for the new citation");
  expect(emb, "rag_embeddings row for the new citation");
  return { source_id: Number(sourceId), embedding: emb, llm_mode: state.LLM_MODE, answer: answerText, query_embeds: queryEmbeds, gemini_calls: geminiCalls };
};
