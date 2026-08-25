import { pdfjs } from "react-pdf";

export async function getPdfPageCount(file: File): Promise<number> {
  const data = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  await loadingTask.destroy();
  return pageCount;
}
