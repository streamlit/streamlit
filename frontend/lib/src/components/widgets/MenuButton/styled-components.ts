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

export const StyledMenuButtonLabelContainer = styled.div<{
  $hideChevron?: boolean
}>(({ theme, $hideChevron }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.threeXS,
  // Offset the expansion icon's built-in padding for consistent button padding.
  // Only apply when the chevron is visible.
  marginRight: $hideChevron ? 0 : `calc(-${theme.iconSizes.lg} * 0.25)`,
}))

export const StyledMenuButtonExpansionIcon = styled.div(({ theme }) => ({
  display: "inline-flex",
  // Vertically align the expansion icon with the button label
  marginTop: theme.spacing.threeXS,
}))

export const StyledMenuOptionLabel = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.sm,
  whiteSpace: "nowrap",
}))

export const StyledMenuOptionIcon = styled.span(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: theme.iconSizes.md,
  color: theme.colors.bodyText,
}))

export const StyledMenuItem = styled.li(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  marginTop: theme.spacing.twoXS,
  marginBottom: theme.spacing.twoXS,
  padding: 0,
  background: "transparent",
  cursor: "pointer",
  listStyle: "none",
  minWidth: theme.sizes.minMenuWidth,
}))
