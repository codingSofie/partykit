# 部署指南

## 部署架构

由于项目使用 WebSocket 和 SQLite，需要采用**混合部署**方案：

- **前端**：部署到 Vercel（Next.js）
- **后端**：部署到支持 WebSocket 的平台（Railway、Render、Fly.io 等）

## 方案一：前端 Vercel + 后端 Railway（推荐）

### 1. 部署后端到 Railway

1. 访问 [Railway](https://railway.app)
2. 创建新项目，选择 "Deploy from GitHub repo"
3. 连接你的 GitHub 仓库
4. 设置环境变量：
   ```
   PORT=3009
   FRONTEND_URL=https://your-app.vercel.app
   ```
5. Railway 会自动检测并部署 Node.js 应用
6. 获取后端 URL（例如：`https://your-app.up.railway.app`）

### 2. 部署前端到 Vercel

1. 访问 [Vercel](https://vercel.com)
2. 导入你的 GitHub 仓库
3. 设置环境变量：
   ```
   NEXT_PUBLIC_SERVER_URL=https://your-app.up.railway.app
   ```
4. 部署设置：
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`
5. 部署

## 方案二：前端 Vercel + 后端 Render

### 1. 部署后端到 Render

1. 访问 [Render](https://render.com)
2. 创建新的 "Web Service"
3. 连接 GitHub 仓库
4. 设置：
   - Build Command: `npm install`
   - Start Command: `npm run server`
   - Environment: Node
5. 设置环境变量：
   ```
   PORT=3009
   FRONTEND_URL=https://your-app.vercel.app
   ```
6. 获取后端 URL

### 2. 部署前端到 Vercel

同方案一的步骤 2

## 方案三：前端 Vercel + 后端 Fly.io

### 1. 部署后端到 Fly.io

1. 安装 Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. 登录: `fly auth login`
3. 初始化: `fly launch`（在项目根目录）
4. 创建 `fly.toml` 配置文件（见下方）
5. 部署: `fly deploy`

### 2. 部署前端到 Vercel

同方案一的步骤 2

## 环境变量配置

### 前端（Vercel）
```
NEXT_PUBLIC_SERVER_URL=https://your-backend-url.com
```

### 后端（Railway/Render/Fly.io）
```
PORT=3009
FRONTEND_URL=https://your-frontend.vercel.app
HOST=0.0.0.0
```

## 注意事项

1. **CORS 配置**：确保后端允许来自 Vercel 前端的请求
2. **WebSocket 支持**：后端平台必须支持 WebSocket（Railway、Render、Fly.io 都支持）
3. **数据库持久化**：SQLite 文件在 serverless 环境中会丢失，考虑迁移到 PostgreSQL 或 MongoDB
4. **HTTPS**：生产环境必须使用 HTTPS，WebSocket 连接会自动升级为 WSS

## 数据库迁移建议

如果需要在生产环境使用持久化数据库，建议：

1. **使用 PostgreSQL**（Railway、Render 都提供免费 PostgreSQL）
2. **使用 MongoDB Atlas**（免费层可用）
3. **使用 Supabase**（免费 PostgreSQL）

需要我帮你迁移到 PostgreSQL 吗？


