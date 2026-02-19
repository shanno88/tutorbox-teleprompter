import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import paddleRouter from './routes/paddle.js';
import { convertScriptToKling } from './utils/mapToKling.js';

const app = express();
const PORT = 3001;

// 中间件配置
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(cookieParser());

// --- 解析播感标注文本为 JSON 结构的函数 ---
/**
 * 解析口播脚本文本，生成结构化 JSON
 * @param {string} text - 原始台词文本
 * @returns {object} - 符合 schema 的脚本 JSON 对象
 */
function parseScriptText(text) {
  // 按编号（①②③④⑤⑥⑦⑧⑨⑩）切分段落，不依赖 || 分隔符
  const paragraphs = text.split(/(?=[①②③④⑤⑥⑦⑧⑨⑩])/).map(p => p.trim()).filter(p => p.length > 0);

  const segments = [];
  let totalDuration = 0;

  paragraphs.forEach((para, index) => {
    const segmentId = `s${index + 1}`;

    // 1. 先去掉段落开头的所有引号、空格，方便匹配
    let workingText = para.trim().replace(/^[""\s]+/, '');

    // 2. 匹配结构标题（① 放钩子（约5秒）这种格式）
    // 注意：要兼容中英文括号
    const sectionMatch = workingText.match(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*[^（(]*[（(][^）)]*[）)]/);

    let section;
    let contentText;

    if (sectionMatch) {
      // 匹配成功：提取 section，删除它后剩下的是 contentText
      section = sectionMatch[0].trim();
      contentText = workingText.substring(sectionMatch[0].length).trim();
    } else {
      // 匹配失败：用兜底名称，contentText 就是整个工作文本
      section = `段落 ${index + 1}`;
      contentText = workingText;
    }

    // 4. 提取播感标注并记录位置
    const marks = [];
    let cleanText = contentText;
    let offset = 0; // 用于跟踪删除标注后的位置偏移

    // 处理强调标注 *文字*（要先处理，避免后面位置计算出错）
    const emphasisRegex = /\*([^*]+)\*/g;
    let emphasisMatch;
    const emphasisMatches = [];
    while ((emphasisMatch = emphasisRegex.exec(contentText)) !== null) {
      emphasisMatches.push({
        fullMatch: emphasisMatch[0],
        text: emphasisMatch[1],
        index: emphasisMatch.index
      });
    }

    // 从后往前替换，避免位置偏移问题
    for (let i = emphasisMatches.length - 1; i >= 0; i--) {
      const match = emphasisMatches[i];
      const positionInClean = match.index - offset;

      marks.push({
        type: 'emphasis',
        position: positionInClean,
        text: match.text
      });

      // 用纯文字替换 *文字*，只删除星号
      cleanText = cleanText.substring(0, match.index) +
                  match.text +
                  cleanText.substring(match.index + match.fullMatch.length);

      offset += 2; // 删除了两个星号
    }

    // 处理其他单字符标注（|、↑、↓）
    const controlMarks = [
      { symbol: '|', type: 'short_pause' },
      { symbol: '↑', type: 'rise' },
      { symbol: '↓', type: 'fall' }
    ];

    controlMarks.forEach(({ symbol, type }) => {
      let index = cleanText.indexOf(symbol);
      while (index !== -1) {
        marks.push({
          type: type,
          position: index
        });

        // 删除标注符号
        cleanText = cleanText.substring(0, index) + cleanText.substring(index + 1);

        // 继续查找下一个
        index = cleanText.indexOf(symbol);
      }
    });

    // 5. 清理多余空格和换行
    cleanText = cleanText.replace(/\s+/g, ' ').trim();

    // 5.1. 彻底清理首尾引号（包含所有中英文引号）
    cleanText = cleanText.replace(/^[\u201c\u201d\u2018\u2019"'"`]+/, '');  // 去开头
    cleanText = cleanText.replace(/[\u201c\u201d\u2018\u2019"'"`]+$/, '');  // 去结尾
    cleanText = cleanText.trim();

    // 6. 估算时长（每10个汉字约2秒，粗略计算）
    const chineseCharCount = (cleanText.match(/[\u4e00-\u9fa5]/g) || []).length;
    const durationHint = Math.max(5, Math.ceil(chineseCharCount / 5));
    totalDuration += durationHint;

    // 7. 按 position 排序 marks
    marks.sort((a, b) => a.position - b.position);

    segments.push({
      id: segmentId,
      role: 'narrator',
      section: section,
      duration_hint: durationHint,
      raw_text: cleanText,
      marks: marks
    });
  });

  // 8. 构建完整 JSON 对象
  return {
    title: '智能口播提词稿',
    version: '1.0',
    created_at: new Date().toISOString(),
    exported_by: 'ai-teleprompter',
    metadata: {
      total_duration_hint: totalDuration,
      segment_count: segments.length,
      language: 'zh-CN'
    },
    segments: segments
  };
}

// --- 文本清洗函数 ---

/**
 * 清洗导出用文本：去掉外层引号
 * @param {string} text - 原始文本
 * @returns {string} - 清洗后的文本
 */
