"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * ErrorBoundary — catches runtime errors in child components.
 * Renders a friendly error UI instead of crashing the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || "Error desconocido",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production you'd send this to Sentry/LogRocket
    console.error("[ErrorBoundary] Caught error:", error, info);
  }

  reset = () => {
    this.setState({ hasError: false, errorMessage: "" });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-6">
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Algo salió mal</h2>
          <p className="text-gray-400 text-sm max-w-xs mb-6 leading-relaxed">
            Ocurrió un error inesperado en esta sección. Intenta recargarla o
            regresa al inicio.
          </p>
          <p className="text-xs text-gray-600 font-mono bg-gray-900 px-3 py-2 rounded-lg mb-6 max-w-xs truncate">
            {this.state.errorMessage}
          </p>
          <div className="flex gap-3">
            <button
              onClick={this.reset}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-gold text-brand-black font-bold rounded-full hover:bg-white transition-all text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Reintentar
            </button>
            <a
              href="/dashboard"
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white border border-gray-700 font-semibold rounded-full hover:border-brand-gold/50 transition-all text-sm"
            >
              <Home className="w-4 h-4" />
              Inicio
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
