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
import React from "react"

import { transparentize } from "color2k"
import { Theme as GlideTheme, SpriteMap } from "@glideapps/glide-data-grid"
import { useTheme } from "@emotion/react"

import { EmotionTheme } from "src/theme"

/**
 * Creates a glide-data-grid compatible theme based on our theme configuration.
 *
 * @return a glide-data-grid compatible theme.
 */
function useCustomTheme(): Partial<GlideTheme> & {
  tableBorderRadius: string
  headerIcons: SpriteMap
} {
  const theme: EmotionTheme = useTheme()

  const headerIcons = React.useMemo<SpriteMap>(() => {
    return {
      // Material design icon `edit_note`:
      // https://fonts.google.com/icons?selected=Material%20Symbols%20Outlined%3Aedit_note%3AFILL%400%3Bwght%40400%3BGRAD%400%3Bopsz%4048
      // We need to provide this as string as explained explained here: https://github.com/glideapps/glide-data-grid/blob/main/packages/core/API.md#headericons
      editable: p =>
        `<svg xmlns="http://www.w3.org/2000/svg" height="40" viewBox="0 96 960 960" width="40" fill="${p.bgColor}"><path d="m800.641 679.743-64.384-64.384 29-29q7.156-6.948 17.642-6.948 10.485 0 17.742 6.948l29 29q6.948 7.464 6.948 17.95 0 10.486-6.948 17.434l-29 29Zm-310.64 246.256v-64.383l210.82-210.821 64.384 64.384-210.821 210.82h-64.383Zm-360-204.872v-50.254h289.743v50.254H130.001Zm0-162.564v-50.255h454.615v50.255H130.001Zm0-162.307v-50.255h454.615v50.255H130.001Z"/></svg>`,
    }
  }, [])

  return {
    // Explanations: https://github.com/glideapps/glide-data-grid/blob/main/packages/core/API.md#theme
    accentColor: theme.colors.primary,
    accentFg: theme.colors.white,
    accentLight: transparentize(theme.colors.primary, 0.9),
    borderColor: theme.colors.fadedText05,
    horizontalBorderColor: theme.colors.fadedText05,
    fontFamily: theme.genericFonts.bodyFont,
    bgSearchResult: transparentize(theme.colors.primary, 0.9),
    // Header styling:
    bgIconHeader: theme.colors.fadedText60,
    fgIconHeader: theme.colors.white,
    bgHeader: theme.colors.bgMix,
    bgHeaderHasFocus: theme.colors.secondaryBg,
    bgHeaderHovered: theme.colors.bgMix, // uses same color as bgHeader to deactivate the hover effect
    textHeader: theme.colors.fadedText60,
    textHeaderSelected: theme.colors.white,
    textGroupHeader: theme.colors.fadedText60,
    headerFontStyle: `${theme.fontSizes.sm}`,
    // Cell styling:
    baseFontStyle: theme.fontSizes.sm,
    editorFontSize: theme.fontSizes.sm,
    textDark: theme.colors.bodyText,
    textMedium: transparentize(theme.colors.bodyText, 0.2),
    textLight: theme.colors.fadedText40,
    textBubble: theme.colors.fadedText60,
    bgCell: theme.colors.bgColor,
    bgCellMedium: theme.colors.bgColor, // uses same as bgCell to always have the same background color
    cellHorizontalPadding: 8,
    cellVerticalPadding: 3,
    // Special cells:
    bgBubble: theme.colors.secondaryBg,
    bgBubbleSelected: theme.colors.secondaryBg,
    linkColor: theme.colors.linkText,
    drilldownBorder: theme.colors.darkenedBgMix25,
    // Unused settings:
    // lineHeight
    // Custom settings
    tableBorderRadius: theme.radii.md,
    // Configure custom SVG icons used in the column header:
    headerIcons,
  }
}

export default useCustomTheme
