/**
 * Test AI generation - 直译+解读格式（两步处理）
 */

import fs from 'fs';

const GLM_API_KEY = '639a8ccb5e7a44a2afe4b11c2f315919.uukSQwgpJ5zQkpdY';

async function translateText(text) {
  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GLM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'glm-4-flash',
      messages: [{
        role: 'user',
        content: `准确翻译以下英文推文成中文：\n\n${text}`
      }],
    }),
  });
  const data = await response.json();
  return data.choices[0].message.content.trim();
}

async function testAI() {
  const tweetText = `The funniest take is that I "failed" 43 times when people look at my GitHub repos and projects.

Uhmm... no? Most of these are part of @openclaw, I had to build an army to make it useful.`;

  const authorName = "Peter Steinberger";

  // Step 1: Translate
  console.log('=== 第一步：翻译 ===');
  const translatedText = await translateText(tweetText);
  console.log(translatedText);
  console.log();

  // Step 2: Generate post
  console.log('=== 第二步：生成文案 ===');
  const prompt = `你是一名小红书科技博主。基于以下**已翻译好**的推文，生成一篇小红书文案。

【已翻译的推文】
${translatedText}

【推文作者】${authorName}

**格式要求**：
1. 第一段：直接复制上面的翻译内容
2. 第二段：转自 twitter @作者名
3. 后面：深度解读（设问、对比、排比、升华）
4. 结尾：标签

请返回JSON：
{
  "title": "带emoji的标题",
  "content": "${translatedText}\\\\n\\\\n转自 twitter @${authorName}\\\\n\\\\n[深度解读内容，设问、对比、排比、升华]\\\\n\\\\n#OpenClaw #GitHub #开源 #程序员 #技术",
  "tags": ["#OpenClaw", "#GitHub", "#开源", "#程序员", "#技术"]
}

注意：
1. content第一段必须直接使用"已翻译的推文"，不要改动
2. 深度解读要结合OpenClow的背景，不要泛泛而谈
3. 标签要包含#OpenClaw及5-8个相关科技标签`;

  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GLM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'glm-4-flash',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  const content = data.choices[0].message.content;

  console.log('=== AI 原始响应 ===');
  console.log(content);
  console.log('\n=== 格式化后的内容 ===');

  // Parse JSON
  let jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
                  content.match(/```\s*([\s\S]*?)\s*```/) ||
                  content.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    let jsonStr = jsonMatch[1] || jsonMatch[0];
    jsonStr = jsonStr.replace(/^[^{]*/, '').replace(/[^}]*$/, '').trim();
    try {
      const parsed = JSON.parse(jsonStr);
      console.log('标题:', parsed.title);
      console.log('\n内容:');
      console.log(parsed.content);
    } catch (e) {
      console.error('解析失败:', e.message);
    }
  }
}

testAI().catch(console.error);
