# Daw2api

**Daw2api** 是 [droid2api](https://github.com/chenwr727/droid2api) 的增强版本，在原有功能基础上新增了多密钥管理、使用统计追踪、Web管理后台等企业级功能。

> 🚀 **相比原版新增功能**：
> - ✅ **多 Factory Key 管理** - 支持添加、管理多个 Factory API Key，自动轮询和故障切换
> - ✅ **API Key 管理系统** - 为不同用户/项目分配独立的 API Key，支持启用/禁用/删除
> - ✅ **每日调用限制** - 为每个 API Key 设置每日请求次数限制
> - ✅ **使用统计追踪** - 实时记录每个 API Key 的调用次数、成功率等统计数据
> - ✅ **Web 管理后台** - 美观易用的 Web 界面，可视化管理所有配置
> - ✅ **批量导入功能** - 支持批量导入 Factory Keys
> - ✅ **代理管理** - 支持配置多个代理服务器
> - ✅ **错误日志** - 详细的错误日志记录和查询

## 核心功能

### 🔐 双重授权机制
- **FACTORY_API_KEY优先级** - 环境变量设置固定API密钥，跳过自动刷新
- **令牌自动刷新** - WorkOS OAuth集成，系统每6小时自动刷新access_token
- **客户端授权回退** - 无配置时使用客户端请求头的authorization字段
- **智能优先级** - FACTORY_API_KEY > refresh_token > 客户端authorization
- **容错启动** - 无任何认证配置时不报错，继续运行支持客户端授权

### 🧠 智能推理级别控制
- **五档推理级别** - auto/off/low/medium/high，灵活控制推理行为
- **auto模式** - 完全遵循客户端原始请求，不做任何推理参数修改
- **固定级别** - off/low/medium/high强制覆盖客户端推理设置
- **OpenAI模型** - 自动注入reasoning字段，effort参数控制推理强度
- **Anthropic模型** - 自动配置thinking字段和budget_tokens (4096/12288/24576)
- **智能头管理** - 根据推理级别自动添加/移除anthropic-beta相关标识

### 🔑 多密钥管理系统（新增）
- **Factory Keys 管理** - 支持添加、编辑、删除多个 Factory API Key
- **自动轮询** - 多个 Key 之间自动轮询使用，提高可用性
- **故障切换** - Key 失败时自动切换到下一个可用的 Key
- **批量导入** - 支持批量导入多个 Factory Keys
- **状态监控** - 实时显示每个 Key 的状态、请求数、成功率

### 🎫 API Key 管理（新增）
- **独立 API Key** - 为不同用户/项目分配独立的访问密钥
- **调用限制** - 为每个 API Key 设置每日请求次数限制
- **启用/禁用** - 灵活控制每个 API Key 的状态
- **使用统计** - 查看每个 API Key 的调用次数、成功率

### 📊 使用统计追踪（新增）
- **实时统计** - 记录每个请求的调用信息
- **按日期统计** - 查看今日、本月、总体的使用数据
- **按模型统计** - 了解不同模型的使用情况和成功率
- **成功率监控** - 实时监控 API 调用的成功率

### 💻 Web 管理后台（新增）
- **美观的 UI** - 现代化的管理界面
- **Dashboard** - 一目了然的数据概览
- **Factory Keys 管理** - 可视化管理所有 Factory Keys
- **API Keys 管理** - 轻松管理所有 API Keys
- **统计数据** - 丰富的图表和统计信息
- **用户认证** - 管理后台需要登录才能访问

### 🚀 服务器部署/Docker部署
- **本地服务器** - 支持npm start快速启动
- **Docker容器化** - 提供完整的Dockerfile和docker-compose.yml
- **云端部署** - 支持各种云平台的容器化部署
- **环境隔离** - Docker部署确保依赖环境的完全一致性
- **生产就绪** - 包含健康检查、日志管理等生产级特性

### 💻 Claude Code直接使用
- **透明代理模式** - /v1/responses和/v1/messages端点支持直接转发
- **完美兼容** - 与Claude Code CLI工具无缝集成
- **系统提示注入** - 自动添加Droid身份标识，保持上下文一致性
- **请求头标准化** - 自动添加Factory特定的认证和会话头信息
- **零配置使用** - Claude Code可直接使用，无需额外设置

## 其他特性

- 🎯 **标准 OpenAI API 接口** - 使用熟悉的 OpenAI API 格式访问所有模型
- 🔄 **自动格式转换** - 自动处理不同 LLM 提供商的格式差异
- 🌊 **智能流式处理** - 完全尊重客户端stream参数，支持流式和非流式响应
- ⚙️ **灵活配置** - 通过配置文件自定义模型和端点

## 安装

详细的安装和配置指南请查看 [INSTALL.md](INSTALL.md)

安装项目依赖：

```bash
npm install
```

**依赖说明**：
- `express` - Web服务器框架
- `node-fetch` - HTTP请求库
- `https-proxy-agent` - 为外部请求提供代理支持

> 💡 **首次使用必须执行 `npm install`**，之后只需要 `npm start` 启动服务即可。

## 快速开始

### 1. 首次启动

```bash
# 安装依赖
npm install

# 启动服务
npm start
```

服务器默认运行在 `http://localhost:3000`

### 2. 访问管理后台

打开浏览器访问 `http://localhost:3000/login.html`

**默认管理员账号**：
- 用户名: `admin`
- 密码: `admin123`

⚠️ **首次登录后请立即修改密码**！在 `config.json` 中修改：

```json
{
  "admin": {
    "username": "your_username",
    "password": "your_password"
  }
}
```

### 3. 添加 Factory Key

在管理后台的 **Factory Keys** 页面：
1. 点击"新增 Factory Key"
2. 输入你的 Factory API Key
3. 可选：输入一个友好的名称
4. 点击"添加"

### 4. 创建 API Key

在管理后台的 **API Keys** 页面：
1. 点击"新增 API Key"
2. 输入名称（如：测试项目、用户A等）
3. 设置每日请求限制（0为不限制）
4. 点击"添加"
5. **重要**：复制生成的 API Key 并妥善保存

### 5. 使用 API

使用创建的 API Key 调用服务：

```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "messages": [
      {"role": "user", "content": "你好"}
    ]
  }'
```

## 文档

- [安装和配置指南](INSTALL.md) - 详细的安装、配置和部署说明
- [使用说明](USAGE.md) - API 使用方法和示例
- [功能特性](FEATURES.md) - 完整的功能列表和说明
- [批量导入指南](BATCH_IMPORT_GUIDE.md) - 批量导入 Factory Keys 的说明
- [Docker 部署](DOCKER_DEPLOY.md) - Docker 和容器化部署指南
- [更新日志](CHANGELOG.md) - 版本更新记录

## 主要改进（相比原版 droid2api）

1. **企业级多租户支持** - 通过 API Key 系统支持多用户/多项目使用
2. **完整的管理后台** - 无需修改配置文件，通过 Web 界面管理所有配置
3. **使用量追踪** - 详细记录每个 API Key 的使用情况
4. **调用限制** - 为每个 API Key 设置每日调用次数限制
5. **多密钥管理** - 支持配置多个 Factory Key，提高可用性
6. **批量操作** - 支持批量导入 Factory Keys
7. **实时监控** - Dashboard 实时显示系统状态和统计数据

## 许可证

MIT

## 致谢

本项目基于 [droid2api](https://github.com/chenwr727/droid2api) 开发，感谢原作者的贡献。
