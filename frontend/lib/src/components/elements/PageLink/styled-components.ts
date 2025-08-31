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

export interface StyledNavLinkContainerProps {
  // If true, the button should take up container's full width
  containerWidth?: boolean
}

export const StyledNavLinkContainer = styled.div<StyledNavLinkContainerProps>(
  ({ containerWidth }) => ({
    display: "flex",
    flexDirection: "column",
    width: containerWidth ? "100%" : "fit-content",
  })
)

export interface StyledNavLinkProps {
  disabled: boolean
  isCurrentPage: boolean
  // If true, the button should take up container's full width
  containerWidth?: boolean
}

export const StyledNavLink = styled.a<StyledNavLinkProps>(
  ({ disabled, isCurrentPage, containerWidth, theme }) => ({
    textDecoration: "none",
    width: containerWidth ? "100%" : "fit-content",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: theme.spacing.sm,
    borderRadius: theme.radii.default,

    paddingLeft: theme.spacing.sm,
    paddingRight: theme.spacing.sm,
    marginTop: theme.spacing.threeXS,
    marginBottom: theme.spacing.threeXS,
    lineHeight: theme.lineHeights.menuItem,

    backgroundColor: isCurrentPage
      ? theme.colors.darkenedBgMix15
      : "transparent",

    "&:hover": {
      backgroundColor: isCurrentPage
        ? theme.colors.darkenedBgMix25
        : theme.colors.darkenedBgMix15,
    },

    "&:active,&:visited,&:hover": {
      textDecoration: "none",
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
          borderColor: theme.colors.borderColor,
          backgroundColor: theme.colors.transparent,
          color: theme.colors.fadedText40,
          cursor: "not-allowed",
          "&:hover": {
            color: theme.colors.fadedText40,
            backgroundColor: theme.colors.transparent,
          },
        }
      : {}),
  })
)

export interface StyledNavLinkTextProps {
  disabled: boolean
}

export const StyledNavLinkText = styled.span<StyledNavLinkTextProps>(
  ({ disabled, theme }) => ({
    color: theme.colors.bodyText,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    display: "table-cell",

    ...(disabled
      ? {
          borderColor: theme.colors.borderColor,
          backgroundColor: theme.colors.transparent,
          color: theme.colors.fadedText40,
          cursor: "not-allowed",
        }
      : {}),
  })
)
