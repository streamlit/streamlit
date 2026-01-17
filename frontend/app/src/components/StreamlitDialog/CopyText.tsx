/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import React, { memo, useCallback } from "react"

import {
  DynamicIcon,
  StreamlitMarkdown,
  useCopyToClipboard,
} from "@streamlit/lib"

import {
  StyledCopyTextButton,
  StyledCopyTextContainer,
} from "./styled-components"

interface Props {
  /** The text to display and copy */
  text: string
  /** The text to copy to clipboard (if different from display text) */
  copyText?: string
  /** Whether to style the text as a caption */
  isCaption?: boolean
  /** Additional test id */
  "data-testid"?: string
}

const CopyText: React.FC<Props> = ({
  text,
  copyText,
  isCaption = false,
  "data-testid": testId,
}) => {
  const { isCopied, copyToClipboard } = useCopyToClipboard()

  const handleCopy = useCallback(() => {
    copyToClipboard(copyText || text)
  }, [copyToClipboard, copyText, text])

  return (
    <StyledCopyTextContainer data-testid={testId} onClick={handleCopy}>
      <StreamlitMarkdown
        source={text}
        allowHTML={false}
        isCaption={isCaption}
      />
      <StyledCopyTextButton
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation() // Prevent double triggering
          handleCopy()
        }}
        title="Copy text"
        data-testid={testId ? `${testId}CopyButton` : "stCopyTextButton"}
      >
        <DynamicIcon
          iconValue={isCopied ? ":material/check:" : ":material/content_copy:"}
          size="sm"
          color="inherit"
        />
      </StyledCopyTextButton>
    </StyledCopyTextContainer>
  )
}

export default memo(CopyText)
