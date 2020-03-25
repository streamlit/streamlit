/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactNode, PureComponent } from "react"
import classNames from "classnames"
import { Map as ImmutableMap } from "immutable"
import { StreamlitMarkdown } from "components/shared/StreamlitMarkdown"
import "./ExceptionElement.scss"

export interface Props {
  width: number
  element: ImmutableMap<string, any>
}

/**
 * Functional element representing formatted text.
 */
class ExceptionElement extends PureComponent<Props> {
  public render(): ReactNode {
    const { element, width } = this.props

    const type = element.get("type")
    const message = element.get("message")
    const stackTrace = element.get("stackTrace")
    const isWarning = element.get("isWarning")

    // Build the message display.
    // On the backend, we use the StreamlitException type for errors that
    // originate from inside Streamlit. These errors have Markdown-formatted
    // messages, and so we wrap those messages inside our Markdown renderer.
    let messageNode: ReactNode
    if (element.get("messageIsMarkdown")) {
      let markdown = `**${type}**`
      if (message) {
        markdown += `: ${message}`
      }
      messageNode = <StreamlitMarkdown source={markdown} allowHTML={false} />
    } else {
      messageNode = (
        <>
          <span className="type">{type}</span>
          {message != null ? `: ${message}` : null}
        </>
      )
    }

    // Build the stack trace display, if we got a stack trace.
    let stackTraceNode: ReactNode = null
    if (stackTrace && stackTrace.size > 0) {
      stackTraceNode = (
        <>
          <div className="stack-trace-title">Traceback:</div>
          <pre className="stack-trace">
            <code>
              {stackTrace.map((row: string, indx: string) => (
                <div className="stack-trace-row" key={indx}>
                  {row}
                </div>
              ))}
            </code>
          </pre>
        </>
      )
    }

    const wrapperClasses = classNames("alert", "exception", "stException", {
      "alert-danger": !isWarning,
      "alert-warning": isWarning,
    })

    return (
      <div className={wrapperClasses} style={{ width }}>
        <div className="message">{messageNode}</div>
        {stackTraceNode}
      </div>
    )
  }
}

export default ExceptionElement
