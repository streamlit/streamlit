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

import React, {
  memo,
  ReactElement,
  ReactNode,
  useCallback,
  useState,
} from "react"

import {
  ACCESSIBILITY_TYPE,
  PLACEMENT,
  type PopoverOverrides,
  StatefulTooltip,
} from "baseui/tooltip"

import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { EmotionTheme, hasLightBackgroundColor } from "~lib/theme"

import { StyledTooltipContentWrapper } from "./styled-components"
import { useTooltipMeasurementSideEffect } from "./useTooltipMeasurementSideEffect"

export enum Placement {
  AUTO = "auto",
  TOP_LEFT = "topLeft",
  TOP = "top",
  TOP_RIGHT = "topRight",
  RIGHT_TOP = "rightTop",
  RIGHT = "right",
  RIGHT_BOTTOM = "rightBottom",
  BOTTOM_RIGHT = "bottomRight",
  BOTTOM = "bottom",
  BOTTOM_LEFT = "bottomLeft",
  LEFT_BOTTOM = "leftBottom",
  LEFT = "left",
  LEFT_TOP = "leftTop",
}

export interface TooltipProps {
  content: ReactNode
  placement: Placement
  children: ReactNode
  inline?: boolean
  style?: React.CSSProperties
  onMouseEnterDelay?: number
  overrides?: PopoverOverrides
  containerWidth?: boolean
  error?: boolean
}

// Allows re-use/customization of default tooltip overrides
const generateDefaultTooltipOverrides = (
  theme: EmotionTheme,
  overrides?: PopoverOverrides
): PopoverOverrides => {
  const { colors, fontSizes, radii, fontWeights } = theme

  return {
    Body: {
      style: {
        // This is annoying, but a bunch of warnings get logged when the
        // shorthand version `borderRadius` is used here since the long
        // names are used by BaseWeb and mixing the two is apparently
        // bad :(
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
        fontSize: fontSizes.sm,
        fontWeight: fontWeights.normal,

        // See the long comment about `borderRadius`. The same applies here
        // to `padding`.
        paddingTop: "0 !important",
        paddingBottom: "0 !important",
        paddingLeft: "0 !important",
        paddingRight: "0 !important",
      },
      // overrides prop replaces tooltip subcomponent overrides
      ...overrides,
    },
  }
}

function Tooltip({
  content,
  placement,
  children,
  inline,
  style,
  onMouseEnterDelay,
  overrides,
  containerWidth,
  error,
}: TooltipProps): ReactElement {
  const theme = useEmotionTheme()

  // This section of code is to work around a timing issue with BaseWeb's Tooltip component
  const [tooltipElement, setTooltipElement] = useState<HTMLDivElement | null>(
    null
  )
  const [isOpen, setIsOpen] = useState(false)

  const handleOpen = useCallback(() => {
    setIsOpen(true)
  }, [])
  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  useTooltipMeasurementSideEffect(tooltipElement, isOpen)

  const tooltipOverrides = generateDefaultTooltipOverrides(theme, overrides)

  return (
    <StatefulTooltip
      onOpen={handleOpen}
      onClose={handleClose}
      content={
        content ? (
          <StyledTooltipContentWrapper
            className={error ? "stTooltipErrorContent" : "stTooltipContent"}
            data-testid={error ? "stTooltipErrorContent" : "stTooltipContent"}
            ref={setTooltipElement}
          >
            {content}
          </StyledTooltipContentWrapper>
        ) : null
      }
      placement={PLACEMENT[placement]}
      accessibilityType={ACCESSIBILITY_TYPE.tooltip}
      showArrow={false}
      popoverMargin={10}
      onMouseEnterDelay={onMouseEnterDelay}
      overrides={tooltipOverrides}
    >
      {/* BaseWeb manipulates its child, so we create a wrapper div for protection */}
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: inline ? "flex-end" : "",
          width: containerWidth ? "100%" : "auto",
          ...style,
        }}
        data-testid={
          error ? "stTooltipErrorHoverTarget" : "stTooltipHoverTarget"
        }
        className={
          error ? "stTooltipErrorHoverTarget" : "stTooltipHoverTarget"
        }
      >
        {children}
      </div>
    </StatefulTooltip>
  )
}

export default memo(Tooltip)
