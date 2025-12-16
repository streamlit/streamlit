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

import { isValidElement, ReactElement } from "react"

import { HelpCircle as HelpCircleIcon } from "react-feather"

import StreamlitMarkdown, {
  StreamlitMarkdownProps,
} from "~lib/components/shared/StreamlitMarkdown"
import Tooltip, { Placement } from "~lib/components/shared/Tooltip"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { convertRemToPx } from "~lib/theme"

import {
  StyledLabelHelpInline,
  StyledTooltipIconWrapper,
  StyledTooltipTriggerButton,
} from "./styled-components"

interface TooltipIconCommonProps {
  placement?: Placement
  isLatex?: boolean
  content: string
  markdownProps?: Partial<StreamlitMarkdownProps>
  onMouseEnterDelay?: number
  containerWidth?: boolean
}

/**
 * TooltipIconProps is intentionally a union to prevent unlabeled, focusable
 * tooltip triggers from being introduced.
 *
 * - If you pass `children`, `TooltipIcon` will *not* render its own button. In
 *   that case the child should already be an interactive element with its own
 *   accessible name, so requiring `ariaLabel` would be redundant/noisy.
 * - If you do *not* pass `children`, `TooltipIcon` renders a `<button>`
 *   trigger. That trigger must have an accessible name, so `ariaLabel` is
 *   required.
 *
 * Usage examples:
 *
 * ```tsx
 * // With children: children must already be interactive and labeled.
 * <TooltipIcon content="More info">
 *   <button aria-label="Show details">i</button>
 * </TooltipIcon>
 *
 * // Without children: TooltipIcon renders its own button, so ariaLabel is required.
 * <TooltipIcon content="More info" ariaLabel="Show help" />
 * ```
 */
export type TooltipIconProps =
  | (TooltipIconCommonProps & {
      children: ReactElement
      ariaLabel?: never
    })
  | (TooltipIconCommonProps & {
      ariaLabel: string
      children?: never
    })

function TooltipIcon(props: TooltipIconProps): ReactElement {
  const {
    placement = Placement.AUTO,
    isLatex = false,
    content,
    markdownProps,
    onMouseEnterDelay,
    containerWidth = false,
  } = props
  const theme = useEmotionTheme()

  const renderDefaultTriggerButton = (ariaLabel: string): ReactElement => {
    return (
      <StyledTooltipTriggerButton type="button" aria-label={ariaLabel}>
        <HelpCircleIcon
          className="icon"
          aria-hidden="true"
          focusable="false"
          /* Convert size to px because using rem works but logs a console error (at least on webkit) */
          size={convertRemToPx(theme.iconSizes.base)}
        />
      </StyledTooltipTriggerButton>
    )
  }

  /**
   * Render a tooltip trigger.
   *
   * - If `children` are provided, we assume the child is already interactive and
   *   properly labeled.
   * - Otherwise we render a default button trigger that requires an accessible name.
   */
  const renderTrigger = (): ReactElement => {
    if ("children" in props) {
      if (isValidElement(props.children)) {
        return props.children
      }

      return renderDefaultTriggerButton("Help")
    }

    const ariaLabel = props.ariaLabel.trim()

    if (!ariaLabel.length) {
      // `ariaLabel` is required by the type when no children are provided, but
      // we still guard at runtime because: it may be derived from dynamic data
      // (e.g. widget labels) and end up empty.
      return renderDefaultTriggerButton("Help")
    }

    return renderDefaultTriggerButton(ariaLabel)
  }

  return (
    <StyledTooltipIconWrapper
      className="stTooltipIcon"
      data-testid="stTooltipIcon"
      isLatex={isLatex}
    >
      <Tooltip
        content={
          <StreamlitMarkdown
            style={{ fontSize: theme.fontSizes.sm }}
            source={content}
            allowHTML={false}
            {...(markdownProps || {})}
          />
        }
        placement={placement}
        onMouseEnterDelay={onMouseEnterDelay}
        inline
        containerWidth={containerWidth}
      >
        {renderTrigger()}
      </Tooltip>
    </StyledTooltipIconWrapper>
  )
}

export function getHelpTooltipAriaLabel(label?: string | null): string {
  // We try to generate a widget-specific accessible name when possible. In some
  // cases `label` can be missing/empty (e.g. widgets created without a visible
  // label), so we fall back to a generic "Help" label rather than returning an
  // empty accessible name.
  const trimmed = label?.trim()
  const normalized = trimmed ? trimmed.replace(/\s+/g, " ") : null
  return normalized ? `Help for ${normalized}` : "Help"
}

/**
 * InlineTooltipIcon is a convenience wrapper used in places like markdown and
 * headings, where we always want a standard "help" icon next to text.
 *
 * Unlike `TooltipIcon`, it always provides an accessible name by default to
 * keep call sites terse while still meeting accessibility requirements.
 */
export interface InlineTooltipIconProps extends TooltipIconCommonProps {
  ariaLabel?: string
}

export const InlineTooltipIcon = ({
  placement = Placement.TOP_RIGHT,
  isLatex = false,
  content,
  markdownProps,
  onMouseEnterDelay,
  containerWidth,
  ariaLabel = "Help",
}: InlineTooltipIconProps): ReactElement => {
  return (
    <StyledLabelHelpInline>
      <TooltipIcon
        placement={placement}
        isLatex={isLatex}
        content={content}
        markdownProps={markdownProps}
        onMouseEnterDelay={onMouseEnterDelay}
        containerWidth={containerWidth}
        ariaLabel={ariaLabel}
      />
    </StyledLabelHelpInline>
  )
}

export default TooltipIcon
