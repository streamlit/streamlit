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

/**
 * A styled menu list component used by the column menu.
 */
export const StyledMenuList = styled.div(({ theme }) => ({
  paddingTop: theme.spacing.xs,
  paddingBottom: theme.spacing.xs,
}))

interface StyledMenuListItemProps {
  isActive?: boolean
  hasSubmenu?: boolean
}
/**
 * A styled menu list item component used by the column menu.
 */
export const StyledMenuListItem = styled.div<StyledMenuListItemProps>(
  ({ theme, isActive, hasSubmenu }) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: theme.spacing.sm,
    paddingLeft: theme.spacing.sm,
    paddingRight: theme.spacing.sm,
    paddingTop: theme.spacing.twoXS,
    paddingBottom: theme.spacing.twoXS,
    cursor: "pointer",
    backgroundColor: isActive ? theme.colors.darkenedBgMix15 : undefined,
    "&:hover": {
      backgroundColor: theme.colors.darkenedBgMix15,
    },
    minWidth: theme.sizes.minMenuWidth,
    // If the submenu is activated, we need to place the menu icon & label to the left
    // and the submenu indicator to the right:
    ...(hasSubmenu && {
      justifyContent: "space-between",
      "& > :first-of-type": {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing.sm,
      },
    }),
  })
)

/**
 * A styled menu divider used by the column menu.
 */
export const StyledMenuDivider = styled.div(({ theme }) => ({
  height: theme.sizes.borderWidth,
  backgroundColor: theme.colors.borderColor,
  marginTop: theme.spacing.xs,
  marginBottom: theme.spacing.xs,
}))

export const StyledColumnHeaderRow = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  padding: `${theme.spacing.sm} ${theme.spacing.sm}`,
  cursor: "default",
  gap: theme.spacing.twoXS,
}))

export const StyledTypeIconContainer = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: theme.spacing.twoXS,
  border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
  borderRadius: theme.radii.md,
  backgroundColor: "transparent",
  color: theme.colors.bodyText,
  height: "fit-content",
}))

export const StyledColumnNameWithIcon = styled.div(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  flexGrow: 1,
  padding: `${theme.spacing.threeXS} ${theme.spacing.threeXS}`,
  border: `${theme.sizes.borderWidth} solid ${theme.colors.borderColor}`,
  borderRadius: theme.radii.md,
  backgroundColor: theme.colors.secondaryBg,
  minWidth: 0,
  overflow: "hidden",
}))

export const StyledColumnNameText = styled.span(({ theme }) => ({
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  flexGrow: 1,
  margin: `0 ${theme.spacing.xs}`,
  fontSize: theme.fontSizes.twoSm,
  maxWidth: "4rem",
}))

export const StyledIconButton = styled.button(({ theme }) => ({
  background: "none",
  border: "none",
  padding: theme.spacing.twoXS,
  cursor: "pointer",
  color: theme.colors.bodyText,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: theme.radii.md,
  transition: "background-color 0.2s ease",
  "&:hover": {
    backgroundColor: theme.colors.fadedText05,
  },
  "&:active": {
    backgroundColor: theme.colors.fadedText10,
  },
}))
