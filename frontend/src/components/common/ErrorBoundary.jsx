import React from 'react';
import { AlertTriangle } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled React Error caught by ErrorBoundary:', error, errorInfo);
    const msg = error?.message || '';
    if (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('dynamically imported module')
    ) {
      if (!sessionStorage.getItem('chunk_load_retry')) {
        sessionStorage.setItem('chunk_load_retry', '1');
        window.location.reload();
      }
    }
  }

  handleReset = async () => {
    try {
      localStorage.removeItem('aurora_active_view');
      localStorage.removeItem('aurora_active_menu');
      if (typeof window !== 'undefined' && 'caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
    } catch {
      // Ignored
    }
    this.setState({ hasError: false, error: null });
    window.location.replace(window.location.pathname);
  };

  handleLogoutAndReset = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if (typeof window !== 'undefined' && 'caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }
    } catch {
      // Ignored
    }
    window.location.replace(window.location.pathname);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-screen bg-[#FAF8F5] text-[#1A1917] flex flex-col items-center justify-center p-6 font-sans select-none text-center">
          <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-[#E5E1D8] shadow-xl space-y-6">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-amber-800" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900">Đã xảy ra sự cố hiển thị</h2>
              <p className="text-xs text-stone-500 mt-1">
                {this.state.error?.message || 'Giao diện gặp lỗi kết nối tạm thời hoặc bộ nhớ đệm cũ.'}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="w-full py-3 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                Tải lại trang (Khôi phục mặc định)
              </button>
              <button
                type="button"
                onClick={this.handleLogoutAndReset}
                className="w-full py-2.5 rounded-2xl bg-[#EBE7DE] hover:bg-[#E2DDCF] text-stone-700 text-xs font-bold transition-all cursor-pointer"
              >
                Xóa bộ nhớ đệm &amp; Đăng nhập lại
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
