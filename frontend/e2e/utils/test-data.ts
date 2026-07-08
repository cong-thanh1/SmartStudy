/**
 * Test data helpers — generate unique identifiers to ensure test isolation.
 * Each test run creates data with timestamps/random IDs to avoid collisions
 * between concurrent runs or repeated executions.
 *
 * Per PLAYWRIGHT_TEST_GOAL.md §0 rule 7:
 *   "mỗi test tự tạo dữ liệu riêng (VD tên file có timestamp/UUID)"
 */

/** Returns a unique title with the given prefix and a timestamp suffix */
export function uniqueTitle(prefix: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 7);
  return `${prefix}_${ts}_${rand}`;
}

/** Returns a short unique ID (8 chars) */
export function shortId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Creates a minimal valid PDF as a Buffer.
 * Useful for programmatic file uploads without needing actual test fixtures on disk.
 * The PDF contains one text page with the given content.
 */
export function createMinimalPdfBuffer(content = 'SmartStudy AI E2E Test Document'): Buffer {
  const pdfBody = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj

2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj

3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]
   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj

4 0 obj
<< /Length ${content.length + 44} >>
stream
BT
/F1 12 Tf
72 720 Td
(${content}) Tj
ET
endstream
endobj

5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000062 00000 n 
0000000119 00000 n 
0000000273 00000 n 
0000000399 00000 n 

trailer
<< /Size 6 /Root 1 0 R >>
startxref
476
%%EOF
`;
  return Buffer.from(pdfBody, 'utf-8');
}

/** Alias: create a corrupt PDF (invalid header) */
export function createCorruptPdfBuffer(): Buffer {
  return Buffer.from('This is NOT a valid PDF file. Just some garbage bytes.', 'utf-8');
}

/** Format elapsed time in human-readable form */
export function formatElapsed(startMs: number): string {
  const elapsed = Date.now() - startMs;
  if (elapsed < 1000) return `${elapsed}ms`;
  return `${(elapsed / 1000).toFixed(1)}s`;
}
