import { prisma } from "@/lib/prisma";

// 学期统计信息
export interface TermStatistics {
  studentCount: number;          // 学生总数
  activeStudentCount: number;    // 活跃学生数
  totalPayments: number;         // 付款总额
  paidPayments: number;         // 已付款总额
  unpaidPayments: number;       // 未付款总额
  paymentRate: number;          // 付款率
  courseCount: number;          // 课程数量
  scheduleCount: number;        // 课程安排数量
  averageClassSize: number;     // 平均班级大小
}

// 获取学期统计信息
export async function getTermStatistics(
  year: number,
  termIndex: number
): Promise<TermStatistics> {
  // 1. 获取学生统计
  const [studentCount, activeStudentCount] = await Promise.all([
    // 总学生数
    prisma.student.count({
      where: {
        enrollments: {
          some: {
            startTerm: {
              year,
              termIndex
            }
          }
        }
      }
    }),
    // 活跃学生数（有出勤记录的）
    prisma.student.count({
      where: {
        enrollments: {
          some: {
            startTerm: {
              year,
              termIndex
            },
            AND: {
              // 这里可以添加出勤记录的条件
            }
          }
        }
      }
    })
  ]);

  // 2. 获取付款统计
  const payments = await prisma.studentTermPayment.aggregate({
    where: {
      year,
      termIndex
    },
    _sum: {
      totalCents: true
    },
    _count: true
  });

  const paidPayments = await prisma.studentTermPayment.aggregate({
    where: {
      year,
      termIndex,
      paidAt: { not: null }
    },
    _sum: {
      totalCents: true
    },
    _count: true
  });

  // 3. 获取课程统计
  const [courseCount, scheduleCount] = await Promise.all([
    // 课程数量
    prisma.course.count({
      where: {
        schedules: {
          some: {
            term: {
              year,
              termIndex
            }
          }
        }
      }
    }),
    // 课程安排数量
    prisma.courseSchedule.count({
      where: {
        term: {
          year,
          termIndex
        }
      }
    })
  ]);

  // 4. 计算平均班级大小
  const enrollments = await prisma.studentEnrollment.groupBy({
    by: ['courseId'],
    where: {
      startTerm: {
        year,
        termIndex
      },
      endTermId: null // 仍在读
    },
    _count: true
  });

  const totalStudents = enrollments.reduce((sum, e) => sum + e._count, 0);
  const averageClassSize = enrollments.length > 0 
    ? totalStudents / enrollments.length 
    : 0;

  // 5. 返回统计结果
  return {
    studentCount,
    activeStudentCount,
    totalPayments: payments._sum.totalCents || 0,
    paidPayments: paidPayments._sum.totalCents || 0,
    unpaidPayments: (payments._sum.totalCents || 0) - (paidPayments._sum.totalCents || 0),
    paymentRate: payments._count > 0 
      ? (paidPayments._count / payments._count) * 100 
      : 0,
    courseCount,
    scheduleCount,
    averageClassSize
  };
}

// 获取学年统计信息
export async function getYearStatistics(year: number) {
  const terms = await Promise.all(
    Array.from({ length: 13 }, (_, i) => i + 1).map(termIndex =>
      getTermStatistics(year, termIndex)
    )
  );

  return {
    terms,
    summary: {
      totalStudents: Math.max(...terms.map(t => t.studentCount)),
      totalRevenue: terms.reduce((sum, t) => sum + t.paidPayments, 0),
      averagePaymentRate: terms.reduce((sum, t) => sum + t.paymentRate, 0) / terms.length,
      totalCourses: Math.max(...terms.map(t => t.courseCount)),
      averageClassSize: terms.reduce((sum, t) => sum + t.averageClassSize, 0) / terms.length
    }
  };
}

// 获取趋势分析
export async function getTrendAnalysis(years: number[]) {
  const trends = await Promise.all(
    years.map(async year => {
      const stats = await getYearStatistics(year);
      return {
        year,
        ...stats.summary
      };
    })
  );

  return {
    years: trends,
    growth: {
      studentGrowth: calculateGrowth(trends.map(t => t.totalStudents)),
      revenueGrowth: calculateGrowth(trends.map(t => t.totalRevenue)),
      courseGrowth: calculateGrowth(trends.map(t => t.totalCourses))
    }
  };
}

// 计算增长率
function calculateGrowth(values: number[]): number[] {
  return values.slice(1).map((value, index) => {
    const previousValue = values[index];
    return previousValue > 0 
      ? ((value - previousValue) / previousValue) * 100 
      : 0;
  });
}








