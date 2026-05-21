"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  formatTermLabel,
  getBillingPeriodColorClass,
} from "@/lib/term-utils";

interface Term {
  id: number;
  year: number;
  termIndex: number;
  period: number;
  startDate: Date;
  endDate: Date;
}

interface YearCalendarProps {
  terms: Term[];
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function YearCalendar({ terms }: YearCalendarProps) {
  const [todayUTC8, setTodayUTC8] = useState<{
    year: number;
    month: number;
    day: number;
  } | null>(null);

  useEffect(() => {
    const now = new Date();
    const utc8Offset = 8 * 60;
    const localOffset = now.getTimezoneOffset();
    const utc8Time = new Date(now.getTime() + (localOffset + utc8Offset) * 60 * 1000);
    setTodayUTC8({
      year: utc8Time.getFullYear(),
      month: utc8Time.getMonth(),
      day: utc8Time.getDate(),
    });
  }, []);

  const monthsToShow = useMemo(() => {
    if (terms.length === 0) {
      return [{ year: 2026, monthIndex: 0 }];
    }
    const starts = terms.map((t) => new Date(t.startDate));
    const ends = terms.map((t) => new Date(t.endDate));
    const min = new Date(Math.min(...starts.map((d) => d.getTime())));
    const max = new Date(Math.max(...ends.map((d) => d.getTime())));

    const list: { year: number; monthIndex: number }[] = [];
    let y = min.getFullYear();
    let m = min.getMonth();
    const endY = max.getFullYear();
    const endM = max.getMonth();

    while (y < endY || (y === endY && m <= endM)) {
      list.push({ year: y, monthIndex: m });
      m++;
      if (m > 11) {
        m = 0;
        y++;
      }
    }
    return list;
  }, [terms]);

  function getTermForDate(date: Date): Term | null {
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return (
      terms.find((term) => {
        const start = new Date(term.startDate);
        const end = new Date(term.endDate);
        const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        return targetDate >= s && targetDate <= e;
      }) || null
    );
  }

  function isToday(checkYear: number, checkMonth: number, checkDay: number): boolean {
    if (!todayUTC8) return false;
    return (
      todayUTC8.year === checkYear &&
      todayUTC8.month === checkMonth &&
      todayUTC8.day === checkDay
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {monthsToShow.map(({ year, monthIndex }) => {
        const startDay = new Date(year, monthIndex, 1).getDay();
        const days = new Date(year, monthIndex + 1, 0).getDate();
        const emptyDays = Array.from({ length: startDay }, (_, i) => i);
        const monthName = MONTH_NAMES[monthIndex];

        return (
          <div
            key={`${year}-${monthIndex}`}
            className="bg-white rounded-lg shadow-sm border border-gray-200"
          >
            <div className="bg-blue-500 text-white px-4 py-2 rounded-t-lg">
              <h3 className="text-center font-semibold">
                {monthName} {year}
              </h3>
            </div>
            <div className="p-2">
              <div className="grid grid-cols-7 gap-1 mb-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs font-medium text-gray-500 py-1"
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {emptyDays.map((day) => (
                  <div key={`empty-${day}`} className="h-8" />
                ))}
                {Array.from({ length: days }, (_, i) => i + 1).map((day) => {
                  const date = new Date(year, monthIndex, day);
                  const term = getTermForDate(date);
                  const isTodayDate = isToday(year, monthIndex, day);
                  const period = term ? term.period : null;

                  return (
                    <div
                      key={day}
                      className={`h-8 flex items-center justify-center text-sm rounded-full transition-colors relative
                        ${isTodayDate ? "ring-2 ring-red-500 ring-offset-1 font-bold text-red-600" : ""}
                        ${
                          term && period
                            ? `${getBillingPeriodColorClass(period)} cursor-help`
                            : "hover:bg-gray-100"
                        }
                      `}
                      title={
                        isTodayDate
                          ? `今天${term && period ? ` · 第${period}期` : ""}`
                          : term && period
                            ? `${formatTermLabel(term.year, term.termIndex, terms)} (${new Date(term.startDate).toLocaleDateString("zh-CN")} - ${new Date(term.endDate).toLocaleDateString("zh-CN")})`
                            : ""
                      }
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
