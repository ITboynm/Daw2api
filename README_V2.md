# Droid2API v2.0 - 多密钥管理版本

## 🎉 项目概述

Droid2API v2.0 是一个功能完整的 OpenAI 兼容 API 代理服务，支持：
- ✅ 多 Factory API Key 管理和自动切换
- ✅ 客户端 API Key 认证系统
- ✅ 完整的使用统计和费用计算
- ✅ 美观易用的 Web 管理后台
- ✅ 智能的代理轮询和故障切换
- ✅ 详细的日志记录和错误追踪

## 🚀 快速开始

### 1. 安装
```bash
npm install
```

### 2. 配置
编辑 `config.json`：
```json
{
  "port": 3000,
  "admin_username": "admin",
  "admin_password": "your_password"
}
```

### 3. 启动
```bash
npm start
```

### 4. 访问管理后台
打开浏览器：`http://localhost:3000/admin/admin.html`

使用配置的管理员账号密码登录。

### 5. 配置 Keys
1. 在"Factory Keys"页面添加你的 Factory API Keys
2. 在"API Keys"页面创建客户端使用的 API Keys

### 6. 使用 API
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## 📋 核心功能

### 多密钥管理
- 支持添加无限个 Factory Keys
- 自动轮询使用，负载均衡
- 智能故障切换：
  - **无代理**：失败3次切换下一个 key
  - **有代理**：每个代理重试3次，尝试3个代理（共9次）后切换 key

### API 认证
- 每个客户端使用独立的 API Key
- 可设置每日请求限制
- 支持启用/禁用控制

### 使用统计
- 实时追踪所有请求
- 记录 tokens 使用量（输入/输出）
- 自动计算费用（基于官方价格）
- 按模型、按日期、按 API Key 统计

### Web 管理后台
- 📊 仪表板：实时数据总览
- 🔑 Factory Keys 管理
- 🔐 API Keys 管理
- 🌐 代理配置
- 📈 使用统计
- 📝 错误日志

## 📁 项目结构

```
droid2api/
├── server.js                 # 主服务器
├── routes.js                # API 路由
├── admin-routes.js          # 管理后台路由
├── config.js/json           # 配置系统
├── auth.js                  # 认证系统
├── api-key-auth.js          # API Key 认证
├── factory-key-manager.js   # Factory Key 管理
├── usage-tracker.js         # 使用统计
├── pricing.js               # 价格计算
├── data-store.js            # 数据存储
├── proxy-manager.js         # 代理管理
├── logger.js                # 日志系统
├── public/                  # 管理后台前端
│   ├── admin.html
│   └── admin.js
├── data/                    # 数据文件（运行时生成）
│   ├── factory-keys.json
│   ├── api-keys.json
│   ├── usage-log.json
│   └── error-log.json
└── transformers/            # 请求/响应转换器
```

## 🔧 详细文档

- **[INSTALL.md](INSTALL.md)** - 完整的安装和配置指南
- **[USAGE.md](USAGE.md)** - 详细的使用说明
- **[CHANGELOG.md](CHANGELOG.md)** - 更新日志和迁移指南

## 🛡️ 安全建议

1. **修改默认密码**：首次部署务必修改 admin 密码
2. **限制管理后台访问**：使用 nginx 限制 IP 访问
3. **使用 HTTPS**：生产环境使用 SSL/TLS
4. **定期备份**：备份 `data/` 目录

## 📊 管理后台截图

访问 `http://localhost:3000/admin/admin.html` 查看：
- 仪表板统计
- Factory Keys 管理界面
- API Keys 管理界面
- 使用统计图表
- 错误日志查看

## 🔄 故障切换逻辑

### 无代理模式
```
请求失败 → 重试3次 → 失败 → 切换下一个 Key
```

### 代理模式
```
代理1 失败 → 重试3次 → 失败
  ↓
代理2 失败 → 重试3次 → 失败
  ↓
代理3 失败 → 重试3次 → 失败
  ↓
切换下一个 Factory Key
```

## 💡 使用场景

1. **团队协作**：多个团队成员共享 Factory Keys，使用独立的 API Keys
2. **多项目管理**：不同项目使用不同的 API Keys，独立统计费用
3. **高可用性**：多个 Factory Keys 自动切换，确保服务稳定
4. **成本控制**：实时查看每个项目的费用，设置请求限制

## 🎯 API 端点

### 客户端 API（需要 API Key）
- `GET /v1/models` - 获取模型列表
- `POST /v1/chat/completions` - Chat Completions（带格式转换）
- `POST /v1/responses` - 直接转发 OpenAI 请求
- `POST /v1/messages` - 直接转发 Anthropic 请求
- `POST /v1/messages/count_tokens` - Anthropic Token 计数

### 管理后台 API（需要管理员认证）
- `GET /api/admin/dashboard` - 仪表板数据
- `GET /api/admin/factory-keys` - Factory Keys 列表
- `POST /api/admin/factory-keys` - 添加 Factory Key
- `GET /api/admin/api-keys` - API Keys 列表
- `POST /api/admin/api-keys` - 添加 API Key
- `GET /api/admin/stats` - 使用统计
- `GET /api/admin/logs/errors` - 错误日志

完整 API 文档请访问管理后台。

## 🌟 特色功能

1. **零配置开箱即用**：启动后通过 Web 界面配置即可
2. **实时监控**：管理后台每30秒自动刷新数据
3. **智能重试**：根据是否配置代理，自动选择最优重试策略
4. **费用透明**：基于官方价格实时计算费用
5. **灵活限制**：可为每个 API Key 设置不同的速率限制

## 📞 技术支持

- 查看错误日志：`data/error-log.json`
- 管理后台日志页面
- 控制台输出

## 📜 许可证

MIT License

## 🙏 致谢

基于原版 droid2api 项目进行二次开发。

---

**版本**：v2.0.0  
**更新日期**：2025-10-29  
**作者**：[Your Name]

