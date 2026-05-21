import { z } from 'zod';

// 基础日期验证
export const dateSchema = z.preprocess((arg) => {
  if (typeof arg == "string" || arg instanceof Date) return new Date(arg);
}, z.date());

// 学期验证
export const termSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  termIndex: z.number().int().min(1).max(13),
  startDate: dateSchema,
  endDate: dateSchema
}).refine(data => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  return end > start;
}, {
  message: "结束日期必须晚于开始日期"
}).refine(data => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays === 27;
}, {
  message: "学期长度必须为28天（结束日期应为开始日期+27天）"
});

// 付款验证
export const paymentSchema = z.object({
  year: z.number().int(),
  termIndex: z.number().int().min(1).max(13),
  studentId: z.string().uuid(),
  totalCents: z.number().int().positive(),
  paidAt: dateSchema.nullable(),
  items: z.array(z.object({
    description: z.string().min(1),
    finalCents: z.number().int().positive()
  }))
}).refine(data => {
  if (!data.items.length) return false;
  const itemsTotal = data.items.reduce((sum, item) => sum + item.finalCents, 0);
  return itemsTotal === data.totalCents;
}, {
  message: "付款项目总额必须等于付款总额"
});

// 课程安排验证
export const scheduleSchema = z.object({
  termId: z.number().int().positive(),
  courseId: z.string().uuid(),
  dayOfWeek: z.number().int().min(1).max(7),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "时间格式必须为 HH:mm"),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "时间格式必须为 HH:mm")
}).refine(data => {
  const [startHour, startMin] = data.startTime.split(':').map(Number);
  const [endHour, endMin] = data.endTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  return endMinutes > startMinutes;
}, {
  message: "结束时间必须晚于开始时间"
});

// 学生注册验证
export const enrollmentSchema = z.object({
  studentId: z.string().uuid(),
  courseId: z.string().uuid(),
  startTermId: z.number().int().positive(),
  endTermId: z.number().int().positive().nullable()
}).refine(data => {
  if (!data.endTermId) return true;
  return data.endTermId > data.startTermId;
}, {
  message: "结束学期必须晚于开始学期"
});








