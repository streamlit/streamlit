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

export const StyledHeader = styled.div(({ theme }) => ({
  // We do not want to change the font for this based on theme.
  fontFamily: theme.fonts.sansSerif,
  fontWeight: theme.fontWeights.bold,
  fontSize: theme.fontSizes.lg,
  marginTop: theme.spacing.twoXL,
  marginBottom: theme.spacing.twoXS,

  [`@media (max-width: ${theme.breakpoints.md})`]: {
    marginTop: theme.spacing.md,
  },
}))

export const StyledSubheader = styled.div(({ theme }) => ({
  // We do not want to change the font for this based on theme.
  fontFamily: theme.fonts.sansSerif,
  fontWeight: theme.fontWeights.normal,
  fontSize: theme.fontSizes.md,
  marginTop: theme.spacing.twoXS,
  marginBottom: theme.spacing.md,

  [`@media (max-width: ${theme.breakpoints.md})`]: {
    marginTop: theme.spacing.md,
  },
}))

export const StyledCardContainer = styled.div(({ theme }) => ({
  display: "grid",
  maxWidth: `calc(1.25 * ${theme.sizes.contentMaxWidth})`,
  gridTemplateColumns: "1fr 1fr 1fr",
  gridGap: theme.spacing.none,

  [`@media (max-width: ${theme.breakpoints.md})`]: {
    gridTemplateColumns: "1fr",
  },
}))

export const StyledElement = styled.div(({ theme }) => ({
  display: "inline-flex",
  marginTop: theme.spacing.sm,

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
}))

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
