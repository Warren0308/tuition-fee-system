"use client";

import { useState } from "react";

interface TermOption {
  id: number;
  period: number;
  label: string;
}

interface Props {
  studentId: string;
  studentName: string;
  terms: TermOption[];
  status: "active" | "stopped" | "none";
  lastPeriod?: number | null;
  redirect?: string;
}

export function StopTutoringPanel({
  studentId,
  studentName,
  terms,
  status,
  lastPeriod,
  redirect,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [lastTermId, setLastTermId] = useState(
    terms.length > 0 ? String(terms[terms.length - 1].id) : ""
  );
  const [confirming, setConfirming] = useState(false);

  if (terms.length === 0) return null;

  if (status === "stopped" && !expanded) {
    return (
      <div className="card-modern border border-gray-200">
        <div className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎓</span>
            <div>
              <p className="font-medium text-gray-800">
                已停止补习
                {lastPeriod != null && (
                  <span className="ml-2 text-sm font-normal text-gray-600">
                    （最后就读第{lastPeriod}期）
                  </span>
                )}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                之后各期不会出现在待支付列表；历史账单保留
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="btn-modern bg-gray-100 text-gray-700 px-3 py-2 text-sm hover:bg-gray-200"
            >
              调整停止学期
            </button>
            <form action={`/api/students/${studentId}/stop-tutoring`} method="post">
              <input type="hidden" name="action" value="resume" />
              {redirect && <input type="hidden" name="redirect" value={redirect} />}
              <button
                type="submit"
                className="btn-modern bg-emerald-100 text-emerald-800 px-3 py-2 text-sm hover:bg-emerald-200"
                onClick={(e) => {
                  if (
                    !confirm(
                      `确定恢复 ${studentName} 的在读状态？\n所有已结束的选课/额外费用将重新设为「进行中」，之后各期会再次出现在待支付。`
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                恢复在读
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (status === "none") return null;

  return (
    <div className="card-modern border border-amber-200 bg-amber-50/40">
      <div className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">🛑</span>
          <div>
            <p className="font-medium text-gray-800">停止补习</p>
            <p className="text-sm text-gray-600 mt-1">
              选择<strong>最后一期就读</strong>，之后各期将不再出现在待支付、批量结算和缴费提醒中。
              与「停用档案」不同，历史账单和资料仍保留。
            </p>
          </div>
        </div>

        <form
          action={`/api/students/${studentId}/stop-tutoring`}
          method="post"
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            if (!confirming) {
              e.preventDefault();
              setConfirming(true);
              return;
            }
            const selected = terms.find((t) => String(t.id) === lastTermId);
            if (
              !confirm(
                `确认：${studentName} 的最后就读期为 ${selected?.label ?? ""}？\n从下一期起不再计费，也不会出现在待支付列表。`
              )
            ) {
              e.preventDefault();
              setConfirming(false);
            }
          }}
        >
          <input type="hidden" name="action" value="stop" />
          {redirect && <input type="hidden" name="redirect" value={redirect} />}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              最后一期就读
            </label>
            <select
              name="lastTermId"
              value={lastTermId}
              onChange={(e) => {
                setLastTermId(e.target.value);
                setConfirming(false);
              }}
              className="input-modern w-full"
              required
            >
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                  {t.period < terms.length ? `（第${t.period + 1}期起停止）` : ""}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="btn-modern bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5"
          >
            {confirming ? "确认停止补习" : "停止补习"}
          </button>
          {status === "stopped" && expanded && (
            <button
              type="button"
              className="btn-modern bg-gray-200 text-gray-700 px-4 py-2.5"
              onClick={() => {
                setExpanded(false);
                setConfirming(false);
              }}
            >
              取消
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
