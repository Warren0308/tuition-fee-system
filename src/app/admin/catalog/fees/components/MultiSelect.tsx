import React, { useState, useRef, useEffect } from 'react';

interface Option {
  id: number;
  name: string;
  group?: string;
}

interface Group {
  name: string;
  options: Option[];
}

interface MultiSelectProps {
  options: Group[];
  value: number[];
  onChange: (value: number[]) => void;
  placeholder?: string;
}

export function MultiSelect({ options, value, onChange, placeholder = "选择选项" }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉框
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 切换选项
  const toggleOption = (optionId: number) => {
    const newValue = value.includes(optionId)
      ? value.filter(id => id !== optionId)
      : [...value, optionId];
    onChange(newValue);
  };

  // 获取选中项的显示文本
  const getDisplayText = () => {
    if (value.length === 0) return placeholder;
    if (value.length === 1) {
      const selectedOption = options
        .flatMap(group => group.options)
        .find(option => option.id === value[0]);
      return selectedOption?.name || placeholder;
    }
    return `已选择 ${value.length} 个选项`;
  };

  return (
    <div className="relative" ref={wrapperRef}>
      {/* 触发按钮 */}
      <button
        type="button"
        className="input-modern w-full text-left flex items-center justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="truncate">{getDisplayText()}</span>
        <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* 下拉选项列表 */}
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {options.map((group, groupIndex) => (
            <div key={groupIndex}>
              {/* 分组标题 */}
              <div className="px-3 py-2 bg-gray-50 text-sm font-medium text-gray-700">
                {group.name}
              </div>
              {/* 分组选项 */}
              <div className="divide-y divide-gray-100">
                {group.options.map(option => (
                  <div
                    key={option.id}
                    className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center space-x-2"
                    onClick={() => toggleOption(option.id)}
                  >
                    <div className={`w-5 h-5 border rounded flex items-center justify-center ${
                      value.includes(option.id)
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'border-gray-300'
                    }`}>
                      {value.includes(option.id) && (
                        <span className="text-white text-sm">✔</span>
                      )}
                    </div>
                    <span className="text-sm">{option.name}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}







