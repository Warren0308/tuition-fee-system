import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { paymentId: string } }) {
  const { paymentId } = params;
  const form = await req.formData();
  const action = String(form.get("_action") || "save");

  const payment = await prisma.studentTermPayment.findUnique({ where: { id: paymentId }, include: { items: true } });
  if (!payment) return NextResponse.json({ ok: false, error: "账单不存在" }, { status: 404 });

  for (const item of payment.items) {
    const fraction = Number(form.get(`fraction_${item.id}`) || item.fraction);
    const quantity = Number(form.get(`quantity_${item.id}`) || item.quantity);
    const finalCents = Number(form.get(`finalCents_${item.id}`) || item.finalCents);
    const note = String(form.get(`note_${item.id}`) || item.note || "").trim() || null;
    await prisma.studentTermPaymentItem.update({ where: { id: item.id }, data: { fraction, quantity, finalCents, note } });
  }

  const refreshed = await prisma.studentTermPayment.findUnique({ where: { id: paymentId }, include: { items: true } });
  const total = (refreshed?.items || []).reduce((s, i) => s + i.finalCents, 0);
  await prisma.studentTermPayment.update({ where: { id: paymentId }, data: { totalCents: total, paidAt: action === "markPaid" ? new Date() : payment.paidAt } });

  return NextResponse.redirect(new URL(action === "markPaid" ? `/billing/receipt/${paymentId}` : `/billing/edit/${paymentId}`, req.url));
}


