import { cn } from '@/lib/utils';
import { forwardRef } from 'react';
import { Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'info', title, dismissible, onDismiss, children, ...props }, ref) => {
    const variants = {
      info: {
        container: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-200',
        icon: 'text-blue-500 dark:text-blue-400',
        closeButton: 'hover:bg-black/5 dark:hover:bg-white/10'
      },
      success: {
        container: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-800 dark:text-green-200',
        icon: 'text-green-500 dark:text-green-400',
        closeButton: 'hover:bg-black/5 dark:hover:bg-white/10'
      },
      warning: {
        container: 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-200',
        icon: 'text-yellow-500 dark:text-yellow-400',
        closeButton: 'hover:bg-black/5 dark:hover:bg-white/10'
      },
      error: {
        container: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-200',
        icon: 'text-red-500 dark:text-red-400',
        closeButton: 'hover:bg-black/5 dark:hover:bg-white/10'
      },
    };

    const icons = { info: Info, success: CheckCircle, warning: AlertTriangle, error: XCircle };
    const Icon = icons[variant];

    return (
      <div ref={ref} className={cn('flex gap-3 p-4 rounded-lg border', variants[variant].container, className)} role="alert" {...props}>
        <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', variants[variant].icon)} aria-hidden="true" />
        <div className="flex-1">
          {title && <p className="font-medium mb-1">{title}</p>}
          <div className="text-sm">{children}</div>
        </div>
        {dismissible && (
          <button
            onClick={onDismiss}
            className={cn('flex-shrink-0 p-1 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-current', variants[variant].closeButton)}
            aria-label="关闭提示"
          >
            <XCircle className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }
);
Alert.displayName = 'Alert';
