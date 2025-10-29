# Daw2api 功能说明

## 🎯 核心功能

### 1. 批量添加 Factory Keys ✨ NEW

在管理后台的 "Factory Keys" 页面，点击"添加 Key"按钮后：

#### 单个添加模式（默认）
- 输入单个 Key
- 可选输入自定义名称

#### 批量添加模式
勾选"批量添加模式"后：

**输入字段：**
- **Keys**：每行一个 key，支持多行输入
  ```
  fac_key_xxxxx1
  fac_key_xxxxx2
  fac_key_xxxxx3
  ```

- **名称前缀**：自定义前缀（默认: Key）
  - 例如输入 `Production`

- **起始序号**：从几开始计数（默认: 1）
  - 例如输入 `10`

**自动生成名称规则：**
```
前缀-序号

示例：
输入 3 个 keys，前缀为 "Production"，起始序号为 1
生成：
- Production-1
- Production-2
- Production-3

输入 5 个 keys，前缀为 "Backup"，起始序号为 10
生成：
- Backup-10
- Backup-11
- Backup-12
- Backup-13
- Backup-14
```

#### 使用示例

**场景 1：添加生产环境的 10 个 keys**
```
Keys: 
fac_prod_key1
fac_prod_key2
...
fac_prod_key10

名称前缀: Prod
起始序号: 1

结果: Prod-1, Prod-2, ..., Prod-10
```

**场景 2：添加测试环境的 keys**
```
Keys:
fac_test_key1
fac_test_key2
fac_test_key3

名称前缀: Test
起始序号: 1

结果: Test-1, Test-2, Test-3
```

**场景 3：扩展现有 keys（续号）**
```
已有: Key-1 到 Key-20

新增 10 个:
名称前缀: Key
起始序号: 21

结果: Key-21, Key-22, ..., Key-30
```

### 2. 智能故障切换

#### 无代理模式
```
请求失败 → 同一 key 重试 3 次 → 失败 → 切换下一个 key
```

#### 代理模式（配置了代理）
```
代理1: 重试 3 次 → 失败
  ↓
代理2: 重试 3 次 → 失败
  ↓
代理3: 重试 3 次 → 失败
  ↓
总计 9 次失败后，切换到下一个 Factory Key
```

**优先级：** 代理轮询 > Key 切换

### 3. 完整的认证系统

#### 三层安全保护

**第一层：管理后台认证**
- 路径：`/login`, `/admin`
- 认证方式：用户名密码 + Token
- 用途：管理 Factory Keys 和 API Keys
- Token 有效期：
  - 普通登录：24 小时
  - 勾选"记住我"：7 天

**第二层：API Key 认证**
- 路径：所有 `/v1/*` 接口
- 认证方式：Bearer Token 或 x-api-key header
- 用途：客户端访问 API
- 可设置每日请求限制

**第三层：Factory Key**
- 自动管理，无需手动切换
- 支持多个 keys 轮询
- 自动故障切换

### 4. 使用统计和费用计算

#### 实时追踪
- 每个请求的 tokens 使用量（输入/输出）
- 响应时间
- 成功/失败状态

#### 自动计费
基于官方价格实时计算：
- Claude Opus 4.1: $15/M (input), $75/M (output)
- Claude Sonnet 4.5: $3/M (input), $15/M (output)
- Claude Haiku 4.5: $0.8/M (input), $4/M (output)
- GPT-5: $10/M (input), $30/M (output)

#### 统计维度
- 按 API Key 统计
- 按模型统计
- 按日期统计
- 按时间段查询

### 5. Web 管理后台

#### 仪表板
- Factory Keys 状态总览
- API Keys 使用情况
- 今日/本月费用统计
- 当前使用的 Factory Key

#### Factory Keys 管理
- ✅ 单个添加
- ✅ 批量添加（NEW）
- ✅ 启用/禁用
- ✅ 删除
- ✅ 查看统计（成功率、请求数）
- ✅ 重置失败计数

#### API Keys 管理
- 添加/删除/修改
- 设置每日请求限制
- 查看详细使用统计
- 启用/禁用控制

#### 代理配置
- 可视化编辑代理列表
- JSON 格式配置
- 支持多个代理轮询

