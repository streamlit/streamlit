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

import { transparentize } from "color2k"
import { Theme as GlideTheme } from "@glideapps/glide-data-grid"
import { useTheme } from "@emotion/react"

import { EmotionTheme } from "src/lib/theme"

/**
 * Creates a glide-data-grid compatible theme based on our theme configuration.
 *
 * @return a glide-data-grid compatible theme.
 */
function useCustomTheme(): Partial<GlideTheme> & {
  tableBorderRadius: string
} {
  const theme: EmotionTheme = useTheme()

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
  }
}

export default useCustomTheme
