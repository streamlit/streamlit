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

import { memo, ReactElement, useCallback } from "react"

import { Check, ContentCopy } from "@emotion-icons/material-outlined"

import { ToolbarAction } from "~lib/components/shared/Toolbar"
import { useCopyToClipboard } from "~lib/hooks/useCopyToClipboard"

import {
  StyledCodeToolbar,
  StyledCodeToolbarWrapper,
} from "./styled-components"

export interface CodeBlockCopyToolbarProps {
  text: string
}

function CodeBlockCopyToolbar({
  text,
}: Readonly<CodeBlockCopyToolbarProps>): ReactElement {
  const { isCopied, copyToClipboard, label } = useCopyToClipboard()

  const handleCopy = useCallback(() => {
    copyToClipboard(text)
  }, [copyToClipboard, text])

  return (
    <StyledCodeToolbarWrapper>
      <StyledCodeToolbar>
        <ToolbarAction
          label={label}
          icon={isCopied ? Check : ContentCopy}
          onClick={handleCopy}
        />
      </StyledCodeToolbar>
    </StyledCodeToolbarWrapper>
  )
}

export default memo(CodeBlockCopyToolbar)
