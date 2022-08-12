import React from "react"
import ErrorElement from "src/components/shared/ErrorElement/"
import { logError } from "src/lib/log"

export interface Props {
  width?: number
}

export interface State {
  error?: Error | null
}

/**
 * A component that catches errors that take place when React is asynchronously
 * rendering child components.
 */
class ErrorBoundary extends React.PureComponent<Props, State> {
  public state: State = {
    error: null,
  }

  public static getDerivedStateFromError = (error: Error): State => {
    // Return the state update so the next render will show the fallback UI.
    return {
      error,
    }
  }

  public componentDidCatch = (error: Error, info: React.ErrorInfo): void => {
    logError(`${error.name}: ${error.message}\n${error.stack}`)
  }

  public render(): React.ReactNode {
    const { error } = this.state

    if (error) {
      if (error.name === "ChunkLoadError") {
        return (
          <ErrorElement
            width={this.props.width}
            name="Network issue"
            message={
              <p>
                Cannot load Streamlit frontend code. This can happen when you
                update Streamlit while a Streamlit app is running.
                <br />
                To fix this, simply reload this app by pressing <kbd>
                  F5
                </kbd>, <kbd>Ctrl+R</kbd>, or <kbd>Cmd+R</kbd>.
                <br />
                If the error persists, try force-clearing your browser's cache
                as described{" "}
                <a
                  href="https://en.wikipedia.org/wiki/Wikipedia:Bypass_your_cache#Cache_clearing_and_disabling"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  here
                </a>
              </p>
            }
          />
        )
      }

      return (
        <ErrorElement
          width={this.props.width}
          name={error.name}
          message={error.message}
          stack={error.stack}
        />
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
