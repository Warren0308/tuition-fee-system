import React from 'react';
import Link from 'next/link';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

interface LinkButtonProps extends Omit<ButtonProps, 'onClick' | 'type'> {
  href: string;
}

const getVariantClasses = (variant: ButtonProps['variant'] = 'primary') => {
  const variants = {
    primary: 'bg-gradient-primary text-white hover:shadow-lg',
    secondary: 'bg-gradient-secondary text-white hover:shadow-lg',
    success: 'bg-gradient-success text-white hover:shadow-lg',
    warning: 'bg-gradient-warning text-white hover:shadow-lg',
    danger: 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:shadow-lg',
    ghost: 'bg-transparent border-2 border-gray-300 text-gray-700 hover:border-indigo-500 hover:text-indigo-600',
  };
  return variants[variant];
};

const getSizeClasses = (size: ButtonProps['size'] = 'md') => {
  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
  };
  return sizes[size];
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  className = '',
  onClick,
  type = 'button',
}: ButtonProps) {
  const baseClasses = 'btn-modern inline-flex items-center justify-center font-medium rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed';
  const variantClasses = getVariantClasses(variant);
  const sizeClasses = getSizeClasses(size);

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`}
    >
      {loading ? (
        <>
          <div className="loading-spinner mr-2" />
          <span>加载中...</span>
        </>
      ) : (
        <>
          {icon && <span className="mr-2">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
}

export function LinkButton({
  children,
  href,
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
}: LinkButtonProps) {
  const baseClasses = 'btn-modern inline-flex items-center justify-center font-medium rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500';
  const variantClasses = getVariantClasses(variant);
  const sizeClasses = getSizeClasses(size);

  return (
    <Link
      href={href}
      className={`${baseClasses} ${variantClasses} ${sizeClasses} ${className}`}
    >
      {icon && <span className="mr-2">{icon}</span>}
      {children}
    </Link>
  );
}
