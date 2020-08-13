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

import React, { ReactElement } from "react"
import classNames from "classnames"
import { Map as ImmutableMap } from "immutable"
import { StreamlitMarkdown } from "components/shared/StreamlitMarkdown"
import "./ExceptionElement.scss"

export interface ExceptionElementProps {
  width: number
  element: ImmutableMap<string, any>
}

interface ExceptionMessageProps {
  type: string
  message: string
  messageIsMarkdown: boolean
}

interface StackTraceProps {
  stackTrace: string[]
}

function ExceptionMessage({
  type,
  message,
  messageIsMarkdown,
}: ExceptionMessageProps): ReactElement {
  // Build the message display.
  // On the backend, we use the StreamlitException type for errors that
  // originate from inside Streamlit. These errors have Markdown-formatted
  // messages, and so we wrap those messages inside our Markdown renderer.

  if (messageIsMarkdown) {
    let markdown = `**${type}**`
    if (message) {
      markdown += `: ${message}`
    }
    return <StreamlitMarkdown source={markdown} allowHTML={false} />
  }
  return (
    <>
      <span className="type">{type}</span>
      {message != null ? `: ${message}` : null}
    </>
  )
}

function StackTrace({ stackTrace }: StackTraceProps): ReactElement {
  // Build the stack trace display, if we got a stack trace.
  return (
    <>
      <div className="stack-trace-title">Traceback:</div>
      <pre className="stack-trace">
        <code>
          {stackTrace.map((row: string, index: number) => (
            <div className="stack-trace-row" key={index}>
              {row}
            </div>
          ))}
        </code>
      </pre>
    </>
  )
}

/**
 * Functional element representing formatted text.
 */
export default function ExceptionElement({
  element,
  width,
}: ExceptionElementProps): ReactElement {
  const stackTrace = element.get("stackTrace")
  const isWarning = element.get("isWarning")
  const type: string = element.get("type")
  const message: string = element.get("message")
  const wrapperClasses = classNames("alert", "exception", "stException", {
    "alert-danger": !isWarning,
    "alert-warning": isWarning,
  })
  const messageIsMarkdown: boolean = element.get("messageIsMarkdown")
  return (
    <div className={wrapperClasses} style={{ width }}>
      <div className="message">
        <ExceptionMessage
          type={type}
          message={message}
          messageIsMarkdown={messageIsMarkdown}
        />
      </div>
      {stackTrace && stackTrace.size > 0 ? (
        <StackTrace stackTrace={stackTrace} />
      ) : null}
    </div>
  )
}
