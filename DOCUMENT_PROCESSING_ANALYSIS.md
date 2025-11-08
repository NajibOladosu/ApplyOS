# Document Processing Analysis

## Current Issues Identified

### 1. **Upload Route - No Content Extraction** ❌
**Location:** `app/api/documents/upload/route.ts:118`
```typescript
const textToAnalyze = `File name: ${file.name}` // ❌ Only filename!
const parsed = await parseDocument(textToAnalyze)
```
**Problem:** Only passing filename to AI, not the actual document content.
**Impact:** AI has no real content to analyze, making analysis useless.

### 2. **Repeated Text Extraction** ❌
- Upload extracts nothing
- Reprocess endpoint extracts text (inefficient)
- Summary endpoint extracts text again (duplicate work)
**Problem:** Text extraction happens multiple times or not at all.
**Impact:** Slow performance, wasted resources, inconsistent results.

### 3. **PDF Parsing Dependency Issues** ⚠️
- Using `pdf-parse` which requires native Node.js modules
- `@napi-rs/canvas` dependency can be problematic in serverless
- Not compatible with Edge Runtime
**Problem:** Fragile dependency chain, deployment issues.

### 4. **No Extracted Text Storage** ❌
- Extracted text is not stored in database
- Must re-extract every time it's needed
**Problem:** Inefficient, slow, prone to failures.

## Proposed Solution

### Phase 1: Database Schema
Add `extracted_text` column to store parsed content once.

### Phase 2: Upload Flow
```
Upload → Extract Text → Store in DB → Analyze with AI → Store Results
```

### Phase 3: Reprocess Flow
```
Reprocess → Use stored extracted_text OR re-extract → Analyze → Update
```

### Phase 4: Summary Flow
```
Summary → Use stored extracted_text → Generate summary → Store
```

## Implementation Plan

1. ✅ Add `extracted_text` TEXT column to documents table
2. ✅ Extract text during upload (we have the buffer!)
3. ✅ Store extracted text in database
4. ✅ Use extracted text for analysis
5. ✅ Use extracted text for summaries
6. ✅ Handle edge cases (re-extraction if needed)

## Benefits

- **One-time extraction**: Text extracted once during upload
- **Fast analysis**: Use pre-extracted text
- **Better AI results**: AI gets real content, not just filename
- **Reliability**: No repeated extraction failures
- **Simplicity**: Cleaner code, easier to maintain
