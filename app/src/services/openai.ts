import type { Solution } from '../types';
import { MOCK_CONFLICT_CONTEXT } from '../data/mockData';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

const SYSTEM_PROMPT = `你是一個家庭協調助手。根據給定的行程衝突，生成 2-3 個實用的解決方案。

對於每個解決方案：
1. 用一句話描述需要做什麼
2. 列出影響（正面和負面）
3. 評估穩定性（成功的可能性）

請用繁體中文回答，並以 JSON 格式回應：
{
  "solutions": [
    {
      "id": "a",
      "label": "解法 A（最穩定）",
      "description": "描述...",
      "isRecommended": true,
      "impacts": ["影響1", "影響2"],
      "stabilityScore": 0.9
    }
  ]
}`;

export async function generateSolutions(): Promise<Solution[]> {
  // If no API key, return mock solutions
  if (!OPENAI_API_KEY) {
    console.log('No OpenAI API key, using mock solutions');
    return getMockSolutions();
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(MOCK_CONFLICT_CONTEXT) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = JSON.parse(data.choices[0].message.content);

    return content.solutions.map((s: any) => ({
      id: s.id,
      label: s.label,
      description: s.description,
      isRecommended: s.isRecommended || false,
      impacts: s.impacts || [],
      actions: [],
    }));
  } catch (error) {
    console.error('Failed to generate solutions:', error);
    return getMockSolutions();
  }
}

export async function generateMessage(solution: Solution): Promise<string> {
  // If no API key, return mock message
  if (!OPENAI_API_KEY) {
    return getMockMessage(solution);
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `你是一個家庭溝通助手。請生成一條溫暖、不對立的訊息，用繁體中文請求家人幫忙。
訊息要求：
- 保持在 100 字以內
- 語氣溫和、感謝
- 清楚說明需要什麼幫助
- 不要讓對方感到被責怪`,
          },
          {
            role: 'user',
            content: `衝突情況：${JSON.stringify(MOCK_CONFLICT_CONTEXT)}
選擇的解法：${solution.description}
請生成一條給另一半的訊息。`,
          },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Failed to generate message:', error);
    return getMockMessage(solution);
  }
}

function getMockSolutions(): Solution[] {
  return [
    {
      id: 'a',
      label: '解法 A（最穩定）',
      description: '請另一半晚 30 分鐘外出，順路接小孩',
      isRecommended: true,
      impacts: [
        '✓ 你的會議不受影響',
        '✓ 孩子準時被接',
        '△ 另一半需要調整計畫',
      ],
      actions: [],
    },
    {
      id: 'b',
      label: '解法 B',
      description: '你提前 15 分鐘離開會議去接小孩',
      isRecommended: false,
      impacts: [
        '△ 會議需要提前說明',
        '✓ 不需要麻煩別人',
        '✗ 你會比較趕',
      ],
      actions: [],
    },
    {
      id: 'c',
      label: '解法 C',
      description: '請阿公阿嬤幫忙接小孩',
      isRecommended: false,
      impacts: [
        '✓ 你和另一半都不用調整',
        '△ 需要長輩配合',
        '△ 需要提前聯繫確認',
      ],
      actions: [],
    },
  ];
}

function getMockMessage(solution: Solution): string {
  if (solution.id === 'a') {
    return `老公/老婆，我看到今天 17:30 接小孩有衝突 😅

我的會議延到 18:00，你能晚 30 分鐘出門，先去幼兒園接一下嗎？

這樣我這邊會議照開，小孩也不用等太久。謝謝你～❤️`;
  }
  return `關於今天接小孩的事，我想了一個方案：${solution.description}

你覺得這樣可以嗎？`;
}
