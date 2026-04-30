import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Errore UI catturato:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <section className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          <h2 className="font-bold">{this.props.fallbackTitle ?? "Questa sezione non puo essere mostrata."}</h2>
          <p className="mt-2">
            La UI ha ricevuto un dato non previsto. Il resto della console resta disponibile.
          </p>
          <pre className="mt-3 overflow-auto rounded-lg bg-white/70 p-3 text-xs">{this.state.error.message}</pre>
        </section>
      );
    }

    return this.props.children;
  }
}
