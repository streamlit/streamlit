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

import styled, { CSSObject } from "@emotion/styled"

import { Block as BlockProto } from "@streamlit/protobuf"

import { STEP_CONNECTOR_BOTTOM_VAR } from "~lib/components/core/Layout/stepConnector"
import {
  STALE_STYLES,
  STALE_TRANSITION_PARAMS,
  VISUALLY_HIDDEN_STYLES,
} from "~lib/theme/consts"
import type { EmotionTheme } from "~lib/theme/types"

const { Type } = BlockProto.Expandable

/** Visual style of the expandable container, as chosen by the `type` param. */
export type ExpanderType = BlockProto.Expandable.Type

/** Visual emphasis of a step's icon, following the spec's icon precedence. */
export type StepIconTone = "default" | "muted" | "error"

/** Visually hidden but accessible to screen readers. */
export const StyledVisuallyHidden = styled.span(VISUALLY_HIDDEN_STYLES)

export const StyledExpandableContainer = styled.div<{
  expanderType: ExpanderType
}>(({ expanderType }) => ({
  width: "100%",
  // The connector is positioned against this container instead of the
  // <details>, which useDetailsAnimation clips while animating.
  ...(expanderType === Type.STEP && { position: "relative" }),
}))

interface StyledDetailsProps {
  isStale: boolean
  hasBorder: boolean
}

export const BORDER_SIZE = 1 // px
export const StyledDetails = styled.details<StyledDetailsProps>(
  ({ isStale, hasBorder, theme }) => ({
    marginBottom: 0,
    marginTop: 0,
    width: "100%",
    ...(hasBorder
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
          // Compact and step styles: no border
          border: "none",
          borderRadius: 0,
        }),
  })
)

export const StyledSummaryHeading = styled.span<{
  expanderType: ExpanderType
}>(({ theme, expanderType }) => {
  const isStep = expanderType === Type.STEP
  return {
    display: "flex",
    // A step keeps its icon aligned with the first line of the label so the
    // connector below the icon stays vertically predictable.
    alignItems: isStep ? "flex-start" : "center",
    flexGrow: 1,
    minWidth: 0,
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
    gap: isStep ? theme.spacing.md : theme.spacing.sm,
  }
})

export const StyledSummaryLabelWrapper = styled.div<{
  expanderType: ExpanderType
}>(({ theme, expanderType }) => ({
  display: "flex",
  overflow: "hidden",
  // In compact mode, don't grow so chevron stays directly after label
  ...(expanderType !== Type.COMPACT && {
    width: "100%",
    flexGrow: 1,
  }),
  ...(expanderType === Type.STEP && {
    alignItems: "center",
    minHeight: theme.iconSizes.xl,
  }),
}))

/** Square that holds a step's icon and defines the connector's horizontal axis. */
export const StyledStepIconColumn = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: theme.iconSizes.xl,
  height: theme.iconSizes.xl,
}))

function getStepIconColor(tone: StepIconTone, theme: EmotionTheme): string {
  switch (tone) {
    case "error":
      return theme.colors.redTextColor
    case "muted":
      return theme.colors.fadedText60
    default:
      return theme.colors.bodyText
  }
}

export const StyledStepIcon = styled.div<{ tone: StepIconTone }>(
  ({ theme, tone }) => ({
    display: "flex",
    color: getStepIconColor(tone, theme),
  })
)

export const StyledStepChevron = styled.div(({ theme }) => ({
  display: "none",
  color: theme.colors.fadedText60,
}))

export const StyledStepConnector = styled.div(({ theme }) => ({
  position: "absolute",
  // Start right below the icon square so the icon reads as a node on the line.
  top: theme.iconSizes.xl,
  bottom: `var(${STEP_CONNECTOR_BOTTOM_VAR}, 0)`,
  left: `calc((${theme.iconSizes.xl} - ${theme.sizes.borderWidth}) / 2)`,
  width: theme.sizes.borderWidth,
  backgroundColor: theme.colors.borderColor,
}))

/** Header of a step that has no content and therefore cannot be collapsed. */
export const StyledStepHeader = styled.div<{ isStale: boolean }>(
  ({ isStale }) => ({
    display: "flex",
    width: "100%",
    minWidth: 0,
    overflow: "hidden",
    ...(isStale && STALE_STYLES),
  })
)

/** The header chrome, which is the main thing the expander types differ in. */
function getSummaryStyle(
  expanderType: ExpanderType,
  theme: EmotionTheme,
  expanded: boolean
): CSSObject {
  switch (expanderType) {
    case Type.STEP:
      return {
        // Step style: no chrome at all, the timeline provides the structure.
        paddingInline: 0,
        paddingBlock: 0,
        backgroundColor: "transparent",
        // Only shows through the focus ring, which would otherwise be square
        // where the other styles round it.
        borderRadius: theme.radii.default,
        // Swapping the icon for a chevron in CSS rather than React state also
        // covers keyboard focus without an extra render.
        [`&:hover ${StyledStepIcon}, &:focus-visible ${StyledStepIcon}`]: {
          display: "none",
        },
        [`&:hover ${StyledStepChevron}, &:focus-visible ${StyledStepChevron}`]:
          {
            display: "flex",
          },
      }
    case Type.COMPACT:
      return {
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
      }
    default:
      return {
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
  }
}

interface StyledSummaryProps {
  isStale: boolean
  expanded: boolean
  expanderType: ExpanderType
}

export const StyledSummary = styled.summary<StyledSummaryProps>(
  ({ theme, isStale, expanded, expanderType }) => ({
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
    ...getSummaryStyle(expanderType, theme, expanded),
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
  expanderType: ExpanderType
}

export const StyledDetailsPanel = styled.div<StyledDetailsPanelProps>(
  ({ theme, expanderType }) => {
    switch (expanderType) {
      case Type.STEP:
        return {
          // Step style: content is indented to line up past the icon column
          padding: 0,
          paddingLeft: `calc(${theme.iconSizes.xl} + ${theme.spacing.md})`,
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.sm,
          borderTop: "none",
        }
      case Type.COMPACT:
        return {
          // Compact style: no border-top, minimal top padding
          padding: 0,
          paddingTop: theme.spacing.sm,
          borderTop: "none",
        }
      default:
        return {
          // Normal style (with border)
          padding: theme.spacing.lg,
          borderTop: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
        }
    }
  }
)
