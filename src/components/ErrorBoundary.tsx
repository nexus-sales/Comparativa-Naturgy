import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReload() {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="bg-white rounded-2xl border border-red-200 shadow-lg max-w-md w-full p-8 text-center space-y-4">
            <div className="text-4xl">⚠️</div>
            <h1 className="text-xl font-black text-slate-800">Algo ha ido mal</h1>
            <p className="text-sm text-slate-500">
              Se ha producido un error inesperado en la aplicación. Puedes intentar recargar la página.
            </p>
            {this.state.error && (
              <pre className="text-left bg-slate-100 rounded-lg p-3 text-[10px] text-slate-600 overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => this.handleReload()}
              className="w-full bg-[#002855] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#003875] transition-colors"
            >
              Recargar aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