function cleanRawText(text) {
  if (!text) return '';
  let t = text.trim();
  // 去掉开头和结尾的中英文引号
  t = t.replace(/^["""'`]+/, '').replace(/["""'`]+$/, '');
  return t.trim();
}

/**
 * 去除行首的结构标题和时长说明
 * @param {string} text - 原始文本
 * @returns {string} - 去掉结构前缀后的文本
 */
function stripStructurePrefix(text) {
  return text
    // 去掉行首编号 + 结构标题 + 时长（例如：① 留人（约3秒））
    .replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*[^（(]*[（(][^）)]*[）)]\s*/, '')
    .trim();
}

// 在 Express 路由中使用
app.post('/api/export-json', (req, res) => {
  const { content } = req.body;

  if (!content || content.trim().length === 0) {
    return res.status(400).json({
      error: '台词区域没有内容，无法导出 JSON。请先在台词区域输入台词。'
    });
  }

  try {
    const scriptJson = parseScriptText(content);
    res.json(scriptJson);
  } catch (error) {
    console.error('解析脚本失败:', error);
    res.status(500).json({
      error: '解析脚本时发生错误，请检查文本格式。'
    });
  }
});

// POST /api/export-kling - 导出 Kling multi-shot 请求体
app.post('/api/export-kling', (req, res) => {
  const { content } = req.body;

  if (!content || content.trim().length === 0) {
    return res.status(400).json({
      error: '台词区域没有内容，无法导出 Kling 请求。'
    });
  }

  try {
    const scriptJson = parseScriptText(content);
    const klingRequest = convertScriptToKling(scriptJson);
    res.json(klingRequest);
  } catch (error) {
    console.error('生成 Kling 请求失败:', error);
    res.status(500).json({
      error: '生成 Kling 请求时发生错误，请检查脚本格式。'
    });
  }
});

// POST /api/export-word - 导出 Word 文档
app.post('/api/export-word', async (req, res) => {
  try {
    const { content, title } = req.body;

    // 验证请求参数
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Invalid content parameter' });
    }

  // 按行分割内容，保留段落格式
  const lines = content.split('\n').filter(line => line.trim());

  // 【新增】标记替换函数：把播感标记替换成符号
  // [短停] → ⏸  |  [上扬] → ↗  |  [收尾] → ✓
  const replaceMarks = (line) => {
    return line
      .replace(/\[短停\]/g, '⏸')       // [短停] → ⏸
      .replace(/\[长停\]/g, '⏸⏸')      // [长停] → ⏸⏸
      .replace(/\[上扬\]/g, '↗')        // [上扬] → ↗
      .replace(/\[收尾\]/g, '✓')         // [收尾] → ✓
      .replace(/\[重音\]/g, '★')        // [重音] → ★
      .replace(/\[强调\]/g, '★');       // [强调] → ★
  };

  // 创建文档对象
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // 标题
        new Paragraph({
          text: title || '智能口播提词稿',
          heading: HeadingLevel.HEADING_1,
          spacing: {
            after: 400,
          },
          alignment: AlignmentType.CENTER,
        }),

        // 分隔线（用空段落模拟）
        new Paragraph({
          text: '',
          border: {
            bottom: {
              color: '000000',
              space: '1',
              style: 'single',
              size: 6,
            },
          },
          spacing: {
            before: 200,
            after: 400,
          },
        }),

        // 【修改】正文内容：先替换标记，再写入 Word，统一使用普通正文样式
        ...lines.map(rawLine => {
          const withMarks = replaceMarks(rawLine);       // 1. 播感标记替换
          const noQuote = cleanRawText(withMarks);       // 2. 去掉外层引号
          const line = stripStructurePrefix(noQuote);    // 3. 去掉 ① 留人（约3秒） 这类结构

          return new Paragraph({
            children: [
              new TextRun({
                text: line,
                font: '宋体',
                size: 24, // 12pt
                color: '000000',
              }),
            ],
            spacing: {
              before: 100,
              after: 100,
            },
            alignment: AlignmentType.LEFT,
            indent: {
              firstLine: 480, // 首行缩进 2 字符
            },
          });
        }),

          // 底部信息
          new Paragraph({
            children: [
              new TextRun({
                text: '\n\n--- 由智能口播提词器生成 ---',
                font: '微软雅黑',
                size: 18, // 9pt
                color: '999999',
                italics: true,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: {
              before: 800,
            },
          }),
        ],
      }],
    });

    // 生成 Word 文档缓冲区
    const buffer = await Packer.toBuffer(doc);

    // 设置响应头
    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = encodeURIComponent(`智能口播提词稿_${dateStr}.docx`);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', buffer.length);

    // 返回二进制文件流
    res.send(buffer);
  } catch (error) {
    console.error('Export Word Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Export server is running', endpoints: ['/api/export-word', '/api/export-json', '/api/export-kling'] });
});

// Paddle 路由
app.use('/api/paddle', paddleRouter);

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Export Server is running on http://localhost:${PORT}`);
  console.log(`📝 API endpoints:`);
  console.log(`   - http://localhost:${PORT}/api/export-word (Word 文档)`);
  console.log(`   - http://localhost:${PORT}/api/export-json (JSON 结构化)`);
  console.log(`   - http://localhost:${PORT}/api/export-kling (Kling multi-shot 请求)`);
  console.log(`   - http://localhost:${PORT}/api/paddle/status (订阅状态)`);
  console.log(`   - http://localhost:${PORT}/api/paddle/webhook (Paddle Webhook)`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n👋 Export Server is shutting down gracefully...');
  process.exit(0);
});
