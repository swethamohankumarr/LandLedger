/**
 * Minimal, dependency-free generator for a valid single-page PDF.
 * Produces correct `xref` byte offsets so the files open in any PDF viewer —
 * these stand in for scanned land deeds in the synthetic dataset.
 */
export function makeDeedPdf(title: string, lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/([()\\])/g, "\\$1");

  // Build the page content stream (text).
  let content = "BT\n/F1 18 Tf\n72 720 Td\n";
  content += `(${esc(title)}) Tj\n`;
  content += "/F1 11 Tf\n0 -28 TD\n";
  for (const line of lines) {
    content += `(${esc(line)}) Tj\n0 -16 TD\n`;
  }
  content += "ET";

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push(
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] " +
      "/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>"
  );
  objects.push(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = Buffer.byteLength(pdf, "latin1");
  const count = objects.length + 1;
  pdf += `xref\n0 ${count}\n`;
  pdf += "0000000000 65535 f \n";
  for (const off of offsets) {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}
