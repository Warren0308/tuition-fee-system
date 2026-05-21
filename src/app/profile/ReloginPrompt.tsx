'use client';

import { signOut } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export default function ReloginPrompt() {
  const searchParams = useSearchParams();
  const activated = searchParams.get('activated') === 'true';

  if (!activated) return null;

  const handleRelogin = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <div className="card-modern animate-fade-in bg-green-50 border-green-300">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center text-3xl">
              🎉
            </div>
            <div>
              <h2 className="text-lg font-semibold text-green-800">账户激活成功！</h2>
              <p className="text-green-700 text-sm">您的资料已完善，请重新登录以使用系统的所有功能</p>
            </div>
          </div>
          <button 
            onClick={handleRelogin}
            className="btn-modern bg-green-600 hover:bg-green-700 text-white px-6 py-3 font-medium"
          >
            🔄 重新登录
          </button>
        </div>
      </div>
    </div>
  );
}






