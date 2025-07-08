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
import { useMemo } from "react"

import { Theme as GlideTheme, SpriteMap } from "@glideapps/glide-data-grid"
import { mix, transparentize } from "color2k"

import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { convertRemToPx } from "~lib/theme"

export type CustomGridTheme = {
  // The theme configuration for the glide-data-grid
  glideTheme: Partial<GlideTheme>
  // The table border radius in pixels
  tableBorderRadius: string
  // The table border size in pixels
  tableBorderWidth: number
  // The default table height in pixels
  defaultTableHeight: number
  // Configure custom SVG icons used in the column header:
  headerIcons: SpriteMap
  // The background color of the row when it is hovered:
  bgRowHovered: string
  // Min column width in pixels used for manual and automatic resizing
  minColumnWidth: number
  // Max column width in pixels used for manual resizing
  maxColumnWidth: number
  // Max column width in pixels used for automatic column sizing
  maxColumnAutoWidth: number
  // The default row height in pixels
  defaultRowHeight: number
  // The default header height in pixels
  defaultHeaderHeight: number
}

/**
 * Creates a glide-data-grid compatible theme based on our theme configuration.
 *
 * @return a glide-data-grid compatible theme.
 */
function useCustomTheme(): Readonly<CustomGridTheme> {
  const theme = useEmotionTheme()

  const gridTheme: CustomGridTheme = useMemo<CustomGridTheme>(() => {
    const headerIcons = {
      // Material design icon `edit_note`:
      // https://fonts.google.com/icons?selected=Material%20Symbols%20Outlined%3Aedit_note%3AFILL%400%3Bwght%40400%3BGRAD%400%3Bopsz%4048
      // We need to provide this as string as explained explained here: https://github.com/glideapps/glide-data-grid/blob/main/packages/core/API.md#headericons
      editable: (p: { bgColor: string }) =>
        `<svg xmlns="http://www.w3.org/2000/svg" height="40" viewBox="0 96 960 960" width="40" fill="${p.bgColor}"><path d="m800.641 679.743-64.384-64.384 29-29q7.156-6.948 17.642-6.948 10.485 0 17.742 6.948l29 29q6.948 7.464 6.948 17.95 0 10.486-6.948 17.434l-29 29Zm-310.64 246.256v-64.383l210.82-210.821 64.384 64.384-210.821 210.82h-64.383Zm-360-204.872v-50.254h289.743v50.254H130.001Zm0-162.564v-50.255h454.615v50.255H130.001Zm0-162.307v-50.255h454.615v50.255H130.001Z"/></svg>`,
    }

    const glideTheme = {
      // Explanations: https://github.com/glideapps/glide-data-grid/blob/main/packages/core/API.md#theme
      accentColor: theme.colors.primary,
      accentFg: theme.colors.white,
      accentLight: transparentize(theme.colors.primary, 0.9),
      borderColor: theme.colors.dataframeBorderColor,
      horizontalBorderColor: theme.colors.dataframeBorderColor,
      fontFamily: theme.genericFonts.bodyFont,
      bgSearchResult: transparentize(theme.colors.primary, 0.9),
      resizeIndicatorColor: theme.colors.primary,
      // Header styling:
      bgIconHeader: theme.colors.fadedText60,
      fgIconHeader: theme.colors.white,
      bgHeader: theme.colors.dataframeHeaderBackgroundColor,
      bgHeaderHasFocus: transparentize(theme.colors.darkenedBgMix100, 0.9),
      bgHeaderHovered: transparentize(theme.colors.darkenedBgMix100, 0.9),
      textHeader: theme.colors.fadedText60,
      textHeaderSelected: theme.colors.white,
      textGroupHeader: theme.colors.fadedText60,
      headerIconSize: Math.round(convertRemToPx("1.125rem")),
      headerFontStyle: `${theme.fontWeights.normal} ${convertRemToPx(theme.fontSizes.sm)}px`,
      // Cell styling:
      baseFontStyle: `${theme.fontWeights.normal} ${convertRemToPx(theme.fontSizes.sm)}px`,
      editorFontSize: theme.fontSizes.sm,
      textDark: theme.colors.bodyText,
      textMedium: transparentize(theme.colors.bodyText, 0.2),
      textLight: theme.colors.fadedText40,
      bgCell: theme.colors.bgColor,
      // uses same as bgCell to always have the same background color:
      bgCellMedium: theme.colors.bgColor,
      cellHorizontalPadding: Math.round(convertRemToPx(theme.spacing.sm)),
      cellVerticalPadding: Math.round(convertRemToPx("0.1875rem")),
      // Special cells:
      textBubble: theme.colors.fadedText60,
      bgBubble: theme.colors.secondaryBg,
      bgBubbleSelected: theme.colors.secondaryBg,
      bubbleHeight: Math.round(convertRemToPx("1.25rem")),
      bubblePadding: Math.round(convertRemToPx(theme.spacing.sm)),
      bubbleMargin: Math.round(convertRemToPx(theme.spacing.twoXS)),
      linkColor: theme.colors.link,
      drilldownBorder: theme.colors.darkenedBgMix25,
      checkboxMaxSize: Math.round(convertRemToPx(theme.sizes.checkbox)),
      // Unused settings:
      // lineHeight
      // markerFontStyle: string;
      // headerBottomBorderColor?: string;
    }

    return {
      glideTheme,
      tableBorderRadius: theme.radii.default,
      tableBorderWidth: 1,
      // glide-data-grid can only handle integer pixel values:
      defaultTableHeight: Math.round(convertRemToPx("25rem")),
      minColumnWidth: Math.round(convertRemToPx("3.125rem")),
      maxColumnWidth: Math.round(convertRemToPx("62.5rem")),
      maxColumnAutoWidth: Math.round(convertRemToPx("31.25rem")),
      defaultRowHeight: Math.round(convertRemToPx("2.1875rem")),
      defaultHeaderHeight: Math.round(convertRemToPx("2.1875rem")),
      bgRowHovered: mix(theme.colors.bgColor, theme.colors.secondaryBg, 0.3),
      headerIcons,
    }
  }, [theme])

  return gridTheme
}

export default useCustomTheme
