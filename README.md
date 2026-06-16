# 实现说明
项目名 FigBridge，取"设计到代码的桥梁"之意。整个系统分为四层：

## 架构概览

##  关键设计决策
* 数据精简：Figma 原始 API 返回 200+ 字段，插件层只提取 AI 需要的 ~20 个核心字段，减少 95% 数据量
* 双协议接入：同时支持 MCP Server（Cursor/Windsurf）和 REST Skill URL（Claude Code），覆盖主流 AI 编码工具
* Skill 端点自动生成：推送设计快照后自动创建可访问的 Skill URL，开发者只需将 URL 配置到 AI 工具即可
* 增量更新：设计变更后重新推送，Skill 端点自动刷新缓存，无需重新配置

## 在线预览
地址： https://hzs0623.github.io/FigBridge

