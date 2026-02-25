import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

export interface DividerProps extends React.HTMLAttributes<HTMLHRElement> {
  orientation?: 'horizontal' | 'vertical';
  label?: string;
  labelPosition?: 'left' | 'center' | 'right';
}

export const Divider = forwardRef<HTMLHRElement, DividerProps>(
  ({ className, orientation = 'horizontal', label, labelPosition = 'center', ...props }, ref) => {
    if (orientation === 'vertical') {
      return <hr ref={ref} className={cn('w-px h-full bg-gradient-to-b from-transparent via-gray-200 dark:via-gray-600 to-transparent border-0', className)} aria-orientation="vertical" {...props} />;
    }
    if (label) {
      return (
        <div
          className={cn(
            'flex items-center text-gray-400 dark:text-gray-500 text-sm',
            'before:content-[attr(data-label)] before:mr-4',
            'after:content-[attr(data-label)] after:ml-4',
            'before:bg-gradient-to-r before:from-transparent before:via-gray-200 dark:before:via-gray-600 before:h-px',
            'after:bg-gradient-to-r after:via-gray-200 dark:after:via-gray-600 after:to-transparent after:h-px',
            labelPosition === 'left' ? 'before:flex-1' : labelPosition === 'right' ? 'after:flex-1' : 'before:flex-1 after:flex-1',
            className
          )}
          data-label={label}
          role="separator"
          aria-orientation="horizontal"
          {...props}
        >
          {label}
        </div>
      );
    }
    return <hr ref={ref} className={cn('w-full h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-600 to-transparent border-0', className)} aria-orientation="horizontal" {...props} />;
  }
);
Divider.displayName = 'Divider';
