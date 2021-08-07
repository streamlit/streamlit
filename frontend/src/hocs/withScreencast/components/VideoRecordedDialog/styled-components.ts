/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import styled from "@emotion/styled"

export const StyledVideo = styled.video(({ theme }) => ({
  width: theme.sizes.full,
  borderRadius: theme.radii.md,
}))

export const StyledDialogContainer = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  width: theme.sizes.full,
}))

export const StyledRow = styled.div(({ theme }) => ({
  display: "flex",
  flexDirection: "row",
  paddingTop: theme.spacing.md,
  paddingBottom: theme.spacing.md,
}))

export const StyledFirstColumn = styled.div(({ theme }) => ({
  paddingRight: theme.spacing.lg,
  textAlign: "right",
  color: theme.colors.gray,
  fontWeight: theme.fontWeights.bold,
  width: "6em",
}))

export const StyledSecondColumn = styled.div(({ theme }) => ({
  flex: 1,
  paddingRight: theme.spacing.lg,
  marginRight: "6em",
  [`@media (max-width: ${theme.breakpoints.sm})`]: {
    marginRight: theme.spacing.none,
  },
}))

export const StyledVideoFormatInstructions = styled.p(({ theme }) => ({
  marginTop: theme.spacing.sm,
  marginBottom: theme.spacing.none,
  fontSize: theme.fontSizes.sm,
}))

export const StyledDownloadButtonContainer = styled.div(({ theme }) => ({
  marginTop: theme.spacing.twoXS,
}))
