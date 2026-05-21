import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthOrRedirect } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { getAcademicYearTerms } from "@/lib/academic-year";
import { resolveFeeLookupTermId } from "@/lib/fee-baseline";

export async function POST(req: Request, { params }: { params: { studentId: string } }) {
  const auth = await requireAuthOrRedirect(req);
  if (!auth.ok) return auth.response;

  const { studentId } = params;
  const form = await req.formData();
  const year = Number(form.get("year"));
  const termIndex = Number(form.get("termIndex"));
  
  if (!year || !termIndex) {
    return NextResponse.json({ ok: false, error: "参数不完整" }, { status: 400 });
  }

  // 获取当前学期信息
  const currentTerm = await prisma.term.findFirst({
    where: { year, termIndex }
  });
  const termId = currentTerm?.id;
  const academicTerms = await getAcademicYearTerms();
  const feeTermId =
    termId != null ? resolveFeeLookupTermId(termId, academicTerms) : undefined;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      grade: true,
      enrollments: { include: { course: true } },
    },
  });
  if (!student) {
    return NextResponse.json({ ok: false, error: "学生不存在" }, { status: 404 });
  }

  // 筛选应缴结构（第5期起以第4期为准）
  const validEnrollments = feeTermId
    ? student.enrollments.filter(
        (e) =>
          e.startTermId <= feeTermId &&
          (!e.endTermId || e.endTermId >= feeTermId)
      )
    : student.enrollments.filter((e) => !e.endTermId);

  // 获取选中的课程
  const courseItems = form.getAll("courseItems");
  const selectedCourseIds = courseItems
    .map(v => Number(v))
    .filter(id => !isNaN(id));

  // 获取选中的已注册额外费用
  const extraItems = form.getAll("extraItems");
  const selectedExtraIds = extraItems
    .map(v => Number(v))
    .filter(id => !isNaN(id));
  
  // 获取临时勾选的额外费用（未注册的）
  const tempExtraItems = form.getAll("tempExtraItems");
  const tempExtraIds = tempExtraItems
    .map(v => Number(v))
    .filter(id => !isNaN(id));
  
  // 获取自定义费用
  const customFeeNames = form.getAll("customFeeNames");
  const customFeeAmounts = form.getAll("customFeeAmounts");

  // 获取课程费用
  const fees = await prisma.courseFee.findMany({ where: { gradeId: student.gradeId } });
  const courseIdToFee = new Map(fees.map(f => [f.courseId, f]));

  const items: Array<{ 
    description: string; 
    unitCents: number; 
    quantity: number; 
    fraction: number; 
    finalCents: number; 
    itemType: string; 
    refId?: number | null;
    note?: string | null;
  }> = [];

  // 处理课程费用（只处理该学期有效的选课）
  for (const en of validEnrollments) {
    if (!selectedCourseIds.includes(en.courseId)) continue;

    const fee = courseIdToFee.get(en.courseId);
    const fallbackPrice = fee?.amountCents || 20000;
    // 选课时设的 customPriceCents 优先作为基准
    const basePrice = en.customPriceCents ?? fallbackPrice;

    // 检查表单中是否有用户当场修改的价格
    const customPriceStr = form.get(`course_${en.courseId}_price`);
    let finalPrice = basePrice;
    let note: string | null = null;

    if (customPriceStr) {
      const billingCustomPrice = Math.round(parseFloat(customPriceStr.toString()) * 100);
      if (!isNaN(billingCustomPrice) && billingCustomPrice > 0) {
        finalPrice = billingCustomPrice;
        if (billingCustomPrice !== basePrice) {
          note = `原价 RM ${(basePrice / 100).toFixed(2)}，本次为 RM ${(billingCustomPrice / 100).toFixed(2)}`;
        }
      }
    }

    // 若选课预设过自定义价，加注说明
    if (!note && en.customPriceCents != null && en.customPriceCents !== fallbackPrice) {
      note = `选课预设价 RM ${(en.customPriceCents / 100).toFixed(2)}（标准 RM ${(fallbackPrice / 100).toFixed(2)}）`;
    }

    items.push({
      description: en.course.name,
      unitCents: basePrice,
      quantity: 1,
      fraction: 1,
      finalCents: finalPrice,
      itemType: "COURSE",
      refId: en.courseId,
      note,
    });
  }

  // 处理额外费用（膳食、交通等）- 根据学期筛选
  try {
    const allExtraFees = await prisma.studentExtraFee.findMany({
      where: { 
        studentId,
        extraFeeTypeId: { in: selectedExtraIds }
      },
      include: {
        extraFeeType: true
      }
    });

    // 筛选应缴结构有效的额外费用
    const studentExtraFees = feeTermId
      ? allExtraFees.filter(
          (fee) =>
            fee.startTermId <= feeTermId &&
            (!fee.endTermId || fee.endTermId >= feeTermId)
        )
      : allExtraFees.filter((fee) => !fee.endTermId);

    for (const extraFee of studentExtraFees) {
      const defaultPrice = extraFee.amountCents;
      
      // 检查是否有自定义价格 - 始终使用用户输入的价格
      const customPriceStr = form.get(`extra_${extraFee.extraFeeTypeId}_price`);
      let finalPrice = defaultPrice;
      let note: string | null = null;
      
      if (customPriceStr) {
        const customPrice = Math.round(parseFloat(customPriceStr.toString()) * 100);
        if (!isNaN(customPrice) && customPrice > 0) {
          // 始终使用用户输入的价格
          finalPrice = customPrice;
          // 只有价格不同时才添加备注
          if (customPrice !== defaultPrice) {
            note = `原价 RM ${(defaultPrice / 100).toFixed(2)}，自定义为 RM ${(customPrice / 100).toFixed(2)}`;
          }
        }
      }
      
      items.push({ 
        description: extraFee.extraFeeType.name, 
        unitCents: defaultPrice, 
        quantity: 1, 
        fraction: 1, 
        finalCents: finalPrice, 
        itemType: "EXTRA_FEE", 
        refId: extraFee.extraFeeTypeId,
        note
      });
    }
  } catch (e) {
    console.log('处理额外费用时出错:', e);
  }

  // 处理临时勾选的额外费用（未注册的）
  try {
    if (tempExtraIds.length > 0) {
      const extraFeeTypes = await prisma.extraFeeType.findMany({
        where: { id: { in: tempExtraIds } }
      });
      
      for (const extraFeeType of extraFeeTypes) {
        // 获取用户输入的价格
        const priceStr = form.get(`tempExtra_${extraFeeType.id}_price`);
        if (!priceStr) continue;
        
        const price = Math.round(parseFloat(priceStr.toString()) * 100);
        if (isNaN(price) || price <= 0) continue;
        
        items.push({ 
          description: `${extraFeeType.name}（临时）`, 
          unitCents: price, 
          quantity: 1, 
          fraction: 1, 
          finalCents: price, 
          itemType: "TEMP_EXTRA_FEE", 
          refId: extraFeeType.id,
          note: "本期临时添加"
        });
      }
    }
  } catch (e) {
    console.log('处理临时额外费用时出错:', e);
  }

  // 处理自定义费用
  try {
    if (customFeeNames.length > 0 && customFeeNames.length === customFeeAmounts.length) {
      for (let i = 0; i < customFeeNames.length; i++) {
        const name = customFeeNames[i]?.toString().trim();
        const amountCents = Number(customFeeAmounts[i]);
        
        if (!name || isNaN(amountCents) || amountCents <= 0) continue;
        
        items.push({ 
          description: name, 
          unitCents: amountCents, 
          quantity: 1, 
          fraction: 1, 
          finalCents: amountCents, 
          itemType: "CUSTOM_FEE", 
          refId: null,
          note: "自定义费用"
        });
      }
    }
  } catch (e) {
    console.log('处理自定义费用时出错:', e);
  }

  const total = items.reduce((sum, i) => sum + i.finalCents, 0);
  const noteRaw = String(form.get("note") || "").trim();
  const paymentNote = noteRaw || null;

  // 创建或更新付款记录
  const payment = await prisma.studentTermPayment.upsert({
    where: { studentId_year_termIndex: { studentId, year, termIndex } },
    update: { totalCents: total, paidAt: new Date(), note: paymentNote },
    create: {
      studentId,
      year,
      termIndex,
      totalCents: total,
      paidAt: new Date(),
      note: paymentNote,
    },
  });

  // 删除旧的付款项目并创建新的
  await prisma.studentTermPaymentItem.deleteMany({ where: { paymentId: payment.id } });
  
  if (items.length > 0) {
    await prisma.studentTermPaymentItem.createMany({ 
      data: items.map(i => ({ 
        paymentId: payment.id, 
        itemType: i.itemType, 
        refId: i.refId ?? null, 
        description: i.description, 
        unitCents: i.unitCents, 
        quantity: i.quantity, 
        fraction: i.fraction, 
        finalCents: i.finalCents,
        note: i.note ?? null
      })) 
    });
  }

  await logAudit("StudentTermPayment", "CREATE_OR_UPDATE", {
    entityId: payment.id,
    after: {
      studentId,
      year,
      termIndex,
      totalCents: total,
      itemCount: items.length,
      note: paymentNote,
    },
  });

  return NextResponse.redirect(new URL(`/billing/receipt/${payment.id}`, req.url));
}


