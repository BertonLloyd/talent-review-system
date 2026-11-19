# 自建部署指南（Self-Hosting）

面向希望在自己的服务器上运行本系统的用户。按本文档操作可从零跑通，不依赖妙搭平台。

## 1. 环境要求

| 组件 | 版本 |
|------|------|
| Node.js | ≥ 22 |
| npm | ≥ 10 |
| PostgreSQL | ≥ 14 |

## 2. 准备数据库

安装 PostgreSQL 后，创建业务登录角色与数据库（用超级用户执行）：

```sql
CREATE ROLE talent_user LOGIN PASSWORD 'talent_pass';
CREATE DATABASE talent_review OWNER talent_user;
```

启用 `pgcrypto`（密码哈希依赖）：

```bash
sudo -u postgres psql -d talent_review -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
```

### 2.1 创建 RLS 角色（必做）

数据层对每个请求执行 `SET LOCAL ROLE`，需要三个平台角色。用超级用户执行随仓库提供的幂等脚本：

```bash
sudo -u postgres psql -d talent_review \
  -v APP_ROLE=talent_user -f scripts/sql/00_roles.sql
```

> 该脚本可重复执行；`APP_ROLE` 必须与连接串所用的业务角色一致。

## 3. 初始化表结构与数据

```bash
# 建表（用业务角色）
PGPASSWORD=talent_pass psql -h localhost -U talent_user -d talent_review \
  -f scripts/sql/01_schema.sql

# 可选：导入演示数据（7 个账号、35 个参评人、225 条评分项）
PGPASSWORD=talent_pass psql -h localhost -U talent_user -d talent_review \
  -f scripts/sql/02_seed_data.sql
```

> 若建表后才执行 `00_roles.sql`，再跑一次该脚本即可补齐 RLS 策略（脚本只作用于已存在的表）。

## 4. 配置环境变量

```bash
cp .env.example .env
```

关键变量：

| 变量 | 说明 |
|------|------|
| `SUDA_DATABASE_URL` | **数据层实际读取**，与 `DATABASE_URL` 填同一个连接串 |
| `DATABASE_URL` | 兼容口径，保留 |
| `FORCE_AUTHN_INNERAPI_DOMAIN` | 指向本服务自身，如 `http://localhost:3000` |
| `AUTH_JWT_SECRET` | 生产环境必须改为强随机字符串 |
| `CLIENT_BASE_PATH` | 部署基础路径，默认 `/`；详见第 6 节 |
| `SERVER_HOST` / `SERVER_PORT` | 监听地址，默认 `localhost` / `3000` |

连接串示例：

```
postgresql://talent_user:talent_pass@localhost:5432/talent_review
```

## 5. 安装依赖、构建、启动

```bash
npm install          # postinstall 已做平台 CLI 容错，外部环境不会失败
npm run build:prod   # 构建 server + client
node dist/server/main.js
```

`npm install` 默认通过仓库内 `.npmrc` 使用 npmmirror 镜像；如需官方源，删除或修改 `.npmrc` 即可。

## 6. 基础路径（basename）

系统已在应用层处理平台默认的 `/app/<id>` 问题，自建默认根路径访问：

- 默认 `CLIENT_BASE_PATH=/`，直接访问 `http://localhost:3000/`
- 若部署在子路径，构建前设置 `CLIENT_BASE_PATH=/your-path` 并重新构建
- 静态资源由服务端同源提供，无需 CDN

## 7. CSRF 机制（脚本/API 调用须知）

写接口（登录、增删改）强制 CSRF 校验：cookie 中的 `suda-csrf-token` 必须与请求头 `x-suda-csrf-token` 一致。浏览器会自动处理；用脚本调用时流程为：

1. 先 GET 任意页面，保存 cookie，并从返回 HTML 中读取 `csrfToken`
2. 后续请求带上该 cookie，并加头 `x-suda-csrf-token: <token>`

## 8. 演示账号

导入演示数据后可用，密码规则为拼音首字母 + `123456`：

| 账号 | 密码 | 角色 |
|------|------|------|
| `admin` | `admin123456` | 管理员 |
| `zhang_zong_jian` | `zzj123456` | 评价人 |
| `li_zong_jian` | `lzj123456` | 评价人 |
| `wang_zhu_guan` | `wzg123456` | 评价人 |
| `chen_jing_li` | `cjl123456` | 评价人 |
| `zhao_jing_li` | `zjl123456` | 评价人 |
| `sun_jing_li` | `sjl123456` | 评价人 |

## 9. 常见问题

| 现象 | 原因 / 处理 |
|------|------|
| `role "anon_" does not exist` | 未执行 `00_roles.sql`，或未用超级用户执行 |
| `Forbidden, csrf token not found` | 见第 7 节，补 cookie + header |
| 安装时卡在 TAR_BAD_ARCHIVE | lock 已替换为公开镜像；确认网络可访问 npmmirror |
| 接口 500 且提示角色相关 | 确认业务角色已被 GRANT 为三个 RLS 角色成员 |
| 根路径白屏 | 确认用修复后版本构建，且 `CLIENT_BASE_PATH` 未被设为 `/app/...` |
