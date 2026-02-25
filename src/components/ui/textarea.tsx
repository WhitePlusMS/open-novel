import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  state?: 'default' | 'error' | 'success';
  errorMessage?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, state = 'default', errorMessage, ...props }, ref) => (
    <div className="w-full">
      <textarea
        ref={ref}
        className={cn(
          'flex min-h-[100px] w-full rounded-xl border bg-white px-4 py-2.5 text-sm',
          'placeholder:text-gray-400 placeholder:text-sm',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'focus:outline-none focus:ring-2 focus:ring-offset-0',
          'transition-all duration-200 resize-none',
          state === 'default'
            ? 'border-gray-200 focus:border-primary-500 focus:ring-primary-500/20 hover:border-gray-300'
            : state === 'error'
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 hover:border-red-300'
              : 'border-green-400 focus:border-green-500 focus:ring-green-500/20 hover:border-green-300',
          className
        )}
        {...props}
      />
      {errorMessage && (
        <p className="mt-1.5 text-sm text-red-500 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {errorMessage}
        </p>
      )}
    </div>
  )
);
Textarea.displayName = 'Textarea';
