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

import styled from "@emotion/styled"

import { MARKDOWN_ELLIPSIS_CLASS } from "~lib/hooks/useLabelTitleTooltip"
import { STALE_TRANSITION_PARAMS } from "~lib/theme/consts"

const ELLIPSIS_SELECTOR = `.${MARKDOWN_ELLIPSIS_CLASS}`

interface StyledCardProps {
  hasBorder: boolean
  hasBackground: boolean
  isStale: boolean
}

/**
 * The card surface. It deliberately sets no `transform`, `filter`, `contain`,
 * or `z-index`: a stacking context here would trap the fixed-position
 * fullscreen view of the elements inside the card.
 */
export const StyledCard = styled.div<StyledCardProps>(
  ({ theme, hasBorder, hasBackground, isStale }) => {
    const hasSurface = hasBorder || hasBackground
    return {
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing.md,
      // Fills the layout wrapper, which owns the card's width and height.
      flex: "1 1 auto",
      width: "100%",
      minWidth: 0,
      minHeight: 0,
      ...(hasSurface && {
        borderRadius: theme.radii.default,
        // Matches the padding of st.container(border=True).
        padding: `calc(${theme.spacing.lg} - ${theme.sizes.borderWidth})`,
        border: `${theme.sizes.borderWidth} solid ${
          hasBorder ? theme.colors.borderColor : "transparent"
        }`,
      }),
      ...(hasBackground && { backgroundColor: theme.colors.secondaryBg }),
      ...(isStale && {
        ...(hasBorder && { borderColor: theme.colors.borderColorLight }),
        transition: `border ${STALE_TRANSITION_PARAMS}`,
      }),
      // Print often gives the card less width than on screen, so the label and
      // caption wrap instead of ending in an ellipsis.
      "@media print": {
        [`& ${ELLIPSIS_SELECTOR}, & ${ELLIPSIS_SELECTOR} p`]: {
          overflow: "visible",
          textOverflow: "clip",
          whiteSpace: "normal",
          overflowWrap: "anywhere",
        },
        [`& [data-testid="stCardCaption"]`]: {
          display: "block",
          overflow: "visible",
        },
      },
    }
  }
)

/**
 * Title cluster on the left, `actions` on the right. The header is at least a
 * standard widget height, so adding a control doesn't make it taller.
 */
export const StyledCardHeader = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: theme.spacing.sm,
  minHeight: theme.sizes.minElementHeight,
  // The header keeps its height when the card has a fixed height.
  flexShrink: 0,
  minWidth: 0,
}))

/**
 * Icon, label, help icon, `header_extras`, and caption. The label row keeps a
 * minimum width, and the extras wrap below it when the card is narrow. Rows
 * pack at the top so the label sits at the same place with or without a
 * caption.
 */
export const StyledCardTitleCluster = styled.div(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  alignContent: "flex-start",
  columnGap: theme.spacing.sm,
  rowGap: theme.spacing.twoXS,
  flex: "1 1 0",
  minWidth: 0,
}))

export const StyledCardLabelRow = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.sm,
  // A standard widget height, so the label centers on a control in `actions`
  // and the header is never shorter than one.
  minHeight: theme.sizes.minElementHeight,
  // Shrinks with the card down to a minimum width, then the extras wrap.
  flex: "0 1 auto",
  minWidth: "min(8rem, 100%)",
  maxWidth: "100%",
}))

export const StyledCardIcon = styled.span({
  display: "inline-flex",
  alignItems: "center",
  flexShrink: 0,
})

export const StyledCardLabel = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.xl,
  fontWeight: theme.fontWeights.semiBold,
  lineHeight: theme.lineHeights.headings,
  color: theme.colors.bodyText,
  minWidth: 0,
  flex: "0 1 auto",
}))

export const StyledCardHelp = styled.span({
  display: "inline-flex",
  alignItems: "center",
  flexShrink: 0,
})

/**
 * Caption of up to two lines. The caption sits on its own row of the title
 * cluster, below the label and any wrapped extras.
 */
export const StyledCardCaption = styled.div(({ theme }) => ({
  flexBasis: "100%",
  lineHeight: theme.lineHeights.headings,
  minWidth: 0,
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
}))

/** Right column that holds `actions`. It scrolls instead of widening the page. */
export const StyledCardActions = styled.div({
  display: "flex",
  flex: "0 1 auto",
  minWidth: 0,
  maxWidth: "100%",
  overflowX: "auto",
  "@media print": {
    overflowX: "visible",
  },
})

/**
 * Body of a card with an integer height. The header stays pinned while this
 * wrapper scrolls the body.
 */
export const StyledCardScrollBody = styled.div({
  display: "flex",
  flexDirection: "column",
  flex: "1 1 0",
  minHeight: 0,
  overflowY: "auto",
})
