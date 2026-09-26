// Feature: PDF source — upload a PDF through the source page, then read it in
// the viewer. Proves the ObjectStore write (object in the S3 stand-in, key and
// page_count on the source row), the presigned-URL read, and the viewer render.

// Minimal one-page PDF with visible text (xref offsets computed below).
function makePdf(text) {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    null, // content stream, filled below
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = `BT /F1 24 Tf 72 700 Td (${text}) Tj ET`;
  objs[3] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  let out = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

export default async ({ page, shot, sql, state, expect }) => {
  const title = `Verify PDF ${Date.now()}`;

  await page.goto("/library");
  await page.getByRole("button", { name: "Add Source" }).click();
  const dialog = page.getByRole("dialog", { name: "Add Source" });
  await dialog.getByText("PDF", { exact: true }).click();
  await dialog.locator("#type-pdf").isChecked().then((c) => expect(c, "PDF type selected"));
  await dialog.getByRole("textbox", { name: "Title *" }).fill(title);
  await dialog.getByRole("button", { name: "Create Source" }).click();
  await dialog.waitFor({ state: "hidden" });
  const sourceId = sql(`select id from sources where title = '${title}'`);
  expect(sourceId, "source row");

  await page.goto(`/library/${sourceId}`);
  await page.getByRole("button", { name: "Choose File" }).waitFor();
  await shot("before-upload");
  const uploaded = page.waitForResponse(
    (r) => r.url().includes(`/sources/${sourceId}/pdf`) && r.request().method() !== "GET"
  );
  await page.locator("input[type=file][accept='application/pdf']").setInputFiles({
    name: "verify.pdf",
    mimeType: "application/pdf",
    buffer: makePdf("Verify PDF upload"),
  });
  const res = await uploaded;
  expect(res.ok(), `upload responded ${res.status()}`);
  await page.waitForTimeout(1000);
  await shot("after-upload");

  // Side effects: key on the row, object in the S3 stand-in.
  const key = sql(`select pdf_object_key from sources where id = ${sourceId}`);
  expect(key, "sources.pdf_object_key set");
  // Objects are private (unsigned GET/HEAD → 403); the bucket listing is open.
  const listing = await (await fetch(`${state.S3_URL}/root-verify?list-type=2&prefix=${encodeURIComponent(key)}`)).text();
  const size = listing.match(/<Size>(\d+)<\/Size>/)?.[1];
  expect(listing.includes(`<Key>${key}</Key>`) && Number(size) > 0, `object ${key} in S3 stand-in`);

  // Read path: the API hands out a presigned URL (what the viewer and "open in
  // new tab" use); fetching it returns the same bytes.
  const url = await page.evaluate(async (id) => {
    const { token } = await (await fetch("/api/auth/token")).json();
    const res = await fetch(`/rag-api/sources/${id}/pdf/url`, { headers: { Authorization: `Bearer ${token}` } });
    return (await res.json()).url;
  }, Number(sourceId));
  expect(url?.includes(key), `presigned URL for ${key} (got ${url})`);
  const pdf = await page.request.get(url); // not window.fetch: the bucket sends no CORS headers
  const body = await pdf.body();
  expect(pdf.ok() && body.subarray(0, 5).toString() === "%PDF-" && body.length === Number(size), "presigned URL serves the uploaded PDF");

  const pageCount = sql(`select metadata->>'page_count' from sources where id = ${sourceId}`);
  expect(pageCount === "1", `metadata.page_count stored (got ${pageCount})`);

  // Viewer: opens, fetches the presigned URL and renders the page.
  const pdfFetched = page.waitForResponse((r) => r.url().includes(key) && r.ok(), { timeout: 20000 });
  await page.getByRole("button", { name: /^PDF/ }).click();
  await page.getByText("PDF Viewer").waitFor();
  await page.getByText("1 pages").waitFor({ timeout: 10000 });
  await pdfFetched;
  await page.getByText("Verify PDF upload").first().waitFor({ timeout: 15000 }); // pdf.js text layer
  await shot("viewer");

  // Rows uploaded before page_count was stored have only size_bytes: the
  // viewer must still open them.
  sql(`update sources set metadata = metadata - 'page_count' where id = ${sourceId}`);
  await page.goto(`/library/${sourceId}`);
  await page.getByRole("button", { name: /^PDF/ }).click();
  await page.getByText("Verify PDF upload").first().waitFor({ timeout: 15000 });
  await shot("viewer-legacy-row");
  return { source_id: Number(sourceId), pdf_object_key: key, object_size: Number(size), page_count: Number(pageCount) };
};
