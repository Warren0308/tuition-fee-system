import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * 写入审计日志
 *
 * @param entityName 实体名称（如 "StudentTermPayment", "Term", "School", "Grade"）
 * @param entityId 实体主键（可选）
 * @param action 操作（CREATE, UPDATE, DELETE, BATCH_CREATE 等）
 * @param before 变更前的数据（可选，会 JSON.stringify）
 * @param after 变更后的数据（可选，会 JSON.stringify）
 */
export async function logAudit(
  entityName: string,
  action: string,
  options: {
    entityId?: string | number | null;
    before?: any;
    after?: any;
    actorUserId?: string;
  } = {}
): Promise<void> {
  try {
    let actorUserId: string | undefined = options.actorUserId;
    if (!actorUserId) {
      const session = await getServerSession(authOptions);
      const username = session?.user?.name;
      if (username) {
        const user = await prisma.user.findUnique({
          where: { username },
          select: { id: true },
        });
        actorUserId = user?.id;
      }
    }

    await prisma.auditLog.create({
      data: {
        actorUserId: actorUserId || null,
        entityName,
        entityId: options.entityId ? String(options.entityId) : null,
        action,
        before: options.before ? JSON.stringify(options.before) : null,
        after: options.after ? JSON.stringify(options.after) : null,
      },
    });
  } catch (e) {
    // 审计日志不应阻塞主流程
    console.error("[logAudit] failed:", e);
  }
}

/** 同步版本：用于已经知道 actorUserId 的场景 */
export async function logAuditSync(
  actorUserId: string | null | undefined,
  entityName: string,
  action: string,
  options: {
    entityId?: string | number | null;
    before?: any;
    after?: any;
  } = {}
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: actorUserId || null,
        entityName,
        entityId: options.entityId ? String(options.entityId) : null,
        action,
        before: options.before ? JSON.stringify(options.before) : null,
        after: options.after ? JSON.stringify(options.after) : null,
      },
    });
  } catch (e) {
    console.error("[logAuditSync] failed:", e);
  }
}
