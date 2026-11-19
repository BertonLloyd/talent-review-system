# 人才盘点系统 (Talent Review System)

一套基于九宫格模型的企业人才评估与盘点系统，支持多角色评价、自动计算、人才地图可视化。

## 功能特性

- **多角色评价体系**：评价人、HR、管理员三级权限，数据按角色隔离
- **自定义评分维度与权重配置**：支持价值观、能力、意愿三大维度，可配置子项与权重
- **自动计算九宫格落位**：基于能力 × 意愿双轴自动计算（可在规则集中配置），支持价值观红线规则
- **人才地图可视化**：基于 ECharts 散点图的九宫格人才地图，直观展示人员分布
- **批量导入参评人员**：支持 Excel 批量导入参评人员与评价关系
- **评分记录管理与编辑**：评价人可查看、编辑自己提交的评分记录
- **数据导出**：支持导出盘点结果 Excel 报表
- **开放 API 接口**：提供 RESTful OpenAPI，支持外部系统集成
- **规则集版本管理**：多版本规则集并存，不同批次可使用不同评分规则

## 技术栈

- **前端**：React 19 + TypeScript + Tailwind CSS + shadcn/ui
- **后端**：NestJS 10 + TypeScript
- **数据库**：PostgreSQL + Drizzle ORM
- **图表**：ECharts
- **表单**：React Hook Form + Zod
- **认证**：JWT + bcrypt（PostgreSQL pgcrypto）

## 环境要求

- Node.js >= 22.0.0
- PostgreSQL >= 14（需启用 pgcrypto 扩展）
- npm >= 10.0.0

## 快速开始

### 1. 克隆仓库

```bash
git clone <repository-url>
cd talent-review-system
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env`，并根据实际情况修改配置：

```bash
cp .env.example .env
```

关键配置项说明：
- `DATABASE_URL`：PostgreSQL 数据库连接地址
- `AUTH_JWT_SECRET`：JWT 签名密钥，生产环境请使用强随机字符串
- `ADMIN_INITIAL_PASSWORD`：管理员初始密码，上线后请及时修改

### 4. 初始化数据库

确保 PostgreSQL 已启用 `pgcrypto` 扩展：

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

创建 RLS 角色（用超级用户，必做）：

```bash
sudo -u postgres psql -d your_database -v APP_ROLE=talent_user \
  -f scripts/sql/00_roles.sql
```

执行建表 SQL 初始化数据库结构：

```bash
# 建表
psql -d your_database -f scripts/sql/01_schema.sql

# 可选：导入演示数据
psql -d your_database -f scripts/sql/02_seed_data.sql
```

完整自建部署步骤（含 CSRF、基础路径说明）详见 [自建部署指南](docs/self-hosting.md)。

### 5. 构建并启动

```bash
npm run build:prod
node dist/server/main.js
```

### 6. 访问应用

默认根路径访问 `http://localhost:3000/`，用演示账号登录即可使用。

## 默认演示账号

导入演示数据后，以下账号可用（密码规则：姓名拼音首字母 + `123456`）：

| 角色 | 账号 (reviewer_key) | 密码 | 姓名 | 说明 |
|------|---------------------|------|------|------|
| 管理员 | `admin` | `admin123456` | 系统管理员 | 全部权限 |
| 评价人 | `zhang_zong_jian` | `zzj123456` | 张总监 | 总经办 |
| 评价人 | `li_zong_jian` | `lzj123456` | 李总监 | 财务部 |
| 评价人 | `wang_zhu_guan` | `wzg123456` | 王主管 | 人力资源部 |
| 评价人 | `chen_jing_li` | `cjl123456` | 陈经理 | 客户服务部 |
| 评价人 | `zhao_jing_li` | `zjl123456` | 赵经理 | 线上运营部 |
| 评价人 | `sun_jing_li` | `sjl123456` | 孙经理 | 业务运营部 |

## 目录结构

```
├── client/          # 前端 React 应用
│   ├── src/
│   │   ├── pages/   # 页面组件
│   │   ├── components/  # 通用组件
│   │   └── api/     # 前端 API 调用
├── server/          # 后端 NestJS 应用
│   ├── modules/     # 业务模块
│   └── database/    # 数据库 schema
├── shared/          # 前后端共享类型定义
├── docs/            # 文档与使用说明
└── scripts/         # 工具脚本
```

## 角色说明

- **评价人**：对分配给自己的参评人员进行评分，可查看和编辑自己的评分记录
- **HR**：配置盘点规则、管理盘点批次、导入参评人员、查看盘点结果
- **管理员**：拥有系统全部权限，包括账号管理、系统设置、API Key 管理等

## 九宫格模型

系统基于经典的人才盘点九宫格模型，横轴和纵轴可在规则集中灵活配置，默认配置如下：

- **横轴**：能力均分（岗位胜任能力，按 4.0 / 2.5 分为高 / 中 / 低三档）
- **纵轴**：意愿均分（工作意愿与发展潜力，按 4.0 / 2.5 分为高 / 中 / 低三档）

两条分档线将平面切成 3×3 = 9 个格子，加上价值观红线区，共 10 个人才分类。

### 人才分类（9 格 + 红线区）

| 分类 | 位置 | 含义 |
|------|------|------|
| 超级明星 | 高意愿 × 高能力 | 顶尖人才，重点保留与激励 |
| 绩效之星 | 高意愿 × 中能力 | 高意愿驱动良好绩效 |
| 熟练骨干 | 高意愿 × 低能力 | 经验丰富的技术能手 |
| 潜力之星 | 中意愿 × 高能力 | 有潜力，可重点培养 |
| 中坚力量 | 中意愿 × 中能力 | 团队核心骨干 |
| 稳定贡献 | 中意愿 × 低能力 | 稳定贡献的普通员工 |
| 待成长 | 低意愿 × 高能力 | 能力强但意愿待激发 |
| 待提升 | 低意愿 × 中能力 | 需关注与辅导提升 |
| 观察改善 | 低意愿 × 低能力 | 需明确改进任务 |
| 红线区 | — | 价值观任一子项 ≤ 1 分，优先处理 |

## 文档

- [自建部署指南](docs/self-hosting.md)
- [管理员使用手册](docs/admin-guide.md)
- [HR 使用手册](docs/hr-guide.md)
- [评价人使用手册](docs/reviewer-guide.md)
- [OpenAPI 文档](docs/openapi.json)

## 许可证

MIT License — 详见 [LICENSE](LICENSE) 文件。
