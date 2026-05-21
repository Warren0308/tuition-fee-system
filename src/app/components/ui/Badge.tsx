import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  className?: string;
}

export function Badge({
  children,
  variant = 'primary',
  size = 'md',
  dot = false,
  className = '',
}: BadgeProps) {
  const getVariantClasses = () => {
    const variants = {
      primary: 'bg-indigo-100 text-indigo-800',
      secondary: 'bg-gray-100 text-gray-800',
      success: 'bg-emerald-100 text-emerald-800',
      warning: 'bg-amber-100 text-amber-800',
      danger: 'bg-red-100 text-red-800',
      info: 'bg-blue-100 text-blue-800',
    };
    return variants[variant];
  };

  const getSizeClasses = () => {
    const sizes = {
      sm: 'px-2 py-1 text-xs',
      md: 'px-2.5 py-1.5 text-sm',
      lg: 'px-3 py-2 text-base',
    };
    return sizes[size];
  };

  const baseClasses = 'inline-flex items-center font-medium rounded-full';
  const variantClasses = getVariantClasses();
  const sizeClasses = getSizeClasses();

  if (dot) {
    return (
      <span className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`}>
        <span className={`w-2 h-2 rounded-full mr-2 ${
          variant === 'primary' ? 'bg-indigo-600' :
          variant === 'secondary' ? 'bg-gray-600' :
          variant === 'success' ? 'bg-emerald-600' :
          variant === 'warning' ? 'bg-amber-600' :
          variant === 'danger' ? 'bg-red-600' :
          'bg-blue-600'
        }`} />
        {children}
      </span>
    );
  }

  return (
    <span className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`}>
      {children}
    </span>
  );
}

// 状态徽章组件
interface StatusBadgeProps {
  status: 'active' | 'inactive' | 'pending' | 'completed' | 'cancelled' | 'paid' | 'unpaid';
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const getStatusConfig = () => {
    const configs = {
      active: { variant: 'success' as const, text: '活跃', dot: true },
      inactive: { variant: 'secondary' as const, text: '停用', dot: true },
      pending: { variant: 'warning' as const, text: '待处理', dot: true },
      completed: { variant: 'success' as const, text: '已完成', dot: false },
      cancelled: { variant: 'danger' as const, text: '已取消', dot: false },
      paid: { variant: 'success' as const, text: '已支付', dot: true },
      unpaid: { variant: 'danger' as const, text: '未支付', dot: true },
    };
    return configs[status];
  };

  const config = getStatusConfig();

  return (
    <Badge
      variant={config.variant}
      dot={config.dot}
      size="sm"
      className={className}
    >
      {config.text}
    </Badge>
  );
}

// 数量徽章组件
interface CountBadgeProps {
  count: number;
  max?: number;
  className?: string;
}

export function CountBadge({ count, max = 99, className = '' }: CountBadgeProps) {
  const displayCount = count > max ? `${max}+` : count.toString();
  
  if (count === 0) {
    return null;
  }

  return (
    <Badge variant="danger" size="sm" className={className}>
      {displayCount}
    </Badge>
  );
}
