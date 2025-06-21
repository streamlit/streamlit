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

import React, { memo, useEffect, useRef } from "react"

import Clipboard from "clipboard"
import { Copy as CopyIcon } from "react-feather"

import { convertRemToPx } from "~lib/theme"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"

import { StyledCopyButton } from "./styled-components"

interface Props {
  text: string
}

const CopyButton: React.FC<Props> = ({ text }) => {
  const theme = useEmotionTheme()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const clipboardRef = useRef<Clipboard | null>(null)

  useEffect(() => {
    const node = buttonRef.current

    if (node !== null) {
      clipboardRef.current = new Clipboard(node, {
        // Set the container so that copying also works in dialogs.
        // Otherwise, the copy event is swallowed somehow.
        container: node.parentElement ?? undefined,
      })
    }

    return () => {
      if (clipboardRef.current !== null) {
        clipboardRef.current.destroy()
      }
    }
  }, [])

  return (
    <StyledCopyButton
      data-testid="stCodeCopyButton"
      title="Copy to clipboard"
      ref={buttonRef}
      data-clipboard-text={text}
      style={{
        top: 0,
        right: 0,
      }}
    >
      {/* Convert size to px because using rem works but logs a console error (at least on webkit) */}
      <CopyIcon size={convertRemToPx(theme.iconSizes.base)} />
    </StyledCopyButton>
  )
}

export default memo(CopyButton)
