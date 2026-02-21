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

export const StyledBreadcrumbs = styled.nav(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing.sm,

  "& > ol": {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    listStyle: "none",
    margin: 0,
    padding: 0,
    gap: theme.spacing.none,
  },
}))

export const StyledBreadcrumbItem = styled.li(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  fontSize: theme.fontSizes.sm,
  lineHeight: theme.lineHeights.base,
}))

export const StyledBreadcrumbLink = styled.button<{ $disabled: boolean }>(
  ({ theme, $disabled }) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: theme.spacing.twoXS,
    background: "none",
    border: "none",
    padding: `${theme.spacing.twoXS} ${theme.spacing.xs}`,
    margin: 0,
    borderRadius: theme.radii.sm,
    cursor: $disabled ? "default" : "pointer",
    color: $disabled ? theme.colors.fadedText40 : theme.colors.link,
    textDecoration: "none",
    fontSize: "inherit",
    fontFamily: "inherit",
    transition: "background-color 0.2s ease",

    "&:hover": $disabled
      ? {}
      : {
          backgroundColor: theme.colors.darkenedBgMix15,
          textDecoration: "underline",
        },

    "&:focus-visible": {
      outline: `2px solid ${theme.colors.primary}`,
      outlineOffset: "1px",
    },
  })
)

export const StyledBreadcrumbCurrent = styled.span<{ $disabled: boolean }>(
  ({ theme, $disabled }) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: theme.spacing.twoXS,
    padding: `${theme.spacing.twoXS} ${theme.spacing.xs}`,
    color: $disabled ? theme.colors.fadedText40 : theme.colors.bodyText,
    fontWeight: theme.fontWeights.normal,
  })
)

export const StyledBreadcrumbSeparator = styled.span(({ theme }) => ({
  display: "inline-flex",
  alignItems: "center",
  color: theme.colors.fadedText60,
  padding: `0 ${theme.spacing.twoXS}`,
  userSelect: "none",
}))

export const StyledBreadcrumbIcon = styled.span(() => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
}))
