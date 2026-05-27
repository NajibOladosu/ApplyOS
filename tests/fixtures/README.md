# Test Fixtures

- `pdfs/` — Minimal PDFs for `lib/pdf-utils` tests
- `blog/` — Sample MDX posts for `lib/blog` tests
- `scripts/` — Scripts to regenerate fixtures

Binary fixtures must stay <10KB. Do NOT add real user CVs here.

To regenerate PDFs: run `npx tsx tests/fixtures/scripts/generate-pdfs.ts`

## Known pdf2json behaviour

pdf2json v4 reads the wrong bytes when passed a Node pool-allocated Buffer
(`buf.buffer.byteLength !== buf.byteLength`). The workaround lives in
`modules/documents/lib/pdf-utils.ts`: it copies the buffer via
`Buffer.allocUnsafeSlow` before calling `parser.parseBuffer()`.
