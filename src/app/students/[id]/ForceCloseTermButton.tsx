"use client";

interface Props {
  studentId: string;
  year: number;
  termIndex: number;
  termLabel: string;
  paidCents?: number;
  forceClosed: boolean;
  canManage: boolean;
}

export function ForceCloseTermButton({
  studentId,
  year,
  termIndex,
  termLabel,
  paidCents,
  forceClosed,
  canManage,
}: Props) {
  if (!canManage) return null;

  if (forceClosed) {
    return (
      <form
        action={`/api/students/${studentId}/force-close-term`}
        method="post"
        className="inline"
        onSubmit={(e) => {
          if (
            !confirm(
              `取消「${termLabel}」的强制结清？\n取消后若仍有欠费，会重新出现在待支付。`
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="action" value="undo" />
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="termIndex" value={termIndex} />
        <button
          type="submit"
          className="btn-modern bg-gray-100 text-gray-600 px-2 py-1 text-xs hover:bg-gray-200"
          title="取消强制结清"
        >
          取消结清
        </button>
      </form>
    );
  }

  return (
    <form
      action={`/api/students/${studentId}/force-close-term`}
      method="post"
      className="inline"
      onSubmit={(e) => {
        const paid =
          paidCents != null && paidCents > 0
            ? `\n已收：RM ${(paidCents / 100).toFixed(2)}`
            : "\n（本期尚无账单，确认后视为无需再收）";
        if (
          !confirm(
            `强制结清「${termLabel}」？${paid}\n\n表示本期不再追收其他项目，该期将从待支付列表移除。`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="action" value="close" />
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="termIndex" value={termIndex} />
      <button
        type="submit"
        className="btn-modern bg-slate-600 hover:bg-slate-700 text-white px-3 py-1 text-xs font-medium"
        title="确认本期已结清，不再追收"
      >
        ✓ 强制结清
      </button>
    </form>
  );
}
