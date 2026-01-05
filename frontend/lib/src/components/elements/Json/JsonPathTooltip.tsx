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

import { memo, ReactElement, useCallback, useState } from "react"

import { ACCESSIBILITY_TYPE, PLACEMENT, Popover } from "baseui/popover"

import { DynamicIcon } from "~lib/components/shared/Icon"
import { useCopyToClipboard } from "~lib/hooks/useCopyToClipboard"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { hasLightBackgroundColor } from "~lib/theme"

import {
  StyledCopyButton,
  StyledPathTooltip,
  StyledTooltipTarget,
} from "./styled-components"

export interface JsonPathTooltipProps {
  top: number
  left: number
  path: string
  clearTooltip: () => void
}

/**
 * A tooltip that displays a JSON path and allows copying it to clipboard.
 *
 * Uses BaseWeb's Popover for consistent positioning and behavior.
 * Since Popover doesn't support positioning to a virtual position,
 * we use an invisible div as the anchor element.
 */
function JsonPathTooltip({
  top,
  left,
  path,
  clearTooltip,
}: JsonPathTooltipProps): ReactElement {
  const [isOpen, setIsOpen] = useState(true)
  const theme = useEmotionTheme()
  const { colors, radii } = theme

  const { isCopied, copyToClipboard, label } = useCopyToClipboard()

  const closeTooltip = useCallback((): void => {
    setIsOpen(false)
    clearTooltip()
  }, [clearTooltip])

  const handleCopyPath = useCallback((): void => {
    copyToClipboard(path)
  }, [copyToClipboard, path])

  return (
    <Popover
      content={
        <StyledPathTooltip data-testid="stJsonPathTooltip">
          <code>{path}</code>
          <StyledCopyButton
            onClick={handleCopyPath}
            title={label}
            aria-label={label}
            autoFocus
          >
            <DynamicIcon
              size="sm"
              iconValue={
                isCopied ? ":material/check:" : ":material/content_copy:"
              }
            />
          </StyledCopyButton>
        </StyledPathTooltip>
      }
      placement={PLACEMENT.top}
      accessibilityType={ACCESSIBILITY_TYPE.tooltip}
      showArrow={false}
      popoverMargin={15}
      onClickOutside={closeTooltip}
      onEsc={closeTooltip}
      overrides={{
        Body: {
          style: {
            borderTopLeftRadius: radii.default,
            borderTopRightRadius: radii.default,
            borderBottomLeftRadius: radii.default,
            borderBottomRightRadius: radii.default,
            paddingTop: "0 !important",
            paddingBottom: "0 !important",
            paddingLeft: "0 !important",
            paddingRight: "0 !important",
            backgroundColor: "transparent",
          },
        },
        Inner: {
          style: {
            backgroundColor: hasLightBackgroundColor(theme)
              ? colors.bgColor
              : colors.secondaryBg,
            color: colors.bodyText,
            borderTopLeftRadius: radii.default,
            borderTopRightRadius: radii.default,
            borderBottomLeftRadius: radii.default,
            borderBottomRightRadius: radii.default,
            paddingTop: "0 !important",
            paddingBottom: "0 !important",
            paddingLeft: "0 !important",
            paddingRight: "0 !important",
          },
        },
      }}
      isOpen={isOpen}
    >
      <StyledTooltipTarget
        data-testid="stJsonPathTooltipTarget"
        top={top}
        left={left}
      />
    </Popover>
  )
}

export default memo(JsonPathTooltip)
