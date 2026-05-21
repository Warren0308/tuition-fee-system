import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  help?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  help?: string;
  rows?: number;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  help?: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
}

export function Input({
  label,
  error,
  help,
  icon,
  iconPosition = 'left',
  loading = false,
  className = '',
  ...props
}: InputProps) {
  const inputClasses = `
    input-modern w-full focus:outline-none
    ${icon && iconPosition === 'left' ? 'pl-10' : 'pl-4'}
    ${icon && iconPosition === 'right' ? 'pr-10' : 'pr-4'}
    ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}
    ${props.disabled ? 'opacity-50 cursor-not-allowed' : ''}
  `;

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && iconPosition === 'left' && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <div className="text-gray-400">
              {loading ? <div className="loading-spinner w-4 h-4" /> : icon}
            </div>
          </div>
        )}
        <input
          {...props}
          className={inputClasses}
        />
        {icon && iconPosition === 'right' && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <div className="text-gray-400">
              {loading ? <div className="loading-spinner w-4 h-4" /> : icon}
            </div>
          </div>
        )}
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      )}
      {help && !error && (
        <p className="mt-2 text-sm text-gray-500">{help}</p>
      )}
    </div>
  );
}

export function Textarea({
  label,
  error,
  help,
  rows = 4,
  className = '',
  ...props
}: TextareaProps) {
  const textareaClasses = `
    input-modern w-full px-4 py-3 focus:outline-none resize-none
    ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}
    ${props.disabled ? 'opacity-50 cursor-not-allowed' : ''}
  `;

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <textarea
        {...props}
        rows={rows}
        className={textareaClasses}
      />
      {error && (
        <p className="mt-2 text-sm text-red-600 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      )}
      {help && !error && (
        <p className="mt-2 text-sm text-gray-500">{help}</p>
      )}
    </div>
  );
}

export function Select({
  label,
  error,
  help,
  options,
  placeholder,
  className = '',
  ...props
}: SelectProps) {
  const selectClasses = `
    input-modern w-full px-4 py-3 focus:outline-none appearance-none bg-white
    ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}
    ${props.disabled ? 'opacity-50 cursor-not-allowed' : ''}
  `;

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <select {...props} className={selectClasses}>
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {error && (
        <p className="mt-2 text-sm text-red-600 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </p>
      )}
      {help && !error && (
        <p className="mt-2 text-sm text-gray-500">{help}</p>
      )}
    </div>
  );
}

// 搜索输入框
interface SearchInputProps extends Omit<InputProps, 'icon' | 'iconPosition'> {
  onSearch?: (value: string) => void;
  onClear?: () => void;
  clearable?: boolean;
}

export function SearchInput({
  onSearch,
  onClear,
  clearable = true,
  placeholder = '搜索...',
  className = '',
  ...props
}: SearchInputProps) {
  const [value, setValue] = React.useState(props.value || '');

  const handleSearch = () => {
    if (onSearch) {
      onSearch(value as string);
    }
  };

  const handleClear = () => {
    setValue('');
    if (onClear) {
      onClear();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <Input
        {...props}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        icon={
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        }
      />
      {clearable && value && (
        <button
          onClick={handleClear}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
