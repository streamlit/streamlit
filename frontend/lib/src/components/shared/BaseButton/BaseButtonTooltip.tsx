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

import { ReactElement } from "react"

import Tooltip, { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import TooltipIcon from "~lib/components/shared/TooltipIcon/TooltipIcon"

import { StyledTooltipMobile, StyledTooltipNormal } from "./styled-components"

interface Props {
  children: ReactElement
  // TODO(lawilby): Probably remove this once width is implemented on Popover.
  containerWidth: boolean
  help?: string
  placement?: Placement
  /**
   * The full, plain-text label to reveal in a tooltip when the button's label
   * is truncated (`wrap=False`). Only used when `help` is not set, since `help`
   * takes precedence. Like `help`, this tooltip is desktop-only.
   */
  truncatedLabel?: string
}

export function BaseButtonTooltip({
  children,
  help,
  placement,
  containerWidth,
  truncatedLabel,
}: Props): ReactElement {
  if (help) {
    return (
      <>
        <StyledTooltipNormal>
          <TooltipIcon
            content={help}
            placement={placement || Placement.TOP}
            containerWidth={containerWidth}
          >
            {children}
          </TooltipIcon>
        </StyledTooltipNormal>
        <StyledTooltipMobile>{children}</StyledTooltipMobile>
      </>
    )
  }

  if (truncatedLabel) {
    // Reveal the full label on hover/focus (desktop only), mirroring how `help`
    // is disabled on touch via the normal/mobile split.
    return (
      <>
        <StyledTooltipNormal>
          <Tooltip
            content={truncatedLabel}
            placement={placement || Placement.TOP}
            containerWidth={containerWidth}
          >
            {children}
          </Tooltip>
        </StyledTooltipNormal>
        <StyledTooltipMobile>{children}</StyledTooltipMobile>
      </>
    )
  }

  return children
}
