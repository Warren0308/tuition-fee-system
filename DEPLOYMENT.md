# 优特学院管理系统 - 部署指南

本指南帮助你把这个 Next.js 系统从本地部署到云端，让员工的手机也能访问。

---

## 一、准备工作

### 1. 注册必需的账号

| 服务 | 用途 | 价格 | 链接 |
|---|---|---|---|
| GitHub | 代码托管 | 免费 | https://github.com |
| Vercel | 应用部署 | 免费（个人） | https://vercel.com |
| Neon | PostgreSQL 数据库 | 免费 0.5GB | https://neon.tech |

如果数据库已经在 Neon 上（看 `.env` 里有 `neon.tech` 就是），可以跳过 Neon 注册。

---

## 二、推送代码到 GitHub

```bash
# 1. 在项目目录初始化 git (如果还没有)
cd c:\tuition-fee-system
git init

# 2. 添加所有文件
git add .

# 3. 第一次提交
git commit -m "Initial deploy ready"

# 4. 在 GitHub 创建一个新的私有仓库（建议私有），命名比如 yutek-tuition

# 5. 推送
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/yutek-tuition.git
git push -u origin main
```

⚠️ **重要**：`.env` 文件已经在 `.gitignore` 里，**绝对不会**被推到 GitHub。这是好事，因为里面有数据库密码。

---

## 三、部署到 Vercel

### 3.1 导入项目

1. 登录 [vercel.com](https://vercel.com)
2. 点击 `Add New...` → `Project`
3. 选择刚才推到 GitHub 的仓库 → 点击 `Import`
4. 框架会自动识别为 `Next.js`
5. **暂时不要点 Deploy** —— 先设置环境变量

### 3.2 设置环境变量

在 `Configure Project` 页面，展开 `Environment Variables`，添加：

```
DATABASE_URL          → 复制本地 .env 里的值
NEXTAUTH_SECRET       → 复制本地 .env 里的值（或重新生成）
NEXTAUTH_URL          → https://yutek-tuition.vercel.app (Vercel 会给你一个域名)
NEXT_PUBLIC_APP_URL   → 同上
SMTP_HOST             → smtp.gmail.com
SMTP_PORT             → 465
SMTP_SECURE           → 1
SMTP_USER             → 复制本地 .env 里的值
SMTP_PASS             → 复制本地 .env 里的值
SMTP_FROM             → 复制本地 .env 里的值
```

> 💡 注意 NEXTAUTH_URL：第一次部署不知道域名怎么填？先随便填 `https://placeholder.vercel.app`，部署成功拿到真实域名后再回来改。

### 3.3 部署

点击 `Deploy` 等待 2-5 分钟即可。

第一次部署可能因为 `NEXTAUTH_URL` 不对而登录有问题，记得部署完成后：
1. 复制 Vercel 给你的域名（如 `yutek-tuition.vercel.app`）
2. 回到 Project Settings → Environment Variables
3. 改正 `NEXTAUTH_URL` 和 `NEXT_PUBLIC_APP_URL`
4. 点击 Deployments → 最新的部署右边 `...` → `Redeploy`

---

## 四、数据库初始化

部署后第一次访问时，数据库结构（schema）会自动通过 `vercel-build` 脚本运行 `prisma migrate deploy`。

但如果数据库是空的，你需要：

```bash
# 在本地运行一次，把数据库种子数据写入
DATABASE_URL="生产数据库URL" npm run seed
```

或者通过临时脚本创建第一个管理员账号：

```bash
DATABASE_URL="生产数据库URL" npm run reset-password admin admin123
```

---

## 五、测试手机访问

1. 用手机浏览器打开 `https://yutek-tuition.vercel.app`（你的实际域名）
2. 登录账号
3. Android Chrome：底部应该会弹出"添加到主屏幕"
4. iPhone Safari：点击底部分享按钮 → "添加到主屏幕"
5. 桌面会出现 App 图标，点开就能全屏使用

---

## 六、自定义域名（可选）

如果你有自己的域名（如 `yutek.com.my`）：

1. Vercel Project → Settings → Domains
2. 输入你的域名
3. 按 Vercel 给的指示在域名服务商那边添加 DNS 记录（一般是 CNAME 指向 `cname.vercel-dns.com`）
4. 等待 DNS 生效（几分钟到几小时）
5. 修改 `NEXTAUTH_URL` 和 `NEXT_PUBLIC_APP_URL` 为新域名 → Redeploy

---

## 七、日常维护

### 更新代码

```bash
# 本地改完代码后
git add .
git commit -m "更新内容描述"
git push

# Vercel 会自动重新部署
```

### 查看日志

Vercel → Project → Deployments → 点击某个部署 → Functions / Build Logs

### 数据库备份

Neon 自带每日备份（免费用户保留 7 天）。手动备份：

```bash
# 安装 pg_dump (postgres 客户端)
# 然后导出
pg_dump "DATABASE_URL" > backup-$(date +%Y%m%d).sql
```

### 监控

Vercel 免费提供：
- Analytics（流量统计）
- Speed Insights（速度指标）
- 错误日志

可以在 Project → Analytics 启用。

---

## 八、常见问题

### Q: 部署后登录显示 "CSRF token mismatch" 或循环跳转？
A: 一般是 `NEXTAUTH_URL` 没设对。必须设为你的实际生产域名（带 https://，不带尾部斜杠）。

### Q: API 返回 500 错误？
A: 看 Vercel Logs。最常见是数据库连接失败（`DATABASE_URL` 错），或 Prisma 客户端没生成（确认 `package.json` 的 `postinstall` 是 `prisma generate`）。

### Q: 图片或 favicon 显示不出来？
A: 静态文件应该放在 `public/` 目录，引用时直接用 `/icon.png`（不要加 `public/`）。

### Q: 我能在公司内网部署吗，不上云？
A: 可以的：
- 在公司一台电脑安装 Node.js
- `npm run build && npm run start` 启动
- 手机连同一 WiFi，访问 `http://192.168.x.x:3000`
- 但**离开公司就用不了**

---

## 九、PWA 测试清单

部署成功后，验证 PWA 功能：

- [ ] 移动浏览器打开能看到完整页面
- [ ] 底部应该有 5 个 Tab 导航（工作台/学生/查询/待付/我的）
- [ ] 左上角汉堡菜单可以打开完整菜单
- [ ] 浏览器地址栏有"安装"按钮（Chrome）或分享菜单里有"添加到主屏幕"（Safari）
- [ ] 安装后从主屏幕打开，不显示浏览器地址栏（全屏模式）
- [ ] 断网时显示离线提示页

---

## 十、安全清单（部署前必检）

- [ ] `.env` 没有被推到 GitHub
- [ ] `NEXTAUTH_SECRET` 是 32 字节随机串（不是默认的）
- [ ] 数据库 URL 启用了 `sslmode=require`
- [ ] 没有默认密码账号（admin/admin 这类）
- [ ] 所有用户角色都设置正确
- [ ] SMTP 密码用的是 App Password，不是真实邮箱密码
