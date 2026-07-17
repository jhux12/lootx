import React from 'react';

type ErrorBoundaryProps = {
  children: React.ReactNode;
  title?: string;
  message?: string;
  actionLabel?: string;
  onRecover?: () => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('Pullz error boundary caught an error', { error, errorInfo });
    }
  }

  private recover = () => {
    this.setState({ hasError: false });
    if (this.props.onRecover) {
      this.props.onRecover();
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[60dvh] items-center justify-center bg-[#050811] px-4 py-12 text-white">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111820] p-6 text-center shadow-2xl shadow-black/30 sm:p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-2xl font-black text-cyan-200">
            P
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">{this.props.title ?? 'Pullz hit a snag'}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {this.props.message ?? 'Something unexpected happened. Your balance, account, and case results are safe. Try again to continue.'}
          </p>
          <button
            type="button"
            onClick={this.recover}
            className="mt-6 min-h-11 w-full rounded-xl bg-[#205DD7] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#1f6bea] active:scale-[0.98]"
          >
            {this.props.actionLabel ?? 'Reload Pullz'}
          </button>
        </div>
      </div>
    );
  }
}
