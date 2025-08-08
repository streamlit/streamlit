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

import React, { memo, useCallback, useRef } from "react"

import { Check as CheckIcon, Copy as CopyIcon } from "react-feather"

import { useCopyToClipboard } from "~lib/hooks/useCopyToClipboard"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { convertRemToPx } from "~lib/theme"

import { StyledCopyButton } from "./styled-components"

interface Props {
  text: string
}

const CopyButton: React.FC<Props> = ({ text }) => {
  const theme = useEmotionTheme()
  const buttonRef = useRef<HTMLButtonElement>(null)

  const { isCopied, copyToClipboard } = useCopyToClipboard()

  const handleCopy = useCallback(() => {
    copyToClipboard(text)
  }, [copyToClipboard, text])

  return (
    <StyledCopyButton
      data-testid="stCodeCopyButton"
      title="Copy to clipboard"
      ref={buttonRef}
      onClick={handleCopy}
    >
      {/* Convert size to px because using rem works but logs a console error (at least on webkit) */}
      {isCopied ? (
        <CheckIcon size={convertRemToPx(theme.iconSizes.base)} />
      ) : (
        <CopyIcon size={convertRemToPx(theme.iconSizes.base)} />
      )}
    </StyledCopyButton>
  )
}

export default memo(CopyButton)
