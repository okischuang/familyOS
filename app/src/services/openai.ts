import { Solution, Alert } from '../types';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// gpt-4o-mini is a valid OpenAI model (released July 2024)
// It's optimized for fast, cost-effective responses while maintaining quality
const MODEL_NAME = 'gpt-4o-mini';

const SOLUTION_SYSTEM_PROMPT = `
You are a family scheduling assistant. Given a scheduling conflict,
generate 2-3 practical solutions. For each solution:
1. Describe what needs to happen
2. List impacts (positive and negative)
3. Rate stability (how likely to succeed)

Respond in JSON format:
{
  "solutions": [
    {
      "id": "a",
      "label": "Solution A (Most Stable)",
      "description": "...",
      "isRecommended": true,
      "impacts": ["..."],
      "stabilityScore": 0.9
    }
  ]
}
`;

const MESSAGE_SYSTEM_PROMPT = `
Generate a warm, non-confrontational message in Traditional Chinese
to ask the recipient to help with a task.
Keep it under 100 characters and be polite but direct.
`;

export interface GenerateSolutionsParams {
  alert: Alert;
}

export interface GenerateMessageParams {
  alert: Alert;
  solution: Solution;
  recipientRelation: 'partner' | 'grandparent' | 'other';
  tone: 'warm' | 'neutral' | 'urgent';
}

export async function generateSolutions(
  params: GenerateSolutionsParams,
  signal?: AbortSignal
): Promise<Solution[]> {
  const { alert } = params;

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: SOLUTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            type: alert.type,
            title: alert.title,
            description: alert.description,
            relatedEvents: alert.relatedEvents,
          }),
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No content in OpenAI response');
  }

  const parsed = JSON.parse(content);
  return parsed.solutions.map((s: Solution & { stabilityScore?: number }) => ({
    id: s.id,
    label: s.label,
    description: s.description,
    isRecommended: s.isRecommended,
    impacts: s.impacts,
    actions: [],
  }));
}

export async function generateMessage(
  params: GenerateMessageParams,
  signal?: AbortSignal
): Promise<string> {
  const { alert, solution, recipientRelation, tone } = params;

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: MESSAGE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `
            Situation: ${alert.title}
            Solution chosen: ${solution.description}
            Recipient: ${recipientRelation}
            Tone: ${tone}

            Generate a message to ask for help with this task.
          `,
        },
      ],
      temperature: 0.7,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}
