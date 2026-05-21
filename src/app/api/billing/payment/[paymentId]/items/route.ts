import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRedirect } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import {
  isItemAlreadyInBill,
  type HistoryItemToAdd,
  type PaymentItemSnapshot,
} from "@/lib/billing-history-utils";

export async function POST(req: Request, { params }: { params: { paymentId: string } }) {
  const auth = await requireAuthOrRedirect(req);
  if (!auth.ok) return auth.response;

  const { paymentId } = params;
  const form = await req.formData();
  const action = String(form.get("_action") || "save");

  const payment = await prisma.studentTermPayment.findUnique({ where: { id: paymentId }, include: { items: true } });
  if (!payment) return NextResponse.json({ ok: false, error: "账单不存在" }, { status: 404 });

  // 删除选中的项目
  const deleteItemIds = form.getAll("deleteItemIds");
  if (deleteItemIds.length > 0) {
    const idsToDelete = deleteItemIds.map(id => Number(id)).filter(id => !isNaN(id));
    if (idsToDelete.length > 0) {
      await prisma.studentTermPaymentItem.deleteMany({
        where: {
          id: { in: idsToDelete },
          paymentId: paymentId // 确保只删除属于此账单的项目
        }
      });
    }
  }

  // 重新获取项目列表（排除已删除的）
  const remainingItems = payment.items.filter(item => 
    !deleteItemIds.includes(String(item.id))
  );

  // 更新现有项目（只更新未被删除的）
  for (const item of remainingItems) {
    const fraction = Number(form.get(`fraction_${item.id}`) || item.fraction);
    const quantity = Number(form.get(`quantity_${item.id}`) || item.quantity);
    const finalCents = Math.round(Number(form.get(`finalCents_${item.id}`) || item.finalCents / 100) * 100);
    const note = String(form.get(`note_${item.id}`) || item.note || "").trim() || null;
    await prisma.studentTermPaymentItem.update({ where: { id: item.id }, data: { fraction, quantity, finalCents, note } });
  }

  // 添加新的课程项目
  const addCourseIds = form.getAll("addCourseIds");
  for (const courseIdStr of addCourseIds) {
    const courseId = Number(courseIdStr);
    const priceInput = form.get(`addCourse_${courseId}_price`);
    const price = Math.round(Number(priceInput || 0) * 100); // 转换为 cents
    const name = String(form.get(`addCourse_${courseId}_name`) || '');
    
    if (courseId && name) {
      await prisma.studentTermPaymentItem.create({
        data: {
          paymentId,
          itemType: "COURSE",
          refId: courseId,
          description: name,
          unitCents: price,
          quantity: 1,
          fraction: 1,
          finalCents: price,
          note: "后续添加"
        }
      });
    }
  }

  // 添加新的额外费用项目
  const addExtraFeeIds = form.getAll("addExtraFeeIds");
  for (const extraFeeIdStr of addExtraFeeIds) {
    const extraFeeId = Number(extraFeeIdStr);
    const priceInput = form.get(`addExtra_${extraFeeId}_price`);
    const price = Math.round(Number(priceInput || 0) * 100); // 转换为 cents
    const name = String(form.get(`addExtra_${extraFeeId}_name`) || '');
    
    if (extraFeeId && name) {
      await prisma.studentTermPaymentItem.create({
        data: {
          paymentId,
          itemType: "EXTRA_FEE",
          refId: extraFeeId,
          description: name,
          unitCents: price,
          quantity: 1,
          fraction: 1,
          finalCents: price,
          note: "后续添加"
        }
      });
    }
  }

  // 添加临时额外费用（未注册的）
  const tempExtraItems = form.getAll("tempExtraItems");
  for (const tempExtraIdStr of tempExtraItems) {
    const tempExtraId = Number(tempExtraIdStr);
    const priceInput = form.get(`tempExtra_${tempExtraId}_price`);
    const price = Math.round(Number(priceInput || 0) * 100);
    const name = String(form.get(`tempExtra_${tempExtraId}_name`) || '');
    
    if (tempExtraId && name && price > 0) {
      await prisma.studentTermPaymentItem.create({
        data: {
          paymentId,
          itemType: "TEMP_EXTRA_FEE",
          refId: tempExtraId,
          description: `${name}（临时）`,
          unitCents: price,
          quantity: 1,
          fraction: 1,
          finalCents: price,
          note: "本期临时添加"
        }
      });
    }
  }

  // 添加自定义费用
  const customFeeNames = form.getAll("customFeeNames");
  const customFeeAmounts = form.getAll("customFeeAmounts");
  if (customFeeNames.length > 0 && customFeeNames.length === customFeeAmounts.length) {
    for (let i = 0; i < customFeeNames.length; i++) {
      const name = String(customFeeNames[i] || '').trim();
      const amountCents = Number(customFeeAmounts[i]);
      
      if (name && !isNaN(amountCents) && amountCents > 0) {
        await prisma.studentTermPaymentItem.create({
          data: {
            paymentId,
            itemType: "CUSTOM_FEE",
            refId: null,
            description: name,
            unitCents: amountCents,
            quantity: 1,
            fraction: 1,
            finalCents: amountCents,
            note: "自定义费用"
          }
        });
      }
    }
  }

  // 从历史账单复制项目
  let historyItemsAdded = 0;
  const historyItemsJson = form.get("historyItemsJson");
  if (historyItemsJson) {
    try {
      const historyItems = JSON.parse(String(historyItemsJson)) as HistoryItemToAdd[];
      const existingRows = await prisma.studentTermPaymentItem.findMany({
        where: { paymentId },
      });
      const existingSnapshots: PaymentItemSnapshot[] = existingRows.map((i) => ({
        itemType: i.itemType,
        refId: i.refId,
        description: i.description,
        unitCents: i.unitCents,
        quantity: i.quantity,
        fraction: i.fraction,
        finalCents: i.finalCents,
        note: i.note,
      }));

      for (const item of historyItems) {
        if (!item.description || !item.itemType) continue;
        const snapshot: PaymentItemSnapshot = {
          itemType: item.itemType,
          refId: item.refId ?? null,
          description: item.description,
          unitCents: item.unitCents,
          quantity: item.quantity ?? 1,
          fraction: item.fraction ?? 1,
          finalCents: item.finalCents,
          note: item.note,
        };
        if (isItemAlreadyInBill(snapshot, existingSnapshots)) continue;

        const note = item.sourceLabel
          ? `参考${item.sourceLabel}${item.note ? ` · ${item.note}` : ""}`
          : item.note || "参考历史账单";

        await prisma.studentTermPaymentItem.create({
          data: {
            paymentId,
            itemType: item.itemType,
            refId: item.refId ?? null,
            description: item.description,
            unitCents: item.unitCents,
            quantity: item.quantity ?? 1,
            fraction: item.fraction ?? 1,
            finalCents: item.finalCents,
            note,
          },
        });
        existingSnapshots.push(snapshot);
        historyItemsAdded++;
      }
    } catch (e) {
      console.error("[billing/items] historyItemsJson parse failed:", e);
    }
  }

  // 处理账单整体备注
  const paymentNoteRaw = form.get("paymentNote");
  const paymentNoteUpdate =
    paymentNoteRaw !== null
      ? { note: String(paymentNoteRaw).trim() || null }
      : {};

  // 重新计算总额
  const refreshed = await prisma.studentTermPayment.findUnique({ where: { id: paymentId }, include: { items: true } });
  const total = (refreshed?.items || []).reduce((s, i) => s + i.finalCents, 0);
  await prisma.studentTermPayment.update({
    where: { id: paymentId },
    data: {
      totalCents: total,
      paidAt: action === "markPaid" ? new Date() : payment.paidAt,
      ...paymentNoteUpdate,
    },
  });

  await logAudit("StudentTermPayment", "EDIT", {
    entityId: paymentId,
    before: {
      totalCents: payment.totalCents,
      itemCount: payment.items.length,
    },
    after: {
      totalCents: total,
      itemCount: refreshed?.items.length ?? 0,
      action,
      historyItemsAdded,
    },
  });

  return NextResponse.redirect(new URL(`/billing/receipt/${paymentId}`, req.url));
}


