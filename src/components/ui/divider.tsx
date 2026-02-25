import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  label?: string;
  labelPosition?: 'left' | 'center' | 'right';
}

export const Divider = forwardRef<HTMLDivElement, DividerProps>(
  ({ className, orientation = 'horizontal', label, labelPosition = 'center', ...props }, ref) => {
    if (orientation === 'vertical') {
      return <div ref={ref} className={cn('w-px h-full bg-gradient-to-b from-transparent via-gray-200 to-transparent', className)} {...props} />;
    }
    if (label) {
      return (
        <div
          ref={ref}
          className={cn(
            'flex items-center text-gray-400 text-sm',
            'before:content-[attr(data-label)] before:mr-4',
            'after:content-[attr(data-label)] after:ml-4',
            'before:bg-gradient-to-r before:from-transparent before:via-gray-200 before:h-px',
            'after:bg-gradient-to-r after:via-gray-200 after:to-transparent after:h-px',
            labelPosition === 'left' ? 'before:flex-1' : labelPosition === 'right' ? 'after:flex-1' : 'before:flex-1 after:flex-1',
            className
          )}
          data-label={label}
          {...props}
        >
          {label}
        </div>
      );
    }
    return <div ref={ref} className={cn('w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent', className)} {...props} />;
  }
);
Divider.displayName = 'Divider';
