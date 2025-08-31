/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { PureComponent } from "react"

import { getLogger } from "loglevel"

import { StyledInlineCode } from "~lib/components/elements/CodeBlock/styled-components"
import ErrorElement from "~lib/components/shared/ErrorElement"

export interface Props {
  width?: number
}

export interface State {
  error?: Error | null
}

const LOG = getLogger("ErrorBoundary")

/**
 * A component that catches errors that take place when React is asynchronously
 * rendering child components.
 */
class ErrorBoundary extends PureComponent<
  React.PropsWithChildren<Props>,
  State
> {
  public override state: State = {
    error: null,
  }

  public static getDerivedStateFromError = (error: Error): State => {
    // Return the state update so the next render will show the fallback UI.
    return {
      error,
    }
  }

  public override componentDidCatch = (error: Error): void => {
    LOG.error(`${error.name}: ${error.message}\n${error.stack}`)
  }

  public override render(): React.ReactNode {
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
                To fix this, simply reload this app by pressing{" "}
                <StyledInlineCode>F5</StyledInlineCode>,{" "}
                <StyledInlineCode>Ctrl+R</StyledInlineCode>, or{" "}
                <StyledInlineCode>Cmd+R</StyledInlineCode>.
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
