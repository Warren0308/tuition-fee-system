import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    // 清理过期的密码重置令牌
    const result = await prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          {
            expiresAt: {
              lt: new Date()
            }
          },
          {
            usedAt: {
              not: null
            }
          }
        ]
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: `成功清理 ${result.count} 个过期/已使用的重置令牌` 
    });
  } catch (error) {
    console.error("清理重置令牌失败:", error);
    return NextResponse.json({ error: "清理失败" }, { status: 500 });
  }
}
