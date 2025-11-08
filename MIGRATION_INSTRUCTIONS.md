# Database Migration Instructions

## New Migration: Document Analysis & Summary Fields

A new migration has been created to add AI analysis and summary tracking fields to the documents table.

### Migration File
`supabase/migrations/002_add_document_analysis_fields.sql`

### What it adds
- `summary` - AI-generated summary of document content
- `summary_generated_at` - Timestamp when summary was last generated
- `analysis_status` - Status of AI analysis (not_analyzed, pending, success, failed)
- `analysis_error` - Error message if analysis failed
- `parsed_at` - Timestamp when document was last analyzed
- `application_id` - Optional link to an application

### How to apply the migration

#### Option 1: Supabase Dashboard (Recommended)
1. Open your Supabase project dashboard
2. Navigate to the **SQL Editor**
3. Copy the contents of `supabase/migrations/002_add_document_analysis_fields.sql`
4. Paste into the SQL editor
5. Click **Run** to execute the migration

#### Option 2: Supabase CLI (if configured)
```bash
supabase db push
```

### Verify the migration
After applying the migration, verify it worked by running this query in the SQL Editor:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'documents'
AND table_schema = 'public'
ORDER BY ordinal_position;
```

You should see the new columns listed.

## Post-Migration

After applying the migration:
1. The **"Generate Summary"** feature will work for all documents
2. The **"Analyze Document"** feature will extract structured data from PDFs and text files
3. The document detail page will display both summary and parsed information

### Important Notes
- Existing documents will have `analysis_status` set to 'not_analyzed' by default
- You can analyze existing documents by clicking **"Analyze document"** in the dropdown menu
- Summaries are generated on-demand and cached in the database
- Make sure `GEMINI_API_KEY` is configured in your environment variables for AI features to work
