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
      请从以下文本中提取所有的关键历史事件点。
      
      【强制要求】：
      1. 务必提取出文本中提到的【所有】独立事件，不要只提取标题或发布时间，请深入正文提取具体的事件节点。
      2. 提取事件发生的时间（格式必须为：YYYY-MM-DD）。如果文本中没有明确写出年份或月份，请根据上下文推断；如果完全无法推断出具体日期，请忽略该事件（绝不能使用当天的日期替代！）。
      3. 提取事件的简洁描述（label），不超过 20 个字。
      4. 严格遵守以下 JSON 数组格式（不要输出任何开场白、解释、总结或其他文字，必须是一个合法的 JSON 数组）：
      [
        {"time": "2024-01-01", "label": "示例事件1"},
        {"time": "2024-02-15", "label": "示例事件2"}
      ]
      
      待分析文本：
      ${textContent.substring(0, 8000)}
    `;

    const response = await axios.post(
      MINIMAX_URL,
      {
        model: "abab6.5t-chat",
        messages: [
          { role: "system", content: "你是一个纯粹的 JSON 数据提取引擎。不要说话，只输出 JSON。" },
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
