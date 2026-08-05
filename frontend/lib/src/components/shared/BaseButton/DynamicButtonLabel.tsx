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

import { useEffect, useMemo, useRef } from "react"

import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { formatShortcutForDisplay } from "~lib/hooks/useRegisterShortcut"
import type { IconSize } from "~lib/theme/types"
import { isFromMac } from "~lib/util/utils"

import {
  StyledButtonLabel,
  StyledButtonMainLabel,
  StyledButtonShortcut,
} from "./styled-components"

export interface DynamicButtonLabelProps {
  icon?: string
  label?: string
  iconSize?: IconSize
  iconPosition?: "left" | "right"
  shortcut?: string | null
  /**
   * When false, the label stays on one line and truncates with an ellipsis
   * instead of wrapping. Icons and shortcuts keep their intrinsic size.
   */
  wrap?: boolean
  /**
   * When true, add a native browser tooltip (`title`) exposing the full label so
   * a label truncated with an ellipsis (`wrap=false`) can still be read on hover.
   * The tooltip uses the rendered plain text (the button's accessible name), so
   * a Markdown label is shown without its raw syntax. Because it is a native
   * `title`, the browser shows it on hover whenever it is set, regardless of
   * whether the label is actually clipped.
   */
  addTitleTooltip?: boolean
}

export const DynamicButtonLabel = ({
  icon,
  label,
  iconSize,
  iconPosition = "left",
  shortcut,
  wrap = true,
  addTitleTooltip = false,
}: DynamicButtonLabelProps): React.ReactElement | null => {
  const displayShortcut = useMemo(() => {
    return formatShortcutForDisplay(shortcut, { isMac: isFromMac() })
  }, [shortcut])

  const truncate = !wrap

  const labelRef = useRef<HTMLDivElement>(null)

  // Set the native tooltip to the rendered plain-text label (the accessible
  // name) rather than the raw Markdown source. This reads from the DOM because
  // Markdown can only be converted to plain text after it is rendered.
  useEffect(() => {
    const node = labelRef.current
    if (!node) {
      return
    }
    const labelText =
      node.querySelector('[data-testid="stMarkdownContainer"]')?.textContent ??
      ""
    if (addTitleTooltip && labelText) {
      node.title = labelText
    } else {
      node.removeAttribute("title")
    }
  }, [addTitleTooltip, label])

  return (
    <StyledButtonLabel ref={labelRef} $truncate={truncate}>
      <StyledButtonMainLabel
        data-has-shortcut={Boolean(displayShortcut)}
        $truncate={truncate}
      >
        {icon && iconPosition === "left" && (
          <DynamicIcon size={iconSize ?? "base"} iconValue={icon} />
        )}
        {label && (
          <StreamlitMarkdown
            source={label}
            allowHTML={false}
            isLabel
            disableLinks
            truncate={truncate}
          />
        )}
        {icon && iconPosition === "right" && (
          <DynamicIcon size={iconSize ?? "base"} iconValue={icon} />
        )}
        {displayShortcut && (
          <StyledButtonShortcut aria-label={`Shortcut ${displayShortcut}`}>
            {displayShortcut}
          </StyledButtonShortcut>
        )}
      </StyledButtonMainLabel>
    </StyledButtonLabel>
  )
}
