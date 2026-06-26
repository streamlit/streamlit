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

/**
 * A rounded-pill tag chip using the theme's primary color as background.
 *
 * The entire element acts as the remove trigger (aria-label="Remove …") for
 * accessibility — keyboard users can remove a tag with Enter/Space.
 */
export const StyledTagButton = styled.button<{ $disabled?: boolean }>(
  ({ theme, $disabled }) => ({
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    gap: theme.spacing.sm,
    fontFamily: "inherit",
    fontWeight: theme.fontWeights.normal,
    fontSize: theme.fontSizes.sm,
    lineHeight: theme.lineHeights.inputWidget,
    height: theme.sizes.elementHighlightHeight,
    maxWidth: `calc(100% - ${theme.spacing.lg})`,
    paddingTop: theme.spacing.threeXS,
    paddingBottom: theme.spacing.threeXS,
    paddingLeft: theme.spacing.sm,
    paddingRight: theme.spacing.sm,
    marginTop: theme.spacing.none,
    marginLeft: theme.spacing.none,
    marginRight: theme.spacing.twoXS,
    marginBottom: theme.sizes.tagMarginInsideBorder,
    borderRadius: theme.radii.md2,
    border: "none",
    backgroundColor: $disabled
      ? theme.colors.fadedText10
      : theme.colors.primary,
    color: $disabled ? theme.colors.fadedText40 : theme.colors.white,
    cursor: $disabled ? "default" : "pointer",
    flexShrink: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    pointerEvents: $disabled ? "none" : "auto",
    "&:hover": {
      filter: $disabled ? undefined : "brightness(0.88)",
    },
    "&:focus-visible": {
      outline: `2px solid ${theme.colors.primary}`,
      outlineOffset: "1px",
    },
  })
)

/**
 * Text portion of the tag. Truncates with ellipsis and carries a `title`
 * for the overflow tooltip (set by the consumer to the full label text).
 */
export const StyledTagText = styled.span(() => ({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minWidth: 0,
  flexShrink: 1,
}))

/**
 * Small × icon at the trailing edge of the tag.
 * Size is set to 0.625em relative to the tag's font-size via the SVG's size prop.
 */
export const StyledTagRemoveIcon = styled.span(() => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  lineHeight: "normal",
}))

/**
 * Scrollable flex-wrap container that holds tag pills and the inline input.
 *
 * - `paddingTop / paddingLeft` of `tagMarginInsideBorder` provide the gap
 *   between the group border and the first tag, replacing flexbox centering.
 * - `alignItems: "flex-start"` + `tagMarginInsideBorder` bottom-margin on
 *   each tag/input produces symmetric spacing: equal space above (from
 *   container padding) and below (from tag marginBottom) — visually centring
 *   tags in single-row mode without relying on `alignSelf: "center"`.
 */
export const StyledTagGroupContainer = styled.div<{ $maxHeight?: string }>(
  ({ theme, $maxHeight }) => ({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    flex: 1,
    minWidth: 0,
    overflowY: "auto",
    overflowX: "hidden",
    paddingTop: theme.sizes.tagMarginInsideBorder,
    paddingLeft: theme.sizes.tagMarginInsideBorder,
    maxHeight: $maxHeight,
  })
)
