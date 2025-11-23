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

import React, { Fragment, ReactElement, ReactNode } from "react"

import { StreamlitErrorCodeBlock } from "@streamlit/lib"

export interface DialogErrorMessageProps {
  message: string
  codeBlock?: string
}

/**
 * Parse message text and convert markdown links [text](url) and plain URLs
 * into clickable anchor tags.
 */
function parseLinks(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  let currentIndex = 0
  let key = 0

  // Match: 1) Markdown links [text](url)  2) Plain URLs http(s)://...
  const pattern = /(\[([^\]]+)\]\(([^)]+)\))|(https?:\/\/[^\s]+)/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    // Add text before the match
    if (match.index > currentIndex) {
      parts.push(
        <Fragment key={key++}>
          {text.substring(currentIndex, match.index)}
        </Fragment>
      )
    }

    if (match[1]) {
      // Markdown link: [text](url)
      parts.push(
        <a
          key={key++}
          href={match[3]}
          target="_blank"
          rel="noopener noreferrer"
        >
          {match[2]}
        </a>
      )
    } else if (match[4]) {
      // Plain URL
      parts.push(
        <a
          key={key++}
          href={match[4]}
          target="_blank"
          rel="noopener noreferrer"
        >
          {match[4]}
        </a>
      )
    }

    currentIndex = match.index + match[0].length
  }

  // Add remaining text
  if (currentIndex < text.length) {
    parts.push(<Fragment key={key++}>{text.substring(currentIndex)}</Fragment>)
  }

  return parts
}

/**
 * Component for displaying error messages with optional code blocks.
 * Used in error dialogs to display text messages with links and formatted code.
 * Supports markdown-style links [text](url) and plain URLs.
 */
function DialogErrorMessage({
  message,
  codeBlock,
}: Readonly<DialogErrorMessageProps>): ReactElement {
  return (
    <>
      <div>{parseLinks(message)}</div>
      {codeBlock && (
        <StreamlitErrorCodeBlock>{codeBlock}</StreamlitErrorCodeBlock>
      )}
    </>
  )
}

export default DialogErrorMessage
