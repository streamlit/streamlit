/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { EmotionTheme } from "@streamlit/lib/src/theme"

type CustomThemeReturn = {
  theme: Partial<GlideTheme>
  tableBorderRadius: string
  headerIcons: SpriteMap
}

/**
 * Creates a glide-data-grid compatible theme based on our theme configuration.
 *
 * @return a glide-data-grid compatible theme.
 */
function useCustomTheme(): CustomThemeReturn {
  const theme: EmotionTheme = useTheme()

  const headerIcons = React.useMemo<SpriteMap>(() => {
    return {
      // Material design icon `edit_note`:
      // https://fonts.google.com/icons?selected=Material+Symbols+Rounded:edit_note:FILL@0;wght@400;GRAD@0;opsz@40&icon.size=40
      // We need to provide this as string as explained explained here: https://github.com/glideapps/glide-data-grid/blob/main/packages/core/API.md#headericons
      editable: p =>
        `<svg xmlns="http://www.w3.org/2000/svg" height="40" viewBox="0 96 960 960" width="40" fill="${p.bgColor}"><path d="M193.33-406.67q-14.16 0-23.75-9.61-9.58-9.62-9.58-23.84 0-14.21 9.58-23.71 9.59-9.5 23.75-9.5H420q14.17 0 23.75 9.61 9.58 9.62 9.58 23.84 0 14.21-9.58 23.71t-23.75 9.5H193.33Zm0-163.33q-14.16 0-23.75-9.62-9.58-9.61-9.58-23.83 0-14.22 9.58-23.72 9.59-9.5 23.75-9.5h393.34q14.16 0 23.75 9.62 9.58 9.62 9.58 23.83 0 14.22-9.58 23.72-9.59 9.5-23.75 9.5H193.33Zm0-163.33q-14.16 0-23.75-9.62-9.58-9.62-9.58-23.83 0-14.22 9.58-23.72 9.59-9.5 23.75-9.5h393.34q14.16 0 23.75 9.62 9.58 9.61 9.58 23.83 0 14.22-9.58 23.72-9.59 9.5-23.75 9.5H193.33Zm326.67 540v-76q0-6.38 2.33-12.36 2.34-5.98 7.67-11.31l210.74-209.85q9.08-9.08 20.17-13.11Q772-520 783-520q12 0 23 4.5t20 13.5l37 37q8.67 9 12.83 20 4.17 11 4.17 22t-4.33 22.5q-4.34 11.5-13.39 20.58L653-170q-5.33 5.33-11.31 7.67-5.98 2.33-12.36 2.33h-76q-14.16 0-23.75-9.58-9.58-9.59-9.58-23.75ZM820-423l-37-37 37 37ZM580-220h38l121-122-18-19-19-18-122 121v38Zm141-141-19-18 37 37-18-19Z"/></svg>`,
    }
  }, [])

  const glideTheme = React.useMemo<Partial<GlideTheme>>(() => {
    return {
      // Explanations: https://github.com/glideapps/glide-data-grid/blob/main/packages/core/API.md#theme
      accentColor: theme.colors.primary,
      accentFg: theme.colors.white,
      accentLight: transparentize(theme.colors.primary, 0.9),
      borderColor: theme.colors.fadedText05,
      horizontalBorderColor: theme.colors.fadedText05,
      fontFamily: theme.genericFonts.bodyFont,
      bgSearchResult: transparentize(theme.colors.primary, 0.9),
      resizeIndicatorColor: theme.colors.primary,
      // Header styling:
      bgIconHeader: theme.colors.fadedText60,
      fgIconHeader: theme.colors.white,
      bgHeader: theme.colors.bgMix,
      bgHeaderHasFocus: theme.colors.secondaryBg,
      bgHeaderHovered: theme.colors.secondaryBg,
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
      // headerIconSize: number;
      // markerFontStyle: string;
      // resizeIndicatorColor?: string;
      // headerBottomBorderColor?: string;
    }
  }, [theme])

  return {
    theme: glideTheme,
    tableBorderRadius: theme.radii.default,
    // Configure custom SVG icons used in the column header:
    headerIcons,
  }
}

export default useCustomTheme
