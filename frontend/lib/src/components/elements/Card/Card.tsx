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

import {
  memo,
  type ReactElement,
  type ReactNode,
  useContext,
  useId,
  useMemo,
} from "react"

import type { Block as BlockProto } from "@streamlit/protobuf"
import { isNullOrEmptyString, notNullOrUndefined } from "@streamlit/utils"

import {
  FlexContext,
  FlexContextProvider,
} from "~lib/components/core/Layout/FlexContext"
import { Direction } from "~lib/components/core/Layout/utils"
import ThemeProvider from "~lib/components/core/ThemeProvider"
import { DynamicIcon } from "~lib/components/shared/Icon/DynamicIcon"
import StreamlitMarkdown from "~lib/components/shared/StreamlitMarkdown/StreamlitMarkdown"
import { Placement } from "~lib/components/shared/Tooltip/Tooltip"
import { WidgetLabelHelpIconInline } from "~lib/components/widgets/BaseWidget/WidgetLabelHelpIconInline"
import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { useLabelTitleTooltip } from "~lib/hooks/useLabelTitleTooltip"
import { computeDerivedColors } from "~lib/theme/getColors"
import type { EmotionTheme } from "~lib/theme/types"

import {
  StyledCard,
  StyledCardActions,
  StyledCardCaption,
  StyledCardHeader,
  StyledCardHelp,
  StyledCardIcon,
  StyledCardLabel,
  StyledCardLabelRow,
  StyledCardScrollBody,
  StyledCardTitleCluster,
} from "./styled-components"

export interface CardProps {
  element: BlockProto.Card
  /** Whether the card has an integer height, which scrolls only the body. */
  hasFixedHeight: boolean
  hasStretchHeight: boolean
  isStale: boolean
  /** Rendered `header_extras` slot, or null when it is empty. */
  headerExtras: ReactNode
  /** Rendered `actions` slot, or null when it is empty. */
  actions: ReactNode
  /** Rendered body, which holds the card's own content. */
  body: ReactNode
}

/**
 * Theme for the contents of a filled card.
 *
 * The card paints the secondary background of its immediate theme context.
 * Its children swap the background and secondary background, so elements that
 * normally sit on the background stay distinguishable on the card. A nested
 * filled card swaps again.
 */
function createCardBackgroundTheme(theme: EmotionTheme): EmotionTheme {
  const colors = {
    ...theme.colors,
    bgColor: theme.colors.secondaryBg,
    secondaryBg: theme.colors.bgColor,
  }
  return {
    ...theme,
    colors: { ...colors, ...computeDerivedColors(colors) },
  }
}

const Card = ({
  element,
  hasFixedHeight,
  hasStretchHeight,
  isStale,
  headerExtras,
  actions,
  body,
}: CardProps): ReactElement => {
  const { label, icon, caption, help, border, background } = element
  const theme = useEmotionTheme()
  const parentContext = useContext(FlexContext)
  const baseId = useId()
  const labelId = `${baseId}-label`
  const captionId = `${baseId}-caption`
  const hasCaption = !isNullOrEmptyString(caption)

  const { titleRef: labelRef, labelTextRef } = useLabelTitleTooltip(
    true,
    label
  )
  const { titleRef: captionRef, labelTextRef: captionTextRef } =
    useLabelTitleTooltip(hasCaption, caption)

  const contentTheme = useMemo(
    () => (background ? createCardBackgroundTheme(theme) : theme),
    [background, theme]
  )

  const bodyContent = (
    <FlexContextProvider
      direction={Direction.VERTICAL}
      hasFixedHeight={hasFixedHeight}
      hasStretchHeight={hasStretchHeight}
      parentContext={parentContext}
    >
      {body}
    </FlexContextProvider>
  )

  const headerContent = (
    <StyledCardHeader data-testid="stCardHeader">
      <FlexContextProvider
        direction={Direction.HORIZONTAL}
        parentContext={parentContext}
      >
        <StyledCardTitleCluster>
          <StyledCardLabelRow>
            {!isNullOrEmptyString(icon) && (
              <StyledCardIcon aria-hidden="true">
                <DynamicIcon iconValue={icon} size="xl" />
              </StyledCardIcon>
            )}
            <StyledCardLabel
              id={labelId}
              ref={labelRef}
              data-testid="stCardLabel"
            >
              <span ref={labelTextRef} style={{ display: "contents" }}>
                <StreamlitMarkdown
                  source={label}
                  allowHTML={false}
                  isLabel
                  inheritFont
                  inheritLineHeight
                  truncate
                />
              </span>
            </StyledCardLabel>
            {!isNullOrEmptyString(help) && (
              <StyledCardHelp>
                <WidgetLabelHelpIconInline
                  content={help}
                  label={label}
                  placement={Placement.TOP_RIGHT}
                />
              </StyledCardHelp>
            )}
          </StyledCardLabelRow>
          {headerExtras}
          {hasCaption && (
            <StyledCardCaption
              id={captionId}
              ref={captionRef}
              data-testid="stCardCaption"
            >
              <span ref={captionTextRef} style={{ display: "contents" }}>
                <StreamlitMarkdown
                  source={caption}
                  allowHTML={false}
                  isLabel
                  isCaption
                  inheritLineHeight
                />
              </span>
            </StyledCardCaption>
          )}
        </StyledCardTitleCluster>
        {notNullOrUndefined(actions) && (
          <StyledCardActions data-testid="stCardActions">
            {actions}
          </StyledCardActions>
        )}
      </FlexContextProvider>
    </StyledCardHeader>
  )

  return (
    <StyledCard
      role="group"
      aria-labelledby={labelId}
      aria-describedby={hasCaption ? captionId : undefined}
      className="stCard"
      data-testid="stCard"
      hasBorder={border}
      hasBackground={background}
      isStale={isStale}
    >
      <ThemeProvider theme={contentTheme}>
        {headerContent}
        {hasFixedHeight ? (
          <StyledCardScrollBody data-testid="stCardScrollBody">
            {bodyContent}
          </StyledCardScrollBody>
        ) : (
          bodyContent
        )}
      </ThemeProvider>
    </StyledCard>
  )
}

export default memo(Card)
