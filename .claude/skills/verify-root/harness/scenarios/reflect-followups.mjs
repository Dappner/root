// Feature: Reflect on a source → streamed answer → follow-up chips → click a chip.
// LLM_MODE=fake: FakeLLMClient; answer and chips start with "[fake-llm]".
// LLM_MODE=http: live Jetflow Gemini client → fake_providers.py, which answers
//   "[stub-llm] ..." and returns a forced FollowUpPrompts function call.
export default async ({ page, shot, sql, state, expect }) => {
  const tag = (state.LLM_MODE ?? "fake") === "fake" ? "[fake-llm]" : "[stub-llm]";
  const title = `Verify Reflect ${Date.now()}`;

  await page.goto("/library");
  await page.getByRole("button", { name: "Add Source" }).click();
  const addSource = page.getByRole("dialog", { name: "Add Source" });
  await addSource.getByRole("textbox", { name: "Title *" }).fill(title);
  await addSource.getByRole("button", { name: "Create Source" }).click();
  await addSource.waitFor({ state: "hidden" });
  const sourceId = sql(`select id from sources where title = '${title}'`);
  expect(sourceId, "source row");

  await page.goto(`/library/${sourceId}/reflect`);
  await page.getByRole("heading", { name: "Reflect on this source" }).waitFor();
  const box = page.getByRole("textbox", { name: "Ask anything..." });
  await box.fill("What stood out to me here?");
  await shot("reflect-question");
  await box.press("Enter");

  await page.getByText(`${tag} Stubbed answer`).first().waitFor({ timeout: 30000 });
  // Chips arrive after the answer (separate follow-up agent call).
  const chipText = `${tag} Tell me more`;
  const chip = page.getByRole("button", { name: chipText });
  let chips = [];
  try {
    await chip.waitFor({ timeout: 15000 });
    chips = await page.getByRole("button", { name: new RegExp(`^\\${tag.slice(0, -1)}\\]`) }).allTextContents();
  } finally {
    await shot("answer-with-followups");
  }
  expect(chips.length === 2, `two follow-up chips (got ${JSON.stringify(chips)})`);

  // Clicking a chip submits it as the next question (chip + user bubble).
  await chip.click();
  const deadline = Date.now() + 30000;
  while ((await page.getByText(chipText).count()) < 2 && Date.now() < deadline) {
    await page.waitForTimeout(250);
  }
  await page.getByText(`${tag} Stubbed answer`).nth(1).waitFor({ timeout: 30000 });
  await shot("chip-followed");
  return { source_id: Number(sourceId), llm_mode: state.LLM_MODE, chips };
};
