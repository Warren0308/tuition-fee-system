'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface UserActionsProps {
  userId: string;
  isActive: boolean;
}

export default function UserActions({ userId, isActive }: UserActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (loading) return;
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('userId', userId);
      
      await fetch('/api/admin/users/toggle', {
        method: 'POST',
        body: formData
      });
      
      router.refresh();
    } catch (error) {
      console.error('切换状态失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (loading) return;
    if (!confirm('确定要重置该用户的密码吗？密码将被重置为用户名。')) return;
    
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('userId', userId);
      
      await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        body: formData
      });
      
      alert('密码已重置为用户名');
      router.refresh();
    } catch (error) {
      console.error('重置密码失败:', error);
      alert('重置密码失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center flex-wrap gap-1">
      <button 
        className={`btn-modern px-3 py-1 text-xs transition-colors ${
          isActive 
            ? 'bg-orange-100 text-orange-600 hover:bg-orange-200' 
            : 'bg-green-100 text-green-600 hover:bg-green-200'
        }`}
        onClick={handleToggle}
        disabled={loading}
      >
        {loading ? '...' : (isActive ? '停用' : '启用')}
      </button>
      <button 
        className="btn-modern bg-yellow-100 text-yellow-700 px-3 py-1 text-xs hover:bg-yellow-200 transition-colors"
        onClick={handleResetPassword}
        disabled={loading}
      >
        重置密码
      </button>
    </div>
  );
}

