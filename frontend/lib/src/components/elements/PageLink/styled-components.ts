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

export const StyledNavLinkContainer = styled.div(() => ({
  display: "flex",
  flexDirection: "column",
}))

export interface StyledNavLinkProps {
  disabled: boolean
  isActive: boolean
  useContainerWidth?: boolean
}

export const StyledNavLink = styled.a<StyledNavLinkProps>(
  ({ disabled, isActive, useContainerWidth, theme }) => {
    const defaultPageLinkStyles = {
      textDecoration: "none",
      fontWeight: isActive ? 600 : 400,
    }

    return {
      ...defaultPageLinkStyles,
      width: useContainerWidth ? "auto" : "fit-content",
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      borderRadius: theme.spacing.twoXS,
      border: `1px solid ${theme.colors.fadedText20}`,

      paddingLeft: theme.spacing.sm,
      paddingRight: theme.spacing.sm,
      marginLeft: theme.spacing.lg,
      marginRight: theme.spacing.lg,
      marginTop: theme.spacing.threeXS,
      marginBottom: theme.spacing.threeXS,
      lineHeight: theme.lineHeights.menuItem,

      backgroundColor: isActive ? theme.colors.darkenedBgMix15 : "transparent",

      "&:hover": {
        backgroundColor: isActive
          ? theme.colors.darkenedBgMix25
          : theme.colors.darkenedBgMix15,
      },

      "&:active,&:visited,&:hover": {
        ...defaultPageLinkStyles,
      },

      "&:focus": {
        outline: "none",
      },

      "&:focus-visible": {
        backgroundColor: theme.colors.darkenedBgMix15,
      },

      [`@media print`]: {
        paddingLeft: theme.spacing.none,
      },

      ...(disabled
        ? {
            borderColor: theme.colors.fadedText10,
            backgroundColor: theme.colors.transparent,
            color: theme.colors.fadedText40,
            cursor: "not-allowed",
            "&:hover": {
              backgroundColor: theme.colors.transparent,
            },
          }
        : {}),
    }
  }
)

export const StyledNavLinkText = styled.span<StyledNavLinkProps>(
  ({ disabled, isActive, theme }) => ({
    color: isActive ? theme.colors.bodyText : theme.colors.fadedText60,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    display: "table-cell",

    ...(disabled
      ? {
          borderColor: theme.colors.fadedText10,
          backgroundColor: theme.colors.transparent,
          color: theme.colors.fadedText40,
          cursor: "not-allowed",
        }
      : {}),
  })
)
