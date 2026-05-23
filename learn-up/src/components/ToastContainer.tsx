'use client';

import { useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

export interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

export default function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  useEffect(() => {
    // Auto-remove toasts after 5 seconds (except for errors which stay until dismissed)
    const timers = toasts
      .filter((toast) => toast.type !== 'error')
      .map((toast) => {
        return setTimeout(() => {
          removeToast(toast.id);
        }, 5000);
      });

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [toasts, removeToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed z-50 flex-1 p-4 pointer-events-none">
      <div className="max-w-screen-sm mx-auto space-y-4 w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex w-full items-center p-4 mb-4 text-sm rounded-lg border"
            role="alert"
          >
            <div className="flex-shrink-0">
              {toast.type === 'success' && (
                <CheckCircle2 className="h-5 w-5 text-green-400" />
              )}
              {toast.type === 'error' && (
                <AlertTriangle className="h-5 w-5 text-red-400" />
              )}
              {toast.type === 'warning' && (
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              )}
              {toast.type === 'info' && (
                <Info className="h-5 w-5 text-blue-400" />
              )}
            </div>
            <div className="ml-3 w-0 flex-1">{toast.message}</div>
            <div className="flex-shrink-0">
              <button
                onClick={() => removeToast(toast.id)}
                className="ml-1 flex h-4 w-4 items-center justify-center rounded-full hover:text-gray-400"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}