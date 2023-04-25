/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import React, { ReactElement } from "react"
import AlertContainer, { Kind } from "src/lib/components/shared/AlertContainer"
import StreamlitMarkdown from "src/lib/components/shared/StreamlitMarkdown"
import { Exception as ExceptionProto } from "src/lib/proto"
import {
  StyledMessageType,
  StyledStackTrace,
  StyledStackTraceRow,
  StyledStackTraceTitle,
} from "./styled-components"

export interface ExceptionElementProps {
  width: number
  element: ExceptionProto
}

interface ExceptionMessageProps {
  type: string
  message: string
  messageIsMarkdown: boolean
}

interface StackTraceProps {
  stackTrace: string[]
}

/**
 * Return true if the string is non-null and non-empty.
 */
function isNonEmptyString(value: string | null | undefined): boolean {
  return value != null && value !== ""
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
      <StyledMessageType>{type}</StyledMessageType>
      {isNonEmptyString(message) ? `: ${message}` : null}
    </>
  )
}

function StackTrace({ stackTrace }: StackTraceProps): ReactElement {
  // Build the stack trace display, if we got a stack trace.
  return (
    <>
      <StyledStackTraceTitle>Traceback:</StyledStackTraceTitle>
      <StyledStackTrace>
        <code>
          {stackTrace.map((row: string, index: number) => (
            <StyledStackTraceRow key={index}>{row}</StyledStackTraceRow>
          ))}
        </code>
      </StyledStackTrace>
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
  return (
    <div className="stException">
      <AlertContainer
        kind={element.isWarning ? Kind.WARNING : Kind.ERROR}
        width={width}
      >
        <div className="message">
          <ExceptionMessage
            type={element.type}
            message={element.message}
            messageIsMarkdown={element.messageIsMarkdown}
          />
        </div>
        {element.stackTrace && element.stackTrace.length > 0 ? (
          <StackTrace stackTrace={element.stackTrace} />
        ) : null}
      </AlertContainer>
    </div>
  )
}
