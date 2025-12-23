import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PAGES = [
    'Dashboard', 'Applications', 'Interview', 'Documents',
    'Upload', 'Notifications', 'Feedback', 'Profile', 'Settings'
]

serve(async (req) => {
    try {
        const { record } = await req.json()

        // Only process files in screenshots folder
        if (!record.name.startsWith('screenshots/') || !record.name.endsWith('.png')) {
            return new Response(JSON.stringify({ skipped: true, reason: 'Not a screenshot' }), {
                headers: { 'Content-Type': 'application/json' },
            })
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const geminiKey = Deno.env.get('GEMINI_API_KEY')!

        const supabase = createClient(supabaseUrl, supabaseKey)

        const fileName = record.name.replace('screenshots/', '')

        // Check if already analyzed
        const { data: existing } = await supabase
            .from('screenshot_metadata')
            .select('id')
            .eq('file_name', fileName)
            .single()

        if (existing) {
            return new Response(JSON.stringify({ skipped: true, reason: 'Already analyzed' }), {
                headers: { 'Content-Type': 'application/json' },
            })
        }

        // Get public URL
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/marketing-assets/${record.name}`

        // Fetch and convert image to base64
        const imageResponse = await fetch(publicUrl)
        const imageBuffer = await imageResponse.arrayBuffer()
        const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)))

        // Analyze with Gemini
        const prompt = `Analyze this screenshot from Trackly, a SaaS application for managing job and scholarship applications.

Identify:
1. Which page this screenshot is from: ${PAGES.join(', ')}
2. What specific feature or functionality is shown
3. Key UI elements visible

Respond in JSON format:
{
  "page_category": "exact page name from list",
  "feature_description": "brief description of the feature shown",
  "key_elements": ["element1", "element2"],
  "user_action": "what the user is doing or can do here"
}`

        const geminiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: prompt },
                            {
                                inline_data: {
                                    mime_type: 'image/png',
                                    data: base64Image
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.4,
                        responseMimeType: 'application/json'
                    }
                })
            }
        )

        const geminiData = await geminiResponse.json()

        if (geminiData.error) {
            throw new Error(geminiData.error.message)
        }

        const analysisText = geminiData.candidates[0].content.parts[0].text
        const analysis = JSON.parse(analysisText)

        // Store in database
        const { error: insertError } = await supabase
            .from('screenshot_metadata')
            .insert({
                file_name: fileName,
                storage_path: record.name,
                public_url: publicUrl,
                page_category: analysis.page_category,
                feature_description: analysis.feature_description,
                ai_analysis: analysis
            })

        if (insertError) {
            throw insertError
        }

        return new Response(
            JSON.stringify({
                success: true,
                fileName,
                page: analysis.page_category,
                feature: analysis.feature_description
            }),
            { headers: { 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
    }
})
