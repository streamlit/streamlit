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

// ===== StepsContainer styles =====

export const StyledStepsContainer = styled.div({
  width: "100%",
})

export const StyledStepsList = styled.div({
  display: "flex",
  flexDirection: "column",
  position: "relative",
  // Hide the connector line on the last step since there's nothing to connect to
  "& > .stStep:last-child [data-testid='stStepConnector']": {
    display: "none",
  },
})

// ===== Step styles =====

interface StyledStepProps {
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
    // When running (showing spinner), use primary color
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

export const StyledStepDescription = styled.div(({ theme }) => ({
  fontSize: theme.fontSizes.sm,
  color: theme.colors.fadedText60,
  lineHeight: theme.lineHeights.base,
}))

export const StyledStepBody = styled.div(({ theme }) => ({
  marginTop: theme.spacing.sm,
}))
