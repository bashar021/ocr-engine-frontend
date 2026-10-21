import { Component, type ErrorInfo, type ReactNode } from "react";
import { Alert, Button } from "antd";

type Props = { children: ReactNode };
type State = { error: Error | null };

/** Prevents a single page crash from wiping the whole shell (sidebar included). */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("AppErrorBoundary", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-0 flex-1 flex-col items-start gap-3 overflow-auto p-6">
          <Alert
            type="error"
            showIcon
            message="This page failed to render"
            description={this.state.error.message}
          />
          <Button
            type="primary"
            onClick={() => {
              this.setState({ error: null });
              window.location.assign("/ocr");
            }}
          >
            Back to Live OCR
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
