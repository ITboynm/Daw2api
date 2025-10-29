# Droid2API 使用说明

## 概述

Droid2API 是一个支持多密钥管理、使用统计和Web管理后台的 OpenAI 兼容 API 代理服务。

## 主要功能

### 1. 多 Factory API Key 管理
- 支持添加多个 Factory API Keys
- 自动轮询使用
- 智能故障切换：
  - **无代理模式**：失败3次后切换到下一个 key
  - **代理模式**：每个代理重试3次，尝试3个代理后（共9次失败）才切换 key

### 2. API 认证系统
- 客户端需要通过 API Key 才能访问接口
- 支持 `Authorization: Bearer <key>` 或 `x-api-key: <key>` header
- 可设置每日请求限制

### 3. 使用统计
- 实时追踪每个 API Key 的使用情况
- 统计请求数、tokens 使用量
- 自动计算费用（基于官方价格）
- 按模型、按日期统计

### 4. Web 管理后台
- 直观的仪表板
- Factory Keys 管理
- API Keys 管理
- 代理配置
- 使用统计查看
- 错误日志查看

## 配置

### config.json

```json
{
  "port": 3000,
  "admin_username": "admin",
  "admin_password": "admin123",
  "proxies": [
    {"url": "http://proxy1.com:8080", "name": "代理1"},
    {"url": "http://proxy2.com:8080", "name": "代理2"}
  ],
  ...
}
```

**重要配置项：**
- `admin_username`: 管理后台用户名
- `admin_password`: 管理后台密码
- `proxies`: 代理服务器列表（可选）

也可以通过环境变量设置：
```bash
export ADMIN_USERNAME=admin
export ADMIN_PASSWORD=your_secure_password
```

## 启动服务

```bash
npm install
npm start
```

服务启动后会显示：
- API 接口地址
- 管理后台地址

## 管理后台使用

### 访问

浏览器打开：`http://localhost:3000/admin/admin.html`

首次访问需要输入管理员账号密码（在 config.json 中配置）。

### Factory Keys 管理

1. **添加 Key**
   - 点击"添加 Key"按钮
   - 输入 Factory API Key
   - 输入名称（可选，便于识别）

2. **查看状态**
   - 活跃：正常使用中
   - 失败：已失效
   - 禁用：手动禁用

3. **管理操作**
   - 启用/禁用 Key
   - 删除 Key
   - 重置所有失败计数

### API Keys 管理

1. **添加 API Key**
   - 点击"添加 Key"按钮
   - 输入自定义的 API Key（客户端将使用此 key）
   - 输入名称
   - 设置每日请求限制（0 为不限制）

2. **查看统计**
   - 每个 Key 的今日请求数
   - 今日费用
   - 点击"统计"按钮查看详细信息

3. **管理操作**
   - 启用/禁用 Key
   - 删除 Key

### 代理配置

在代理配置页面可以直接编辑 JSON 格式的代理列表：

```json
[
  {"url": "http://proxy1.com:8080", "name": "代理1"},
  {"url": "http://proxy2.com:8080", "name": "代理2"},
  {"url": "http://proxy3.com:8080", "name": "代理3"}
]
```

保存后需要重启服务以生效。

### 使用统计

查看：
- 总请求数
- Token 使用量（输入/输出）
- 总费用
- 按模型分类的详细统计

### 日志查看

实时查看错误日志，包括：
- Factory Key 失败记录
- API 请求错误
- 系统错误

## 客户端使用

### 使用 API Key 调用接口

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_api_key_here" \
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

或使用 x-api-key header：

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_api_key_here" \
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### OpenAI SDK 配置

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",
    api_key="your_api_key_here"
)

response = client.chat.completions.create(
    model="claude-sonnet-4-5",
    messages=[{"role": "user", "content": "Hello"}]
)
```

## 故障切换逻辑

### 无代理模式
1. 请求失败
2. 同一个 key 重试（最多3次）
3. 3次失败后，该 key 标记为失败，切换到下一个 key

### 代理模式
1. 使用代理1请求失败
2. 代理1重试（最多3次）
3. 3次失败后切换到代理2
4. 代理2重试（最多3次）
5. 3次失败后切换到代理3
6. 代理3重试（最多3次）
7. 总共9次失败后，该 key 标记为失败，切换到下一个 key

## 数据存储

所有数据存储在 `data/` 目录：
- `factory-keys.json`: Factory Keys 数据
- `api-keys.json`: API Keys 数据
- `usage-log.json`: 使用日志（最近10000条）
- `error-log.json`: 错误日志（最近5000条）

## 安全建议

1. **修改默认密码**
   - 首次部署时务必修改 admin_username 和 admin_password

2. **保护管理后台**
   - 建议使用 nginx 等反向代理限制管理后台访问
   - 只允许特定 IP 访问管理后台

3. **使用 HTTPS**
   - 生产环境建议使用 HTTPS

4. **定期备份**
   - 定期备份 `data/` 目录

## 常见问题

### Q: 如何添加第一个 Factory Key？
A: 启动服务后，访问管理后台 → Factory Keys → 添加 Key

### Q: API Key 认证失败？
A: 确保在管理后台的 API Keys 中添加了该 key，并且状态为"启用"

### Q: 所有 Factory Keys 都失败了怎么办？
A: 系统会自动重置所有 key 的失败计数并重新尝试。也可以在管理后台手动点击"重置所有失败"

### Q: 如何查看费用统计？
A: 管理后台 → 使用统计，可以查看总费用和按模型分类的费用

### Q: 代理配置如何生效？
A: 修改代理配置后需要重启服务

## 版本更新

### v2.0.0
- ✨ 新增多 Factory Key 管理
- ✨ 新增 API Key 认证系统
- ✨ 新增使用统计和费用计算
- ✨ 新增 Web 管理后台
- ✨ 新增智能故障切换（代理轮询）
- ✨ 新增错误日志系统

### v1.x.x
- 基础代理功能
- 单一 Factory Key 支持

