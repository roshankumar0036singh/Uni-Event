const MISTRAL_API_URL="https://api.mistral.ai/v1/chat/completions";
const MISTRAL_MODEL="mistral-small-latest";

export async function fetchTagSuggestions(description, apikey) {
    if(!apikey || !description || description.trim().length < 30) return[];
    const systemPrompt = `You are a tag extraction engine for a university event platform.
        Given an event description, return ONLY a JSON array of 3 to 7 lowercase, hyphenated tags.
        Rules:
        - Tags must be single concepts (no sentences).
        - Use hyphens for multi-word tags: "data-structures", not "data structures".
        - Do NOT include the university name, years, or branch names as tags.
        - Return ONLY the JSON array. No explanation, no markdown, no preamble.
        Example output: ["coding","workshop","python","beginner-friendly"]`;

        const body = {
            model: MISTRAL_MODEL,
            max_tokens: 150,
            temperature: 0.2,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: description.trim() },
            ],
        };

        const response = await fetch(MISTRAL_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apikey}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Mistral API error: ${response.status} ${err}`);
        }

        const data = await response.json();
        const raw = data?.choices?.[0]?.message?.content?.trim() ?? '[]';

        try{
            const cleaned = raw.replace(/```json|```/g,'').trim();
            const tags = JSON.parse(cleaned);
            if(!Array.isArray(tags)) return [];
            return tags.map(t=>String(t).toLowerCase().trim()).filter(Boolean);
        }catch{
            console.warn('[tagSuggestionService] Failed to parse Mistral response:', raw);
            return [];
        }
}