'use client';

import { cn } from '@/lib/utils';
import { createContext, useContext, useState, useCallback, forwardRef } from 'react';
import * as React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type'], duration?: number) => void;
  removeToast: (id: string) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info', duration = 3000) => {
    // 使用 crypto API 生成唯一 ID，避免 SSR 问题
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const toast: Toast = { id, message, type, duration };

    setToasts((prev) => [...prev, toast]);

    // 设置自动关闭
    const timeoutId = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);

    // 清理函数
    return () => clearTimeout(timeoutId);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // 预设方法
  const success = useCallback((message: string, duration?: number) => addToast(message, 'success', duration), [addToast]);
  const error = useCallback((message: string, duration?: number) => addToast(message, 'error', duration), [addToast]);
  const warning = useCallback((message: string, duration?: number) => addToast(message, 'warning', duration), [addToast]);
  const info = useCallback((message: string, duration?: number) => addToast(message, 'info', duration), [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}
      {/* Toast 显示在顶部中间（导航栏下方） */}
      <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2" role="region" aria-live="polite" aria-label="通知">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

interface ToastItemProps {
  toast: Toast;
  onClose: () => void;
}

const ToastItem = ({ toast, onClose }: ToastItemProps) => {
  const icons = {
    success: <CheckCircle className="w-5 h-5" aria-hidden="true" />,
    error: <XCircle className="w-5 h-5" aria-hidden="true" />,
    warning: <AlertTriangle className="w-5 h-5" aria-hidden="true" />,
    info: <Info className="w-5 h-5" aria-hidden="true" />,
  };
  const styles = {
    success: 'bg-green-500 text-white dark:bg-green-600',
    error: 'bg-red-500 text-white dark:bg-red-600',
    warning: 'bg-yellow-500 text-white dark:bg-yellow-600',
    info: 'bg-primary-500 text-white dark:bg-primary-600',
  };

  return (
    <div
      className={cn('flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg min-w-[280px]', 'animate-slide-down', styles[toast.type])}
      role="alert"
    >
      {icons[toast.type]}
      <span className="flex-1 text-sm font-medium">{toast.message}</span>
      <button
        onClick={onClose}
        className="p-1 hover:bg-white/20 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
        aria-label="关闭通知"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
};

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  message: string;
  type?: Toast['type'];
}

export const Toast = forwardRef<HTMLDivElement, ToastProps>(
  ({ className, message, type = 'info', ...props }, ref) => {
    const icons = {
      success: <CheckCircle className="w-5 h-5" aria-hidden="true" />,
      error: <XCircle className="w-5 h-5" aria-hidden="true" />,
      warning: <AlertTriangle className="w-5 h-5" aria-hidden="true" />,
      info: <Info className="w-5 h-5" aria-hidden="true" />,
    };
    const styles = {
      success: 'bg-green-500 text-white dark:bg-green-600',
      error: 'bg-red-500 text-white dark:bg-red-600',
      warning: 'bg-yellow-500 text-white dark:bg-yellow-600',
      info: 'bg-primary-500 text-white dark:bg-primary-600',
    };
    return (
      <div ref={ref} className={cn('flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg', styles[type], className)} role="alert" {...props}>
        {icons[type]}
        <span className="text-sm font-medium">{message}</span>
      </div>
    );
  }
);
Toast.displayName = 'Toast';
