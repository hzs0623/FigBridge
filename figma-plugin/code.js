figma.showUI(__html__, { width: 440, height: 550 });

figma.on("selectionchange", async () => {
  const selection = figma.currentPage.selection;
  
  if (selection.length === 0) {
    figma.ui.postMessage({ type: "SELECTION_CLEAR" });
    return;
  }

  // 1. 解析节点树属性
  const payload = await Promise.all(selection.map(async (node) => {
    return await processNode(node);
  }));

  // 2. 【核心优化】：将用户当前选中的整个区域，整体导出一张高清晰度 PNG 截图，用于视觉兜底
  let previewResponseBase64 = "";
  try {
    // 创建一个临时的组件或利用顶层节点合并导出，如果是多选，打包进一个临时 frame 导出
    let exportNode = selection[0];
    if (selection.length > 1) {
      // 如果选了多个，暂时以第一个为主，或者提示用户编组后再导出
    }
    
    // 导出 2 倍清晰度的 PNG
    const pngUint8 = await exportNode.exportAsync({ 
      format: "PNG",
      constraint: { type: "SCALE", value: 2 } 
    });
    
    // Uint8Array 转 Base64
    let binary = '';
    const len = pngUint8.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(pngUint8[i]);
    }
    previewResponseBase64 = btoa(binary);
  } catch (imgErr) {
    console.log("导出预览图失败:", imgErr);
  }

  // 将节点树和整张图的 Base64 一并送给 UI
  figma.ui.postMessage({ 
    type: "SELECTION_DATA", 
    data: payload,
    previewImage: previewResponseBase64 
  });
});

async function processNode(node) {
  let nodeData = {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: node.visible,
    locked: node.locked,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height
  };

  if ("fills" in node && node.fills !== figma.mixed) { nodeData.fills = node.fills; }
  if ("strokes" in node && node.strokes.length > 0) { nodeData.strokes = node.strokes; nodeData.strokeWeight = node.strokeWeight; }
  if (node.type === "TEXT") { nodeData.characters = node.characters; nodeData.fontSize = node.fontSize; nodeData.fontName = node.fontName; }
  if ("absoluteTransform" in node) { nodeData.absoluteTransform = node.absoluteTransform; }

  // 抽离并集成内联 SVG 字符串
  if (node.type === "VECTOR" || node.type === "FRAME" || node.type === "INSTANCE" || node.type === "GROUP") {
    try {
      const svgUint8 = await node.exportAsync({ format: "SVG" });
      if (typeof TextDecoder !== "undefined") {
        const decoder = new TextDecoder("utf-8");
        nodeData.svgString = decoder.decode(svgUint8);
      } else {
        nodeData.svgString = String.fromCharCode.apply(null, Array.from(svgUint8));
      }
    } catch (err) {
      nodeData.svgError = "Failed to export SVG";
    }
  }

  if ("children" in node) {
    nodeData.children = await Promise.all(node.children.map(child => processNode(child)));
  }

  return nodeData;
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === "SAVE_CONFIG") { await figma.clientStorage.setAsync("user_server_url", msg.url); figma.notify("✅ 服务器地址配置保存成功！"); }
  if (msg.type === "GET_CONFIG") { const savedUrl = await figma.clientStorage.getAsync("user_server_url"); figma.ui.postMessage({ type: "INIT_CONFIG", url: savedUrl || "" }); }
};