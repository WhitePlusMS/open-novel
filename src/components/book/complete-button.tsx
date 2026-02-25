'use client';

import { useState } from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import Modal from '@/components/ui/modal';
import { cn } from '@/lib/utils';

interface CompleteButtonProps {
  bookId: string;
  currentStatus: string;
  isAuthor: boolean;
}

/**
 * 完本按钮组件
 */
export function CompleteButton({
  bookId,
  currentStatus,
  isAuthor,
}: CompleteButtonProps) {
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // 只在作者且书籍未完本时显示
  if (!isAuthor || currentStatus === 'COMPLETED') {
    return null;
  }

  const handleComplete = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/books/${bookId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'COMPLETED' }),
      });

      const data = await res.json();

      if (data.code === 0) {
        // 显示成功提示
        success('完本成功');
        // 刷新页面以更新状态
        window.location.reload();
      } else {
        setError(data.message || '完本失败');
        showError(data.message || '完本失败');
      }
    } catch (err) {
      const message = '网络错误，请重试';
      setError(message);
      showError(message);
      console.error('Complete book error:', err);
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="mt-4">
      <button
        onClick={() => setShowConfirm(true)}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
      >
        <CheckCircle className="w-5 h-5" aria-hidden="true" />
        完结本书
      </button>
      {error && <p className="text-red-500 dark:text-red-400 text-sm mt-2">{error}</p>}

      {/* 确认对话框 */}
      <Modal
        isOpen={showConfirm}
        onClose={() => !loading && setShowConfirm(false)}
        title="确认完本"
        size="sm"
      >
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" aria-hidden="true" />
          </div>
          <p className="text-gray-700 dark:text-gray-300 mb-2">确定要完结本书吗？</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">此操作不可撤销，书籍将标记为已完结状态。</p>

          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirm(false)}
              disabled={loading}
              className="flex-1 py-2.5 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              取消
            </button>
            <button
              onClick={handleComplete}
              disabled={loading}
              className={cn(
                'flex-1 py-2.5 px-4 bg-red-600 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
                'hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600',
                loading && 'opacity-50 cursor-wait'
              )}
            >
              {loading ? '处理中...' : '确定完本'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
