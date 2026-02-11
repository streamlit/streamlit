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

import { Block as BlockProto } from "@streamlit/protobuf"

import { STALE_STYLES, STALE_TRANSITION_PARAMS } from "~lib/theme"

// ===== StepsContainer styles =====

export const StyledStepsContainer = styled.div({
  width: "100%",
})

interface StyledStepsDetailsProps {
  isStale: boolean
}

export const StyledStepsDetails = styled.details<StyledStepsDetailsProps>(
  ({ isStale, theme }) => ({
    marginBottom: 0,
    marginTop: 0,
    width: "100%",
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
  })
)

interface StyledStepsSummaryProps {
  isStale: boolean
  expanded: boolean
}

export const StyledStepsSummary = styled.summary<StyledStepsSummaryProps>(
  ({ theme, isStale, expanded }) => ({
    position: "relative",
    display: "flex",
    width: "100%",
    minWidth: 0,
    overflow: "hidden",
    "&:focus": {
      outline: "none",
    },
    "&:focus-visible": {
      boxShadow: theme.shadows.focusRing,
    },
    fontSize: "inherit",
    paddingLeft: theme.spacing.md,
    paddingRight: theme.spacing.md,
    paddingTop: theme.spacing.twoXS,
    paddingBottom: theme.spacing.twoXS,
    minHeight: `calc(${theme.sizes.minElementHeight} - 2 * ${theme.sizes.borderWidth})`,
    alignItems: "center",
    cursor: "pointer",
    listStyleType: "none",
    "&::-webkit-details-marker": {
      display: "none",
    },
    backgroundColor: expanded ? theme.colors.bgMix : "transparent",
    borderRadius: expanded
      ? `${theme.radii.default} ${theme.radii.default} 0 0`
      : theme.radii.default,
    transition: expanded
      ? `border-radius 200ms cubic-bezier(0.23, 1, 0.32, 1), background-color 150ms ease`
      : `border-radius 200ms cubic-bezier(0.23, 1, 0.32, 1) 300ms, background-color 150ms ease`,
    "&:hover, &:focus-visible": {
      backgroundColor: theme.colors.darkenedBgMix15,
    },
    "&:active": {
      backgroundColor: theme.colors.darkenedBgMix25,
    },
    ...(isStale && STALE_STYLES),
  })
)

export const StyledStepsSummaryHeading = styled.span(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexGrow: 1,
  minWidth: 0,
  width: "100%",
  maxWidth: "100%",
  overflow: "hidden",
  gap: theme.spacing.sm,
}))

export const StyledStepsSummaryLabelWrapper = styled.div({
  display: "flex",
  width: "100%",
  flexGrow: 1,
  overflow: "hidden",
})

// Explicit interface needed because inert is not in @types/react for this project.
interface StyledStepsPanelProps {
  /**
   * The inert attribute makes the element non-interactive and excludes
   * it from browser find-in-page (Cmd+F) searches when collapsed.
   */
  inert?: "" | undefined
}

export const StyledStepsPanel = styled.div<StyledStepsPanelProps>(
  ({ theme }) => ({
    padding: theme.spacing.lg,
    borderTop: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
  })
)

export const StyledStepsList = styled.div({
  display: "flex",
  flexDirection: "column",
  gap: 0,
  position: "relative",
})

// ===== Step styles =====

export interface StyledStepProps {
  state: BlockProto.Step.State
}

export const StyledStep = styled.div<StyledStepProps>(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  alignItems: "flex-start",
  gap: theme.spacing.md,
  position: "relative",
  width: "100%",
}))

export const StyledStepIconColumn = styled.div({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "flex-start",
  position: "relative",
  flexShrink: 0,
  alignSelf: "stretch",
  // eslint-disable-next-line streamlit-custom/no-hardcoded-theme-values -- icon column width
  width: "24px",
  // eslint-disable-next-line streamlit-custom/no-hardcoded-theme-values -- z-index layering
  zIndex: 1,
})

interface StyledStepIconWrapperProps {
  state: BlockProto.Step.State
  isHovered?: boolean
}

export const StyledStepIconWrapper = styled.div<StyledStepIconWrapperProps>(
  ({ theme, state, isHovered }) => {
    // When hovered (showing chevron), use faded color
    // When running, use primary color
    // Otherwise use default faded color
    let color = theme.colors.fadedText60
    if (isHovered) {
      color = theme.colors.fadedText40
    } else if (state === BlockProto.Step.State.RUNNING) {
      color = theme.colors.primary
    }

    return {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.bgColor,
      color,

      borderRadius: "50%",
      position: "relative",
      // eslint-disable-next-line streamlit-custom/no-hardcoded-theme-values -- z-index layering
      zIndex: 2,
    }
  }
)

export const StyledStepConnector = styled.div(({ theme }) => ({
  position: "absolute",
  // Center the connector in the 24px wide icon column
  left: "11.5px",
  // Start below the icon to visually associate content with the step above
  top: "24px",
  bottom: 0,
  width: theme.sizes.borderWidth,
  backgroundColor: theme.colors.borderColor,
  zIndex: 0,
}))

export const StyledStepContent = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  flex: 1,
  minWidth: 0,
  paddingBottom: theme.spacing.lg,
}))

interface StyledStepHeaderProps {
  hasChildren: boolean
}

export const StyledStepHeader = styled.div<StyledStepHeaderProps>(
  ({ theme, hasChildren }) => ({
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.twoXS,
    cursor: hasChildren ? "pointer" : "default",
    minHeight: "24px",
  })
)

export const StyledStepHeaderContent = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing.twoXS,
  flex: 1,
}))

export const StyledStepLabel = styled.div(({ theme }) => ({
  fontWeight: theme.fontWeights.bold,
  color: theme.colors.headingColor,
  fontSize: theme.fontSizes.md,
  lineHeight: theme.lineHeights.tight,
}))

interface StyledStepDescriptionProps {
  state: BlockProto.Step.State
}

export const StyledStepDescription = styled.div<StyledStepDescriptionProps>(
  ({ theme, state }) => ({
    fontSize: theme.fontSizes.sm,
    color:
      state === BlockProto.Step.State.RUNNING
        ? theme.colors.primary
        : theme.colors.fadedText60,
    lineHeight: theme.lineHeights.base,
  })
)

export const StyledStepBody = styled.div(({ theme }) => ({
  marginTop: theme.spacing.sm,
}))
