import React, { ReactElement } from "react"
import AlertContainer, { Kind } from "src/components/shared/AlertContainer"
import StreamlitMarkdown from "src/components/shared/StreamlitMarkdown"
import { Exception as ExceptionProto } from "src/autogen/proto"
import {
  StyledMessageType,
  StyledStackTrace,
  StyledStackTraceRow,
  StyledStackTraceTitle,
  StyledExceptionContainer,
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
        <StyledExceptionContainer>
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
        </StyledExceptionContainer>
      </AlertContainer>
    </div>
  )
}
