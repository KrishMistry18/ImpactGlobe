import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

/**
 * Get Gemini model instance
 * Primary: gemini-2.0-flash-lite (separate quota, very fast, free)
 * Fallback: gemini-1.5-flash (if lite is also rate limited)
 */
export function getGeminiModel(modelName = 'gemini-2.0-flash-lite') {
  return genAI.getGenerativeModel({ 
    model: modelName,
    generationConfig: {
      temperature: 0.3,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 1024,
    },
  })
}

/**
 * Analyze text with Gemini, with automatic model fallback on rate limits
 */
export async function analyzeWithGemini(prompt: string): Promise<string> {
  // Try models in order of preference
  const models = ['gemini-2.0-flash-lite', 'gemini-1.5-flash', 'gemini-2.0-flash']
  
  for (const modelName of models) {
    try {
      const model = getGeminiModel(modelName)
      const result = await model.generateContent(prompt)
      return result.response.text()
    } catch (error: any) {
      const is429 = error?.message?.includes('429') || error?.message?.includes('quota')
      const is404 = error?.message?.includes('404') || error?.message?.includes('not found')
      
      if (is429 || is404) {
        console.warn(`[Gemini] Model ${modelName} unavailable (${is429 ? 'rate limit' : 'not found'}), trying next...`)
        continue
      }
      // Non-rate-limit error — throw immediately
      throw error
    }
  }
  
  throw new Error('All Gemini models are rate limited. Please try again later.')
}
