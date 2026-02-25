import { cn } from '@/lib/utils';
import { forwardRef, useId } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  state?: 'default' | 'error' | 'success';
  errorMessage?: string;
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, state = 'default', errorMessage, label, id: propsId, ...props }, ref) => {
    const generatedId = useId();
    const inputId = propsId || generatedId;
    const errorId = `${inputId}-error`;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'flex h-11 w-full rounded-xl border bg-white px-4 py-2.5 text-sm',
            'placeholder:text-gray-400 placeholder:text-sm',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            'transition-all duration-200',
            // 状态样式
            state === 'default'
              ? 'border-gray-200 focus:border-primary-500 focus:ring-primary-500/20 hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-primary-400 dark:hover:border-gray-500'
              : state === 'error'
                ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 hover:border-red-300 dark:border-red-500 dark:bg-gray-800 dark:text-gray-100'
                : 'border-green-400 focus:border-green-500 focus:ring-green-500/20 hover:border-green-300 dark:border-green-500 dark:bg-gray-800 dark:text-gray-100',
            className
          )}
          aria-invalid={state === 'error'}
          aria-describedby={errorMessage ? errorId : undefined}
          {...props}
        />
        {errorMessage && (
          <p id={errorId} className="mt-1.5 text-sm text-red-500 flex items-center gap-1" role="alert">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {errorMessage}
          </p>
        )}
      </div>
    )
  }
);
Input.displayName = 'Input';
