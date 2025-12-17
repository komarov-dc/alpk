'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  nodeId?: string;
  nodeType?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary specifically for node components
 * Provides more specific error handling for workflow nodes
 */
class NodeErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch() {
    // Error logging handled by error boundary service
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full min-h-[120px] bg-red-50 border-2 border-red-300 rounded-lg p-4 flex flex-col items-center justify-center">
          <div className="text-red-600 text-sm font-medium mb-2">
            Node Error ({this.props.nodeType || 'Unknown'})
          </div>
          
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div className="text-xs text-red-500 mb-3 text-center max-w-full">
              {this.state.error.message}
            </div>
          )}
          
          <button
            onClick={this.handleReset}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
          >
            Retry Node
          </button>
          
          {this.props.nodeId && (
            <div className="text-xs text-gray-500 mt-2">
              ID: {this.props.nodeId.slice(0, 8)}...
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default NodeErrorBoundary;