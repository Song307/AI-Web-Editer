import React, { forwardRef } from 'react';

interface InputProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'url' | 'search';
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  label?: string;
  error?: string;
  size?: 'sm' | 'md' | 'lg';
}

const Input = forwardRef<HTMLInputElement, InputProps>(({
  type = 'text',
  placeholder,
  value,
  onChange,
  disabled = false,
  required = false,
  className = '',
  label,
  error,
  size = 'md',
}, ref) => {
  const baseClasses = 'w-full border rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  };

  const borderClasses = error
    ? 'border-red-300 dark:border-red-600 focus:border-red-500 focus:ring-red-500/20'
    : 'border-gray-300 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500/20';

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        ref={ref}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        className={`${baseClasses} ${sizeClasses[size]} ${borderClasses} ${className}`}
      />
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
