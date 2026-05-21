# 学生收费系统（优特补习学院）

以 Next.js + Prisma + NextAuth + Tailwind 构建，默认中文界面。

## 本地开发
1. 安装依赖：`npm i`
2. 准备环境：复制 `.env.example` 为 `.env`，按需填写（数据库/SMTP/NEXTAUTH_SECRET）
3. 初始化数据库：`npm run prisma:migrate`，然后 `npm run seed`
4. 启动：`npm run dev`，访问 `http://localhost:3000/login`
   - 账号：`admin`，密码：`theylingling7496`（首次登录后请尽快修改）

## 目录结构
- `src/app`：App Router 页面与 API 路由
- `src/lib`：Prisma/NextAuth 配置
- `prisma/schema.prisma`：数据库模型
- `prisma/seed.cjs`：种子脚本

## 功能现状
- 登录页（凭证登录、忘记密码收集邮箱）
- 主页面入口与权限守卫（/dashboard）
- 学生：列表/新增/详情（含监护人基础信息）
- 老师：列表
- 个人资料：基础信息与修改密码
- 结算：按当前课程生成学期账单草稿与预览
- 管理层学期设置页：`/admin/terms`（录入 Term1 起始日期）

## 部署
推荐 Vercel + Neon（PostgreSQL）。配置环境变量：
- `DATABASE_URL`（PostgreSQL 连接串）
- `NEXTAUTH_SECRET`（生成一个随机字符串）
- `NEXT_PUBLIC_APP_URL`（站点 URL，用于拼接重置链接）
- SMTP（如使用 Gmail）：
  - `SMTP_HOST=smtp.gmail.com`
  - `SMTP_PORT=465`
  - `SMTP_SECURE=1`
  - `SMTP_USER=你的邮箱`
  - `SMTP_PASS=应用专用密码`
  - `SMTP_FROM=发件人显示（可省略）`

## 后续计划
- 课程/额外费用管理（年级维度价格）、调整与历史追溯
- 结算页面的逐项调整、半学期/3周计费支持（已在模型上支持 fraction）
- 报表：按学期/课程汇总总额
- 通知：邮件或短信发送（择免费渠道）
