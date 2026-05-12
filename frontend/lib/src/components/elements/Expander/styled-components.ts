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

import { STALE_STYLES, STALE_TRANSITION_PARAMS } from "~lib/theme/consts"

export const StyledExpandableContainer = styled.div({
  width: "100%",
})
interface StyledDetailsProps {
  isStale: boolean
  isCompact: boolean
}

export const BORDER_SIZE = 1 // px
export const StyledDetails = styled.details<StyledDetailsProps>(
  ({ isStale, isCompact, theme }) => ({
    marginBottom: 0,
    marginTop: 0,
    width: "100%",
    ...(!isCompact
      ? {
          borderStyle: "solid",
          borderWidth: theme.sizes.borderWidth,
          borderColor: theme.colors.borderColor,
          borderRadius: theme.radii.default,
          ...(isStale
            ? {
                borderColor: theme.colors.borderColorLight,
                transition: `border ${STALE_TRANSITION_PARAMS}`,
              }
            : {}),
        }
      : {
          // Compact style: no border
          border: "none",
          borderRadius: 0,
        }),
  })
)

export const StyledSummaryHeading = styled.span(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexGrow: 1,
  minWidth: 0,
  width: "100%",
  maxWidth: "100%",
  overflow: "hidden",
  gap: theme.spacing.sm,
}))

export const StyledSummaryLabelWrapper = styled.div<{ isCompact: boolean }>(
  ({ isCompact }) => ({
    display: "flex",
    overflow: "hidden",
    // In compact mode, don't grow so chevron stays directly after label
    ...(!isCompact && {
      width: "100%",
      flexGrow: 1,
    }),
  })
)

interface StyledSummaryProps {
  isStale: boolean
  expanded: boolean
  isCompact: boolean
}

export const StyledSummary = styled.summary<StyledSummaryProps>(
  ({ theme, isStale, expanded, isCompact }) => ({
    position: "relative",
    display: "flex",
    width: "100%",
    // Prevent chevron/user icon from overlapping content by ensuring
    // children can shrink and the summary can clip excess inline overflow.
    minWidth: 0,
    overflow: "hidden",
    "&:focus": {
      outline: "none",
    },
    "&:focus-visible": {
      boxShadow: theme.shadows.focusRing,
    },
    fontSize: "inherit",
    alignItems: "center",
    cursor: "pointer",
    listStyleType: "none",
    "&::-webkit-details-marker": {
      display: "none",
    },
    ...(!isCompact
      ? {
          // Normal style (with border)
          paddingLeft: theme.spacing.md,
          paddingRight: theme.spacing.md,
          paddingTop: theme.spacing.twoXS,
          paddingBottom: theme.spacing.twoXS,
          minHeight: `calc(${theme.sizes.minElementHeight} - 2 * ${theme.sizes.borderWidth})`,
          backgroundColor: expanded ? theme.colors.bgMix : "transparent",
          // When expanded, only round the top corners
          borderRadius: expanded
            ? `${theme.radii.default} ${theme.radii.default} 0 0`
            : theme.radii.default,
          // Animate border-radius changes when expanding/collapsing to match the animation of
          // the expander content. Use a delay when collapsing because the content first needs
          // to slide up.
          transition: expanded
            ? `border-radius 200ms cubic-bezier(0.23, 1, 0.32, 1), background-color 150ms ease`
            : `border-radius 200ms cubic-bezier(0.23, 1, 0.32, 1) 300ms, background-color 150ms ease`,
          "&:hover, &:focus-visible": {
            backgroundColor: theme.colors.darkenedBgMix15,
          },
          "&:active": {
            backgroundColor: theme.colors.darkenedBgMix25,
          },
        }
      : {
          // Compact style: minimal padding, muted appearance with opacity.
          // We use opacity rather than theme color tokens because the label
          // is rendered as markdown and may contain mixed colors, icons, or
          // other styled components. Opacity uniformly mutes all content
          // while preserving relative contrast within the label.
          paddingLeft: 0,
          paddingRight: 0,
          paddingTop: theme.spacing.twoXS,
          paddingBottom: theme.spacing.twoXS,
          backgroundColor: "transparent",
          borderRadius: theme.radii.default,
          opacity: theme.opacities.secondary,
          transition: "opacity 150ms ease",
          "&:hover, &:focus-visible": {
            // On hover, remove opacity for normal appearance (no background)
            opacity: 1,
          },
        }),
    ...(isStale && STALE_STYLES),
  })
)

// Explicit interface needed because inert is not in @types/react for this project.
interface StyledDetailsPanelProps {
  /**
   * The inert attribute makes the element non-interactive and excludes
   * it from browser find-in-page (Cmd+F) searches when collapsed.
   */
  inert?: "" | undefined
  isCompact: boolean
}

export const StyledDetailsPanel = styled.div<StyledDetailsPanelProps>(
  ({ theme, isCompact }) =>
    !isCompact
      ? {
          // Normal style (with border)
          padding: theme.spacing.lg,
          borderTop: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
        }
      : {
          // Compact style: no border-top, minimal top padding
          padding: 0,
          paddingTop: theme.spacing.sm,
          borderTop: "none",
        }
)
