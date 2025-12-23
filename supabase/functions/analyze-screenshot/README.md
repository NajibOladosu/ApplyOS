# Screenshot Analysis Edge Function

## Setup

1. **Deploy the Edge Function**:
```bash
supabase functions deploy analyze-screenshot
```

2. **Set environment variables** in Supabase Dashboard:
   - `GEMINI_API_KEY` = Your Gemini API key
   - (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-set)

3. **Run the trigger migration**:
```bash
# Apply migration 021_create_screenshot_trigger.sql in Supabase SQL editor
```

## How It Works

1. **Upload Screenshot** → Supabase Storage (`marketing-assets/screenshots/`)
2. **Trigger Fires** → Calls Edge Function automatically
3. **Edge Function**:
   - Checks if screenshot already analyzed (prevents duplicates)
   - Fetches image from storage
   - Analyzes with Gemini Vision
   - Stores metadata in `screenshot_metadata` table
4. **Done** → Screenshot ready for n8n workflow to use

## Benefits

- ✅ **No Duplicates**: Checks database before analyzing
- ✅ **Auto-Trigger**: Runs on every new upload
- ✅ **Serverless**: No manual script execution needed
- ✅ **Scalable**: Handles new screenshots automatically

## Testing

Upload a test screenshot:
```bash
# Via Supabase Dashboard or CLI
supabase storage upload marketing-assets/screenshots/test.png ./test.png
```

Check the logs:
```bash
supabase functions logs analyze-screenshot
```
