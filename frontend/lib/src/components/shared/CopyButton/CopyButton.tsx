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

import { memo, useCallback } from "react"

import { Check as CheckIcon, Copy as CopyIcon } from "react-feather"

import { useCopyToClipboard } from "~lib/hooks/useCopyToClipboard"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { convertRemToPx } from "~lib/theme/utils"

import { StyledCopyButton } from "./styled-components"

interface CopyButtonProps {
  text: string
  iconSize?: string
  buttonSize?: string
  copyLabel?: string
  copiedLabel?: string
  className?: string
  "data-testid"?: string
  "aria-label"?: string
  title?: string
}

const CopyButton = ({
  text,
  iconSize,
  buttonSize,
  copyLabel,
  copiedLabel,
  className,
  "data-testid": dataTestId,
  "aria-label": ariaLabel,
  title,
}: CopyButtonProps): React.ReactElement => {
  const theme = useEmotionTheme()
  const { isCopied, copyToClipboard, label } = useCopyToClipboard()

  const handleCopy = useCallback(() => {
    copyToClipboard(text)
  }, [copyToClipboard, text])

  const resolvedIconSize = convertRemToPx(iconSize ?? theme.iconSizes.base)
  const resolvedButtonSize = buttonSize ?? theme.iconSizes.threeXL
  const resolvedLabel = isCopied
    ? (copiedLabel ?? label)
    : (copyLabel ?? label)

  return (
    <StyledCopyButton
      className={className}
      data-testid={dataTestId}
      title={title ?? resolvedLabel}
      aria-label={ariaLabel ?? resolvedLabel}
      data-copy-state={isCopied ? "copied" : "idle"}
      type="button"
      buttonSize={resolvedButtonSize}
      onClick={handleCopy}
    >
      {isCopied ? (
        <CheckIcon size={resolvedIconSize} />
      ) : (
        <CopyIcon size={resolvedIconSize} />
      )}
    </StyledCopyButton>
  )
}

export default memo(CopyButton)
