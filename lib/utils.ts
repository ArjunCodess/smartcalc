import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

import { GoogleGenerativeAI } from '@google/generative-ai'
import { Answer } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function analyzeImage(img: Blob, dictOfVars: Record<string, string>): Promise<Answer[]> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })

  const prompt = `Analyze this mathematical expression and solve it.
If it's an equation (like 3x + 3 = 12), solve for x and return both the equation and the solution:
[
  {"expr": "3x + 3", "result": "12"},
  {"expr": "x", "result": "3", "assign": true}
]

If it contains direct variable assignments (like x = 3), return:
[{"expr": "x", "result": "3", "assign": true}]

For example:
Input: "3x + 3 = 12"
Output: [
  {"expr": "3x + 3", "result": "12"},
  {"expr": "x", "result": "3", "assign": true}
]

Input: "x = 3"
Output: [{"expr": "x", "result": "3", "assign": true}]

Use this format strictly. Return only the JSON array, nothing else.
For equations, always solve for the variable and include both the equation and the solution.
Current variable values: ${JSON.stringify(dictOfVars)}`;

  try {
    const result = await model.generateContent([
      {
        inlineData: {
          data: await img.arrayBuffer().then(buffer => Buffer.from(buffer).toString('base64')),
          mimeType: img.type
        }
      },
      prompt
    ]);

    const text = result.response.text();
    console.log('Raw API response:', text);

    // Try to extract JSON from the response
    const jsonMatch = text.match(/\[([\s\S]*?)\]/);
    if (!jsonMatch) {
      console.error('No JSON found in response');
      return [{
        expr: "Error",
        result: "Could not parse expression"
      }];
    }

    const jsonStr = jsonMatch[0].replace(/\n/g, '');
    console.log('Extracted JSON:', jsonStr);

    try {
      const answers = JSON.parse(jsonStr) as Answer[];
      const processedAnswers = answers.map(answer => ({
        ...answer,
        assign: 'assign' in answer ? true : false
      }));
      
      console.log('Processed answers:', processedAnswers);
      
      return processedAnswers;
    } catch (e) {
      console.error('JSON parse error:', e);
      return [{
        expr: "Error",
        result: "Invalid response format"
      }];
    }

  } catch (error) {
    console.error('Gemini API error:', error);
    return [{
      expr: `Error: ${error}`,
      result: "API error occurred"
    }];
  }
}