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

import React, { Fragment, memo, ReactElement, ReactNode } from "react"

import { StreamlitErrorCodeBlock } from "@streamlit/lib"

import { StyledErrorText } from "./styled-components"

export interface DialogErrorMessageProps {
  message: string
  codeBlock?: string
}

/**
 * Parse message text and convert markdown links [text](url) into clickable anchor tags.
 */
function parseLinks(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  let currentIndex = 0
  let key = 0

  // Match markdown links: [text](url)
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g
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

    // Add markdown link: [text](url)
    parts.push(
      <a key={key++} href={match[2]} target="_blank" rel="noopener noreferrer">
        {match[1]}
      </a>
    )

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
 * Supports markdown-style links [text](url).
 */
function DialogErrorMessage({
  message,
  codeBlock,
}: Readonly<DialogErrorMessageProps>): ReactElement {
  return (
    <>
      <StyledErrorText hasCodeBelow={!!codeBlock}>
        {parseLinks(message)}
      </StyledErrorText>
      {codeBlock && (
        <StreamlitErrorCodeBlock>{codeBlock}</StreamlitErrorCodeBlock>
      )}
    </>
  )
}

export default memo(DialogErrorMessage)
