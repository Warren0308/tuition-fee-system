// 将日期字符串转换为本地时区的日期对象
export function parseLocalDate(dateStr: string): Date {
  // 验证日期格式
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error('日期格式错误，请使用YYYY-MM-DD格式');
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  
  // 验证年月日的有效性
  if (month < 1 || month > 12) {
    throw new Error('月份必须在1-12之间');
  }
  
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    throw new Error(`日期必须在1-${daysInMonth}之间`);
  }

  const date = new Date(year, month - 1, day);
  
  // 验证日期是否有效
  if (isNaN(date.getTime())) {
    throw new Error('无效的日期');
  }

  return date;
}

// 计算结束日期（开始日期 + 27天）
export function calculateEndDate(startDate: Date): Date {
  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
    throw new Error('无效的开始日期');
  }

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 27);
  return endDate;
}

// 计算下一个学期的开始日期（当前学期开始日期 + 28天）
export function calculateNextTermStartDate(currentStartDate: Date): Date {
  if (!(currentStartDate instanceof Date) || isNaN(currentStartDate.getTime())) {
    throw new Error('无效的开始日期');
  }

  const nextStartDate = new Date(currentStartDate);
  nextStartDate.setDate(currentStartDate.getDate() + 28);
  return nextStartDate;
}