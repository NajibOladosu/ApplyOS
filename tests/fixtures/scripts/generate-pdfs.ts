/**
 * Generate test fixture PDFs using pdf-lib.
 *
 * Run once to produce `tests/fixtures/pdfs/sample-cv.pdf` and
 * `tests/fixtures/pdfs/empty.pdf`, then commit the resulting files.
 *
 * Usage:
 *   npx tsx tests/fixtures/scripts/generate-pdfs.ts
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as fs from "fs";
import * as path from "path";

const OUT_DIR = path.join(__dirname, "..", "pdfs");

async function generateSampleCV(): Promise<void> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  const { height } = page.getSize();
  let y = height - 60;
  const LEFT = 50;

  // Helper to draw a line of text
  const drawText = (
    text: string,
    opts: { size?: number; bold?: boolean; color?: [number, number, number] } = {}
  ) => {
    const { size = 12, bold = false, color = [0, 0, 0] } = opts;
    page.drawText(text, {
      x: LEFT,
      y,
      size,
      font: bold ? boldFont : font,
      color: rgb(color[0], color[1], color[2]),
    });
    y -= size + 6;
  };

  // Name / header
  drawText("Hello from sample CV", { size: 20, bold: true });
  y -= 10;
  drawText("John Doe", { size: 16, bold: true });
  drawText("john.doe@example.com | +1 555-0100", { size: 10 });
  drawText("https://linkedin.com/in/johndoe", { size: 10 });
  y -= 12;

  // Summary
  drawText("SUMMARY", { size: 13, bold: true });
  drawText(
    "Experienced software engineer with 5+ years building scalable",
    { size: 10 }
  );
  drawText("web applications using TypeScript, React, and Node.js.", {
    size: 10,
  });
  y -= 12;

  // Skills section
  drawText("Skills", { size: 13, bold: true });
  drawText("Languages: TypeScript, JavaScript, Python, SQL", { size: 10 });
  drawText(
    "Frameworks: Next.js, React, Node.js, Express, Tailwind CSS",
    { size: 10 }
  );
  drawText("Tools: Git, Docker, Supabase, Vercel, PostgreSQL", { size: 10 });
  y -= 12;

  // Experience
  drawText("EXPERIENCE", { size: 13, bold: true });
  drawText("Senior Software Engineer — Acme Corp (2021–Present)", {
    size: 11,
    bold: true,
  });
  drawText("- Led migration of monolith to microservices architecture", {
    size: 10,
  });
  drawText("- Reduced page load time by 40% via code splitting", {
    size: 10,
  });
  y -= 8;
  drawText("Software Engineer — Widgets Inc (2019–2021)", {
    size: 11,
    bold: true,
  });
  drawText("- Built real-time dashboard with WebSocket and React", {
    size: 10,
  });
  drawText("- Introduced TypeScript across the front-end codebase", {
    size: 10,
  });
  y -= 12;

  // Education
  drawText("EDUCATION", { size: 13, bold: true });
  drawText("B.Sc. Computer Science — State University (2015–2019)", {
    size: 10,
  });

  // useObjectStreams: false produces a traditional xref table (PDF 1.4-compatible)
  // which pdf2json can parse; the default PDF 1.7 cross-reference stream format fails.
  //
  // NOTE: pdf2json v4 has a Buffer pool bug — it reads offset-0 of the shared Node
  // pool ArrayBuffer when buf.buffer.byteLength !== buf.byteLength.  The fix lives in
  // pdf-utils.ts (copies buffer via Buffer.allocUnsafeSlow before calling parseBuffer).
  const bytes = await doc.save({ useObjectStreams: false });
  const outPath = path.join(OUT_DIR, "sample-cv.pdf");
  fs.writeFileSync(outPath, bytes);
  console.log(`Written: ${outPath} (${bytes.byteLength} bytes)`);
}

async function generateEmptyPDF(): Promise<void> {
  const doc = await PDFDocument.create();
  // Add a blank page with no text
  doc.addPage([595, 842]);
  const bytes = await doc.save({ useObjectStreams: false });
  const outPath = path.join(OUT_DIR, "empty.pdf");
  fs.writeFileSync(outPath, bytes);
  console.log(`Written: ${outPath} (${bytes.byteLength} bytes)`);
}

(async () => {
  await generateSampleCV();
  await generateEmptyPDF();
  console.log("Done.");
})();
