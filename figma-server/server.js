const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3333;

const STORAGE_DIR = path.join(__dirname, 'storage');
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

app.use(cors({
  origin: (origin, callback) => callback(null, true),
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// 因为带有 Base64 图片，调大体积上限至 100mb 确保安全
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

/**
 * 🧱 接口 1: 【生成阶段 - 文件夹结构化落盘】
 */
app.post('/api/generate', (req, res) => {
  try {
    const { nodes, previewImage } = req.body;
    if (!nodes) {
      return res.status(400).json({ success: false, message: '未收到有效的节点数据' });
    }

    // 1. 创建属于这次 Skill 任务的独立文件夹
    const skillId = `skill_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const taskDir = path.join(STORAGE_DIR, skillId);
    fs.mkdirSync(taskDir, { recursive: true });

    // 2. 【保存兜底图片】：如果有预览图，解密 Base64 并存为 preview.png
    if (previewImage) {
      const imageBuffer = Buffer.from(previewImage, 'base64');
      fs.writeFileSync(path.join(taskDir, 'preview.png'), imageBuffer);
      console.log(`🖼️  [视觉兜底] 成功生成预览图: preview.png`);
    }

    // 3. 【抽取独立 SVG 资产】：遍历节点树，将所有 SVG 独立抽离到一个专属文件夹
    const svgDir = path.join(taskDir, 'svg_assets');
    fs.mkdirSync(svgDir, { recursive: true });
    
    // 递归提取器
    function extractSvgs(nodeList) {
      nodeList.forEach(node => {
        if (node.svgString) {
          // 清理不合法的节点名作为文件名
          const safeName = node.name.replace(/[/\\?%*:|"<>\s]/g, '_');
          const svgFileName = `layer_${node.id.replace(/:/g, '_')}_${safeName}.svg`;
          fs.writeFileSync(path.join(svgDir, svgFileName), node.svgString, 'utf8');
        }
        if (node.children && node.children.length > 0) {
          extractSvgs(node.children);
        }
      });
    }
    extractSvgs(nodes);

    // 4. 【保存 JSON 数据】：写入 data.json
    const fileContent = {
      skillId,
      createdAt: new Date().toISOString(),
      nodes
    };
    fs.writeFileSync(path.join(taskDir, 'data.json'), JSON.stringify(fileContent, null, 2), 'utf8');

    // 5. 返回消费 Skill 链接
    const protocol = req.protocol;
    const host = req.get('host');
    const skillUrl = `${protocol}://${host}/api/skills/${skillId}`;

    console.log(`📂 [资产打包成功] 文件夹已建立: ${skillId}\n`);
    return res.json({ success: true, skillUrl });

  } catch (error) {
    console.error('❌ 服务器错误:', error);
    res.status(500).json({ success: false, message: '服务器异常' });
  }
});

/**
 * 🔄 接口 2: 【消费拉取阶段】
 * 消费端 GET 请求时，不仅能拿到 nodes，我们把结构也优雅地返还回去
 */
app.get('/api/skills/:id', (req, res) => {
  const skillId = req.params.id;
  const taskDir = path.join(STORAGE_DIR, skillId);
  const jsonPath = path.join(taskDir, 'data.json');

  if (!fs.existsSync(jsonPath)) {
    return res.status(404).json({ success: false, message: '数据不存在' });
  }

  const rawData = fs.readFileSync(jsonPath, 'utf8');
  const parsed = JSON.parse(rawData);
  
  // 返回包含原始节点、创建时间等信息的完整大对象，方便 AI 自行解析
  return res.json({
    skillId: parsed.skillId,
    createdAt: parsed.createdAt,
    previewImageAvailable: fs.existsSync(path.join(taskDir, 'preview.png')),
    nodes: parsed.nodes
  });
});

app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 视觉多模态解耦服务器已就绪！(监听端口: ${PORT})`);
  console.log(`📦 正在采用多资产包结构组织落盘数据。`);
  console.log(`===================================================`);
});