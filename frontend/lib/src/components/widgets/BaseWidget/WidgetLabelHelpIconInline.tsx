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

import type { Props as StreamlitMarkdownProps } from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import TooltipIcon, {
  getHelpTooltipAriaLabel,
} from "~lib/components/shared/TooltipIcon/TooltipIcon"

import { StyledWidgetLabelHelpInline } from "./styled-components"

type WidgetLabelHelpIconInlineProps = {
  /** Tooltip contents (markdown). */
  content: string
  /**
   * Widget label used to generate an accessible name (e.g. "Help for My
   * widget"). If omitted/empty, the accessible name falls back to a generic
   * "Help".
   */
  label?: string | null
  /** Override accessible name. If omitted, it is derived from `label`. */
  ariaLabel?: string
  placement?: Placement
  isLatex?: boolean
  markdownProps?: Partial<StreamlitMarkdownProps>
  onMouseEnterDelay?: number
  containerWidth?: boolean
}

export function WidgetLabelHelpIconInline({
  content,
  label,
  ariaLabel,
  placement = Placement.TOP_RIGHT,
  isLatex,
  markdownProps,
  onMouseEnterDelay,
  containerWidth,
}: WidgetLabelHelpIconInlineProps): ReactElement {
  return (
    <StyledWidgetLabelHelpInline>
      <TooltipIcon
        content={content}
        placement={placement}
        isLatex={isLatex}
        markdownProps={markdownProps}
        onMouseEnterDelay={onMouseEnterDelay}
        containerWidth={containerWidth}
        ariaLabel={ariaLabel ?? getHelpTooltipAriaLabel(label)}
      />
    </StyledWidgetLabelHelpInline>
  )
}
