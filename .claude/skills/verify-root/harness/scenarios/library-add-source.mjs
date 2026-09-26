// Feature: library — add a source through the Add Source dialog, see it listed,
// open it, and confirm the row landed in `sources` for the seeded user.
export default async ({ page, shot, sql, state, expect }) => {
  const title = `Verify Book ${Date.now()}`;

  await page.goto("/library");
  await page.getByRole("heading", { name: "Library", level: 1 }).waitFor();
  await shot("library-before");

  await page.getByRole("button", { name: "Add Source" }).click();
  const dialog = page.getByRole("dialog", { name: "Add Source" });
  await dialog.getByRole("textbox", { name: "Title *" }).fill(title);
  await dialog.getByRole("textbox", { name: "Author" }).fill("Verify Author");
  await shot("dialog-filled");
  await dialog.getByRole("button", { name: "Create Source" }).click();
  await dialog.waitFor({ state: "hidden" });

  await page.goto("/library");
  const card = page.getByText(title).first();
  await card.waitFor();
  await shot("library-after");

  await card.click();
  await page.waitForURL(/\/library\/\d+/);
  await page.getByText(title).first().waitFor();
  await shot("source-detail");

  const row = sql(
    `select s.id, s.type, s.author from sources s join auth."user" u on u.id = s.user_id ` +
      `where u.email = '${state.VERIFY_EMAIL}' and s.title = '${title}'`
  );
  expect(row, `sources row for "${title}"`);
  const [id, type, author] = row.split("|");
  expect(type === "book" && author === "Verify Author", `row fields (got ${row})`);
  return { title, source_id: Number(id), url: page.url() };
};
