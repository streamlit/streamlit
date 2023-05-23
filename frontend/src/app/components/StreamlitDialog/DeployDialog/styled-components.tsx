/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

export const StyledSubheader = styled.div(({ theme }) => ({
  // We do not want to change the font for this based on theme.
  fontFamily: theme.fonts.sansSerif,
  fontWeight: theme.fontWeights.bold,
  fontSize: theme.fontSizes.lg,
  color: theme.colors.grey90,
  marginTop: theme.spacing.twoXL,
  marginBottom: theme.spacing.md,

  [`@media (max-width: ${theme.breakpoints.md})`]: {
    marginTop: theme.spacing.md,
  },
}))

interface StyledElementProps {
  extraSpacing?: boolean
}

export const StyledCardContainer = styled.div(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gridGap: theme.spacing.twoXL,

  [`@media (max-width: ${theme.breakpoints.md})`]: {
    gridTemplateColumns: "1fr",
  },
}))

export const StyledElement = styled.div<StyledElementProps>(
  ({ theme, extraSpacing }) => ({
    display: "inline-flex",
    marginTop: extraSpacing ? "9px" : theme.spacing.smPx,

    "& > span": {
      // We do not want to change the font for this based on theme.
      fontFamily: theme.fonts.sansSerif,
      fontWeight: theme.fontWeights.normal,
      fontSize: theme.fontSizes.md,
      marginLeft: theme.spacing.twoXL,
      color: theme.colors.gray70,
    },
    "& > img": {
      position: "absolute",
      marginTop: theme.spacing.sm,
    },
  })
)

export const StyledActionsWrapper = styled.div(({ theme }) => ({
  display: "flex",
  marginTop: theme.spacing.threeXL,

  "& > button": {
    marginRight: theme.spacing.twoXL,
  },

  [`@media (max-width: ${theme.breakpoints.md})`]: {
    marginTop: theme.spacing.xl,
  },
}))
