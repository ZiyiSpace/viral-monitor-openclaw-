/**
 * 测试新的小红书发布稿结构提示词
 */

const GLM_API_KEY = '639a8ccb5e7a44a2afe4b11c2f315919.uukSQwgpJ5zQkpdY';

async function testNewPrompt() {
  const translatedText = `#PicoClaw：AI用几个小时就写出了代码，只用了#OpenClaw核心功能的1%代码和1%内存！别再用Mac Mini了——现在你可以在10美元的RISCV硬件上运行完整的AI助手，只要10MB内存就行~ 如果它能运行Linux，那现在就可以是你的个人AI代理了！`;

  const authorName = 'Sipeed';

  const prompt = `你是一名小红书科技博主（理性、信息密度高，不鸡汤）。基于给定的"已翻译推文"生成可发布的小红书笔记。

【已翻译的推文】（重要：content 第一段必须逐字逐行原样粘贴，包含换行）
${translatedText}

【推文作者】
${authorName}

【必须输出 JSON】禁止输出 JSON 之外的任何文字。JSON 结构必须严格为：
{
"title": "...",
"content": "...",
"tags": ["..."]
}

【content 拼接规则】
content 必须按以下顺序拼接（不要多/少任何段）：

(1) 第一段：原样粘贴【已翻译的推文】
(2) 空行
(3) 转自 twitter @${authorName}
(4) 空行
(5) 正文解读（写成流畅的小红书文案，不要用【】标题）
(6) 空行
(7) 标签串（与 tags 数组一致，用空格分隔，如：#OpenClaw #安全 ...）

【正文固定结构】（必须写成"可读的发布文案"，不要提纲格式）

第一段：钩子（80-120字，2-3行）
- 一句结论：这是什么/有什么用
- 为什么重要：数字/对比/反差（如"10美元硬件跑完整AI"）
- 口语化，有情绪

第二段：到底在吹什么（2-4行）
- 点名核心名词（OpenClaw、具体技术等）
- 用原文的具体数字/事实

第三段：对普通人意味着什么（2-4行）
- 实际好处：省钱/省事/便携/本地部署等
- 不要上价值，别讲空话

第四段：注意事项（1-2行）
- 引用原文的前提条件
- 不要编造，没有就不写

第五段：收尾（1行）
- 给行动点：关注/等demo/尝试/查看等

全文允许≤6个emoji，不要模板化，不要"风险：触发条件："这种格式。

【禁区补充】

禁止把"安全风险"当主轴，除非原推明确提到安全/被黑/漏洞等关键词。

禁止空泛：不要写"开源魅力/梦想/新世界大门/无限可能/程序员不易"。

【标题要求】≤30字，可带1-2个emoji，简洁有力，吸引点击。

【tags 要求】5-8个，必须包含#OpenClaw，其余从：#开源 #AI工具 #Claude #安全 #网络安全 #运维 #程序员 #GitHub #提示词 中选择。

现在开始，只输出 JSON。`;

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
  console.log('\n=== 格式化后 ===');

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

testNewPrompt().catch(console.error);
