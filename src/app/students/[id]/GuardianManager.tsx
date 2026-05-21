"use client";
import { useState } from "react";

interface Guardian {
  id: number;
  name: string;
  phone: string;
  isPrimary: boolean;
  relationTypeId: number | null;
  relationType?: { id: number; name: string } | null;
}

interface GuardianType {
  id: number;
  name: string;
}

interface Props {
  studentId: string;
  guardians: Guardian[];
  guardianTypes: GuardianType[];
}

export function GuardianManager({ studentId, guardians, guardianTypes }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {guardians.length === 0 ? (
        <div className="text-center py-4 text-gray-500">
          <div className="text-2xl mb-2">📞</div>
          <p>暂无监护人信息</p>
        </div>
      ) : (
        guardians.map((g) =>
          editingId === g.id ? (
            <GuardianEditForm
              key={g.id}
              studentId={studentId}
              guardian={g}
              guardianTypes={guardianTypes}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div key={g.id} className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-800">{g.name}</span>
                  {g.isPrimary && (
                    <span className="inline-flex px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                      主要
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!g.isPrimary && (
                    <form
                      action={`/api/students/${studentId}/guardians/${g.id}`}
                      method="post"
                      className="inline"
                    >
                      <input type="hidden" name="_method" value="PRIMARY" />
                      <button
                        type="submit"
                        className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="设为主要联系人"
                      >
                        ⭐
                      </button>
                    </form>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingId(g.id)}
                    className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-200 rounded"
                  >
                    ✏️ 编辑
                  </button>
                  {confirmDelete === g.id ? (
                    <form
                      action={`/api/students/${studentId}/guardians/${g.id}`}
                      method="post"
                      className="inline-flex items-center gap-1"
                    >
                      <input type="hidden" name="_method" value="DELETE" />
                      <button
                        type="submit"
                        className="text-xs px-2 py-1 bg-red-600 text-white rounded"
                      >
                        确认删除
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(null)}
                        className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-200 rounded"
                      >
                        取消
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(g.id)}
                      className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
              <div className="text-sm text-gray-600 space-y-1">
                <div>关系：{g.relationType?.name || "监护人"}</div>
                <div>电话：{g.phone}</div>
              </div>
            </div>
          )
        )
      )}

      {showAdd ? (
        <GuardianAddForm
          studentId={studentId}
          guardianTypes={guardianTypes}
          onCancel={() => setShowAdd(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition-colors"
        >
          ＋ 添加监护人
        </button>
      )}
    </div>
  );
}

function GuardianAddForm({
  studentId,
  guardianTypes,
  onCancel,
}: {
  studentId: string;
  guardianTypes: GuardianType[];
  onCancel: () => void;
}) {
  return (
    <form
      action={`/api/students/${studentId}/guardians`}
      method="post"
      className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2"
    >
      <div className="text-sm font-medium text-gray-700 mb-2">添加新监护人</div>
      <input
        name="name"
        placeholder="姓名 *"
        required
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
      />
      <select
        name="relationTypeId"
        required
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
        defaultValue=""
      >
        <option value="" disabled>
          选择关系 *
        </option>
        {guardianTypes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <input
        name="phone"
        placeholder="电话 *"
        required
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isPrimary" />
        <span>设为主要联系人</span>
      </label>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          保存
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
        >
          取消
        </button>
      </div>
    </form>
  );
}

function GuardianEditForm({
  studentId,
  guardian,
  guardianTypes,
  onCancel,
}: {
  studentId: string;
  guardian: Guardian;
  guardianTypes: GuardianType[];
  onCancel: () => void;
}) {
  return (
    <form
      action={`/api/students/${studentId}/guardians/${guardian.id}`}
      method="post"
      className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2"
    >
      <input type="hidden" name="_method" value="PATCH" />
      <div className="text-sm font-medium text-gray-700 mb-2">编辑监护人</div>
      <input
        name="name"
        defaultValue={guardian.name}
        required
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
      />
      <select
        name="relationTypeId"
        required
        defaultValue={guardian.relationTypeId ?? ""}
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
      >
        <option value="" disabled>
          选择关系 *
        </option>
        {guardianTypes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <input
        name="phone"
        defaultValue={guardian.phone}
        required
        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isPrimary"
          defaultChecked={guardian.isPrimary}
        />
        <span>设为主要联系人</span>
      </label>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="flex-1 px-3 py-1.5 bg-amber-600 text-white rounded text-sm hover:bg-amber-700"
        >
          保存修改
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
        >
          取消
        </button>
      </div>
    </form>
  );
}
