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

import styled from "@emotion/styled"
import { ChevronLeft } from "react-feather"

export const StyledBackButton = styled(ChevronLeft)(({ theme }) => ({
  cursor: "pointer",
  marginRight: theme.spacing.lg,
}))

export const StyledDialogBody = styled.div(({ theme }) => ({
  display: "grid",
  gap: theme.spacing.twoXL,
  gridTemplateColumns: "1fr 1fr",
  margin: 0,
  padding: 0,
}))

export const StyledFullRow = styled.div(({ theme }) => ({
  gridColumnStart: 1,
  gridColumnEnd: -1,
  display: "grid",
  gap: theme.spacing.xs,
}))

export const StyledHeader = styled.h2(({ theme }) => ({
  paddingBottom: 0,
  paddingTop: 0,
  marginBottom: theme.spacing.md,
  marginTop: "0",
  fontWeight: theme.fontWeights.bold,
  fontSize: theme.fontSizes.md,
  lineHeight: theme.lineHeights.tight,
  color: theme.colors.bodyText,
  display: "grid",
  gridAutoFlow: "row",
  gap: theme.spacing.xs,

  // Override the default global style for a h2:first-of-type
  "&:first-of-type": {
    marginTop: 0,
  },
}))

export const StyledLabel = styled.label(({ theme }) => ({
  paddingBottom: 0,
  paddingTop: 0,
  marginBottom: 0,
  marginTop: 0,
  lineHeight: theme.lineHeights.tight,
  fontSize: theme.fontSizes.sm,
}))

export const StyledHr = styled.hr(({ theme }) => ({
  padding: 0,
  marginBottom: 0,
  marginLeft: `-${theme.spacing.xl}`,
  marginRight: `-${theme.spacing.xl}`,
  marginTop: 0,
}))

export const StyledButtonContainer = styled.div(({ theme }) => ({
  marginTop: theme.spacing.md,
}))

export const StyledCheckbox = styled.input(({ theme }) => ({
  marginRight: theme.spacing.xs,
  appearance: "none",
  border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
  width: theme.fontSizes.md,
  height: theme.fontSizes.md,
  borderRadius: `min(${theme.radii.md}, ${theme.radii.maxCheckbox})`,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  verticalAlign: "middle",
  overflow: "hidden",

  "&:focus-visible": {
    outline: `2px solid ${theme.colors.primary}`,
  },

  "&:checked": {
    backgroundColor: theme.colors.primary,

    "&:after": {
      content: '"✓"',
      fontFamily: theme.fonts.monospace,
      fontSize: theme.fontSizes.md,
      color: theme.colors.white,
      lineHeight: theme.lineHeights.none,
    },
  },

  "&:disabled": {
    backgroundColor: theme.colors.darkenedBgMix15,
  },
}))

export const StyledDeployErrorContent = styled.div(({ theme }) => ({
  "& > ul": {
    paddingLeft: theme.spacing.twoXL,
  },
}))
