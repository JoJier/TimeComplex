import { NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

// MiniMax configuration
const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
const MINIMAX_URL = "https://api.minimax.chat/v1/text/chatcompletion_v2";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const type = formData.get('type');
    let textContent = "";

    if (type === 'text') {
      textContent = formData.get('content');
    } else if (type === 'url') {
      const url = formData.get('content');
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      $('script, style, nav, footer').remove();
      textContent = $('body').text().replace(/\s+/g, ' ').trim();
    } else if (type === 'file') {
      const file = formData.get('file');
      const buffer = Buffer.from(await file.arrayBuffer());
      
      if (file.name.endsWith('.pdf')) {
        const parser = new PDFParse({ data: buffer });
        const data = await parser.getText();
        textContent = data.text;
        await parser.destroy();
      } else if (file.name.endsWith('.docx')) {
        const data = await mammoth.extractRawText({ buffer });
        textContent = data.value;
      } else {
        textContent = buffer.toString('utf-8');
      }
    }

    if (!textContent || textContent.length < 10) {
      return NextResponse.json({ success: false, message: "内容太短，无法提取事件。" }, { status: 400 });
    }

    const prompt = `
【事件定义】 
事件 = 在某一时间点发生的具体行为或变化（如：发布、成立、签约、事故、政策出台、上线、去世等）。 
❌ 不包括：背景描述、观点评论、泛化总结、长期状态 

--- 

【强制规则】 

1. 【完整性优先】 
必须提取文本中所有符合“事件定义”的独立事件，不能遗漏。 
尤其注意： 
- 同一段中的多个动作（如“签约并启动项目”应拆为两个事件） 
- 隐含事件（如“随后”“之后”“同年”等指代） 

--- 

2. 【时间规则（极其重要）】 
- 必须输出标准格式：YYYY-MM-DD 
- 优先使用文本中明确时间 
- 若缺失： 
  - 可根据上下文推断（如“同年3月”→补全年份） 
  - 可合理补全缺失日（默认01） 
- 若无法推断到“年”，则必须丢弃该事件 
❗禁止使用当前日期或虚构时间 

--- 

3. 【事件拆分规则】 
以下情况必须拆分为多个事件： 
- “A并B” 
- “先A后B” 
- “A，同时B” 
- 多个主语行为 

--- 

4. 【去重规则】 
- 语义相同或高度重复的事件只保留一个 
- 不同时间但相似事件必须保留 

--- 

5. 【描述规则（label）】 
- 不超过20字 
- 必须是“动宾结构”或“明确动作” 
✅ 示例：发布iPhone、公司成立、签署协议 
❌ 示例：重要里程碑、发展迅速 

--- 

6. 【排序规则】 
- 按时间升序排列（从早到晚） 

--- 

7. 【输出格式（严格要求）】 
- 仅输出 JSON 数组 
- 不允许任何解释或多余文字 

格式如下： 
[ 
{"time": "2024-01-01", "label": "事件1"}, 
{"time": "2024-02-01", "label": "事件2"} 
] 

--- 

8. 【空结果规则】 
若无符合条件事件，输出： 
[] 

--- 

【待分析文本】 
${textContent.substring(0, 8000)}
    `;

    const response = await axios.post(
      MINIMAX_URL,
      {
        model: "abab6.5s-chat", // 使用标准模型，更稳定
        messages: [
          { role: "system", content: "你是一个纯粹的 JSON 数据提取引擎。不要说话，只输出 JSON 数组格式的结果。不要输出Markdown代码块，直接输出数组本身。" },
          { role: "user", content: prompt }
        ]
      },
      {
        headers: {
          "Authorization": `Bearer ${MINIMAX_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log('MiniMax Response:', JSON.stringify(response.data));

    if (!response.data || !response.data.choices || response.data.choices.length === 0) {
      throw new Error(`MiniMax API 返回异常`);
    }

    const aiResponse = response.data.choices[0].message.content;
    
    let events = [];
    try {
      // Use regex to extract the JSON array part more robustly
      const jsonMatch = aiResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        events = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback to old method if regex fails
        const cleaned = aiResponse.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        events = Array.isArray(parsed) ? parsed : (parsed.events || []);
      }
    } catch (err) {
      console.error("JSON Parse Error. AI Response was:", aiResponse);
      console.error("JSON Parse Error:", err);
      throw new Error("AI 返回格式解析失败，请尝试简化输入内容。");
    }

    return NextResponse.json({ success: true, events });
  } catch (error) {
    console.error('AI Error:', error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
