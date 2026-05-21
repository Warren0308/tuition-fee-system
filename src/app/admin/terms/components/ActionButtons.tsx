'use client';

export function ActionButtons() {
  const handleSubmit = async (formId: string) => {
    const form = document.getElementById(formId) as HTMLFormElement;
    if (!form) return;

    try {
      const formData = new FormData(form);
      const response = await fetch(form.action, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('提交失败');
      }

      window.location.reload();
    } catch (error) {
      console.error('提交失败:', error);
      alert('操作失败，请重试');
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleSubmit('term1-form')}
        className="btn-modern bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm"
      >
        🎯 保存Term1设置
      </button>
      <button
        onClick={() => handleSubmit('generate-form')}
        className="btn-modern bg-green-600 hover:bg-green-700 text-white px-4 py-2 text-sm"
      >
        🚀 重新生成学期
      </button>
    </div>
  );
}