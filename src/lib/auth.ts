import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

/**
 * 检查用户账户是否已完善激活
 * 激活条件：密码已修改(mustChangePassword=false) + 有邮箱 + 有电话
 */
export function isAccountActivated(user: { mustChangePassword: boolean; email: string | null; phone: string | null }): boolean {
  return !user.mustChangePassword && !!user.email && !!user.phone;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "用户名", type: "text" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        const user = await prisma.user.findUnique({ where: { username: credentials.username } });
        
        // 用户不存在或账户未启用 → 拒绝登录（显示"没有该账户"）
        // 管理员必须先点击"启用"按钮，用户才能登录
        if (!user || !user.isActive) return null;
        
        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;
        
        // 检查账户资料是否已完善
        const activated = isAccountActivated(user);
        
        // 登录成功后，附带角色和激活状态
        const roles = await prisma.userRole.findMany({ where: { userId: user.id }, include: { role: true } });
        const roleCodes = roles.map(r => r.role.code);
        
        return { 
          id: user.id, 
          name: user.username, 
          roles: roleCodes,
          mustChangePassword: user.mustChangePassword,
          needsActivation: !activated,
          sessionVersion: (user as any).sessionVersion ?? 0,
        } as any;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // 初次登录：把 sessionVersion 写入 token
      if (user) {
        token.userId = (user as any).id;
        token.roles = (user as any).roles ?? token.roles ?? [];
        token.mustChangePassword = (user as any).mustChangePassword ?? false;
        token.needsActivation = (user as any).needsActivation ?? false;
        token.isActive = true;
        token.sessionVersion = (user as any).sessionVersion ?? 0;
        token.lastChecked = Math.floor(Date.now() / 1000);
        return token;
      }

      // 定期刷新：每 60 秒查一次数据库
      // 或前端显式触发 update（updateSession）
      const REFRESH_INTERVAL = 60; // 秒
      const now = Math.floor(Date.now() / 1000);
      const lastChecked = (token.lastChecked as number | undefined) ?? 0;

      const shouldRefresh = trigger === 'update' || now - lastChecked > REFRESH_INTERVAL;

      if (shouldRefresh && token.userId) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.userId as string },
            include: { roles: { include: { role: true } } },
          });

          if (!dbUser || !dbUser.isActive) {
            // 用户被停用 - 返回 isActive=false 触发登出
            token.isActive = false;
            token.roles = [];
            token.lastChecked = now;
            return token;
          }

          // sessionVersion 不一致说明管理员已强制登出（如修改密码）
          const dbVersion = (dbUser as any).sessionVersion ?? 0;
          const tokenVersion = (token.sessionVersion as number | undefined) ?? 0;
          if (dbVersion !== tokenVersion) {
            token.isActive = false;
            token.roles = [];
            token.lastChecked = now;
            return token;
          }

          const activated = isAccountActivated(dbUser);
          token.roles = dbUser.roles.map((r) => r.role.code);
          token.mustChangePassword = dbUser.mustChangePassword;
          token.needsActivation = !activated;
          token.isActive = true;
          token.sessionVersion = dbVersion;
          token.lastChecked = now;
        } catch (e) {
          console.error('JWT 刷新失败:', e);
          // 失败时保持现状
        }
      }

      return token;
    },
    async session({ session, token }) {
      // 若用户已被停用或 session 版本失效 - 返回 null session
      if (token.isActive === false) {
        return null as any;
      }

      (session as any).userId = token.userId;
      (session as any).roles = token.roles ?? [];
      (session as any).mustChangePassword = token.mustChangePassword ?? false;
      (session as any).needsActivation = token.needsActivation ?? false;
      return session;
    },
  },
};