#### 日志查看
- 实时错误日志
- Factory Key 失败记录
- API 请求错误

### 6. 安全特性

#### 访问控制
- ❌ 根路径 `/` 需要 API Key
- ❌ 所有 `/v1/*` 接口需要 API Key
- ✅ 管理后台需要登录
- ✅ 不暴露敏感信息

#### Token 管理
- 自动过期机制
- 定期清理过期 session
- 支持登出功能

#### 密码保护
- 管理员密码可配置
- 支持环境变量覆盖
- 启动时提醒修改默认密码

## 📊 数据存储

### 文件位置
```
data/
├── factory-keys.json      # Factory Keys 数据
├── api-keys.json          # API Keys 数据
├── usage-log.json         # 使用日志（最近10000条）
└── error-log.json         # 错误日志（最近5000条）
```

### 自动清理
- 使用日志：保留最近 10000 条
- 错误日志：保留最近 5000 条
- Session：自动清理过期的（每小时）

## 🚀 快速开始

### 1. 启动服务
```bash
npm start
```

### 2. 登录管理后台
```
http://localhost:3000/admin
默认账号: admin / admin123
```

### 3. 批量添加 Factory Keys
1. 进入 "Factory Keys" 页面
2. 点击 "添加 Key"
3. 勾选 "批量添加模式"
4. 粘贴你的 keys（每行一个）
5. 设置名称前缀（如：Prod）
6. 设置起始序号（如：1）
7. 点击 "批量添加"

### 4. 创建 API Keys
1. 进入 "API Keys" 页面
2. 点击 "添加 Key"
3. 输入自定义的 key（如：sk-prod-123456）
4. 设置名称和限制
5. 点击 "添加"

### 5. 使用 API
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer sk-prod-123456" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## 🔧 配置管理

### config.json
```json
{
  "port": 3000,
  "admin_username": "admin",
  "admin_password": "admin123",
  "proxies": [
    {"url": "http://proxy1.com:8080", "name": "代理1"},
    {"url": "http://proxy2.com:8080", "name": "代理2"}
  ]
}
```

### 环境变量
```bash
export ADMIN_USERNAME=your_admin
export ADMIN_PASSWORD=your_secure_password
```

## 📈 监控和维护

### 查看统计
- 仪表板：实时数据
- 使用统计：详细分析
- 错误日志：故障排查

### 性能优化
- 多 Factory Keys 负载均衡
- 代理轮询减少单点故障
- 自动重试机制

### 维护建议
1. 定期备份 `data/` 目录
2. 监控 Factory Keys 成功率
3. 检查错误日志
4. 及时修改默认密码
5. 合理设置 API Key 限制

## 🆕 最新更新

### v2.0.1
- ✨ 新增批量添加 Factory Keys 功能
- ✨ 支持自定义名称前缀和起始序号
- 🔒 增强安全性，根路径需要认证
- 🎨 优化启动日志显示
- 📝 项目重命名为 Daw2api

## 💡 使用技巧

### 批量添加最佳实践
1. **统一命名**：使用有意义的前缀，如环境名称
2. **分组管理**：生产、测试、开发环境分别使用不同前缀
3. **序号规划**：预留序号空间，便于后续扩展
4. **批量导入**：从文件复制粘贴，提高效率

### 故障排查
1. 查看错误日志页面
2. 检查 Factory Keys 状态
3. 查看 API Key 使用统计
4. 测试代理连接

## 🙋 常见问题

**Q: 批量添加后如何验证？**
A: 在 Factory Keys 列表中查看，每个 key 都会显示名称和状态。

**Q: 名称前缀可以包含特殊字符吗？**
A: 建议使用字母、数字和连字符，避免特殊字符。

**Q: 起始序号可以是 0 吗？**
A: 可以，但建议从 1 开始更直观。

**Q: 批量添加的 keys 数量有限制吗？**
A: 没有硬性限制，但建议单次不超过 100 个，避免界面卡顿。

**Q: 如何知道当前使用的是哪个 Factory Key？**
A: 在仪表板页面可以看到"当前 Factory Key"信息。

---

**版本**: v2.0.1  
**更新时间**: 2025-10-29  
**项目名称**: Daw2api

