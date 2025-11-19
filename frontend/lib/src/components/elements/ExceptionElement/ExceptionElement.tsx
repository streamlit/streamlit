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

import React, { memo, ReactElement, useCallback } from "react"

import { getLogger } from "loglevel"

import { Exception as ExceptionProto } from "@streamlit/protobuf"
import { isLocalhost } from "@streamlit/utils"

import { StyledCode } from "~lib/components/elements/CodeBlock/styled-components"
import AlertContainer, { Kind } from "~lib/components/shared/AlertContainer"
import { StyledStackTrace } from "~lib/components/shared/ErrorElement/styled-components"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown"
import { useCopyToClipboard } from "~lib/hooks/useCopyToClipboard"
import { notNullOrUndefined } from "~lib/util/utils"

import {
  StyledExceptionCopyButton,
  StyledExceptionLinks,
  StyledExceptionMessage,
  StyledExceptionWrapper,
  StyledMessageType,
  StyledStackTraceContent,
  StyledStackTraceRow,
  StyledStackTraceTitle,
} from "./styled-components"

export const LOG = getLogger("ExceptionElement")

export interface ExceptionElementProps {
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
  return notNullOrUndefined(value) && value !== ""
}

function ExceptionMessage({
  type,
  message,
  messageIsMarkdown,
}: Readonly<ExceptionMessageProps>): ReactElement {
  // Build the message display.
  // On the backend, we use the StreamlitException type for errors that
  // originate from inside Streamlit. These errors have Markdown-formatted
  // messages, and so we wrap those messages inside our Markdown renderer.

  if (messageIsMarkdown) {
    let markdown = message ?? ""
    if (type.length !== 0) {
      markdown = `**${type}**: ${markdown}`
    }
    return <StreamlitMarkdown source={markdown} allowHTML={false} />
  }
  return (
    <>
      <StyledMessageType>{type}</StyledMessageType>
      {type.length !== 0 && ": "}
      {isNonEmptyString(message) ? message : null}
    </>
  )
}

function StackTrace({ stackTrace }: Readonly<StackTraceProps>): ReactElement {
  // Build the stack trace display, if we got a stack trace.
  return (
    <div>
      <StyledStackTraceTitle>Traceback:</StyledStackTraceTitle>
      <StyledStackTrace>
        <StyledStackTraceContent>
          <StyledCode wrapLines={false}>
            {stackTrace.map((row: string, index: number) => (
              <StyledStackTraceRow
                // TODO: Update to match React best practices
                // eslint-disable-next-line @eslint-react/no-array-index-key
                key={index}
                data-testid="stExceptionTraceRow"
              >
                {row}
              </StyledStackTraceRow>
            ))}
          </StyledCode>
        </StyledStackTraceContent>
      </StyledStackTrace>
    </div>
  )
}

/**
 * Functional element representing formatted text.
 */
function ExceptionElement({
  element,
}: Readonly<ExceptionElementProps>): ReactElement {
  const formattedExceptionShort = `${element.type}: ${element.message}`
  const formattedExceptionFull = `${formattedExceptionShort}\n\n${element.stackTrace?.join(
    "\n"
  )}`

  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    formattedExceptionShort
  )}`
  const chatGptUrl = `https://chatgpt.com/?q=${encodeURIComponent(
    formattedExceptionFull
  )}`

  const { copyToClipboard } = useCopyToClipboard()

  const handleCopy = useCallback(() => {
    copyToClipboard(formattedExceptionFull)
  }, [copyToClipboard, formattedExceptionFull])

  return (
    <div className="stException" data-testid="stException">
      <AlertContainer kind={element.isWarning ? Kind.WARNING : Kind.ERROR}>
        <StyledExceptionWrapper>
          <StyledExceptionMessage data-testid="stExceptionMessage">
            <ExceptionMessage
              type={element.type}
              message={element.message}
              messageIsMarkdown={element.messageIsMarkdown}
            />
          </StyledExceptionMessage>
          {element.stackTrace && element.stackTrace.length > 0 ? (
            <StackTrace stackTrace={element.stackTrace} />
          ) : null}
          {isLocalhost() && (
            <StyledExceptionLinks>
              <StyledExceptionCopyButton onClick={handleCopy}>
                Copy
              </StyledExceptionCopyButton>
              <a href={searchUrl} target="_blank" rel="noopener noreferrer">
                Ask Google
              </a>
              <a href={chatGptUrl} target="_blank" rel="noopener noreferrer">
                Ask ChatGPT
              </a>
            </StyledExceptionLinks>
          )}
        </StyledExceptionWrapper>
      </AlertContainer>
    </div>
  )
}

export default memo(ExceptionElement)
