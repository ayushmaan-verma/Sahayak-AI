
import React, { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    info: 'fa-info-circle'
  };

  const colors = {
    success: 'bg-emerald-500/90 text-white shadow-emerald-500/20',
    error: 'bg-rose-500/90 text-white shadow-rose-500/20',
    info: 'bg-blue-600/90 text-white shadow-blue-500/20'
  };

  return (
    <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl glass-panel border border-white/20 shadow-2xl animate-in slide-in-from-right-8 duration-500 ${colors[type]}`}>
      <i className={`fas ${icons[type]} text-lg`}></i>
      <span className="font-black text-xs uppercase tracking-widest">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-50 hover:opacity-100">
        <i className="fas fa-times text-xs"></i>
      </button>
    </div>
  );
};

export default Toast;
