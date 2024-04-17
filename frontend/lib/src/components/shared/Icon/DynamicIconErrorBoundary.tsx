/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import React from "react"
import { logError } from "@streamlit/lib/src/util/log"
import { EmojiIcon } from "./Icon"

export interface State {
  error?: Error | null
}

/**
 * A component that catches errors that take place when React is asynchronously
 * rendering child components.
 */
class DynamicIconErrorBoundary extends React.PureComponent<
  React.PropsWithChildren<any>,
  State
> {
  public state: State = {
    error: null,
  }

  public static getDerivedStateFromError = (error: Error): State => {
    // Return the state update so the next render will show the fallback UI.
    return {
      error,
    }
  }

  public componentDidCatch = (error: Error): void => {
    logError(`${error.name}: ${error.message}\n${error.stack}`)
  }

  public render(): React.ReactNode {
    const { error } = this.state

    if (error && error.message.startsWith("Invalid Material")) {
      return (
        <span title={error.message}>
          <EmojiIcon {...this.props}>❌</EmojiIcon>
        </span>
      )
    }

    return this.props.children
  }
}

export default DynamicIconErrorBoundary
