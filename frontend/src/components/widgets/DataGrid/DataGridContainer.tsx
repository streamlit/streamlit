/**
 * @license
 * Copyright 2018-2022 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ReactElement } from "react"

import styled, { ThemeProvider } from "styled-components"
import { useTheme } from "emotion-theming"
import { transparentize } from "color2k"
import { Theme as GlideTheme } from "@glideapps/glide-data-grid"

import { Theme } from "src/theme"

/**
 * Creates a glide-data-grid compatible theme based on our theme configuration.
 *
 * @param theme: Our theme configuration.
 *
 * @return a glide-data-grid compatible theme.
 */
function createDataGridTheme(theme: Theme): GlideTheme {
  return {
    // Explanations: https://github.com/glideapps/glide-data-grid/blob/main/packages/core/API.md#theme
    accentColor: theme.colors.primary,
    accentFg: theme.colors.white, // TODO(lukasmasuch): Do we need a different color here?
    accentLight: transparentize(theme.colors.primary, 0.9),
    borderColor: theme.colors.fadedText05,
    fontFamily: theme.fonts.sansSerif,
    bgSearchResult: transparentize(theme.colors.primary, 0.9),
    // Header styling:
    bgIconHeader: theme.colors.fadedText60,
    fgIconHeader: theme.colors.white,
    bgHeader: theme.colors.bgMix,
    bgHeaderHasFocus: theme.colors.secondaryBg,
    bgHeaderHovered: theme.colors.bgMix, // do not apply a hover effect
    textHeader: theme.colors.fadedText60,
    textHeaderSelected: theme.colors.white,
    headerFontStyle: `${theme.fontSizes.sm}`,
    // Cell styling
    baseFontStyle: theme.fontSizes.sm,
    editorFontSize: theme.fontSizes.sm,
    textDark: theme.colors.bodyText,
    textMedium: transparentize(theme.colors.bodyText, 0.2),
    textLight: theme.colors.fadedText60,
    textBubble: theme.colors.fadedText60,
    bgCell: theme.colors.bgColor,
    bgCellMedium: theme.colors.bgColor, // TODO(lukasmasuch): Do we need a different color here?
    cellHorizontalPadding: 8,
    cellVerticalPadding: 3,
    // Special cells:
    bgBubble: theme.colors.secondaryBg,
    bgBubbleSelected: theme.colors.secondaryBg,
    linkColor: theme.colors.linkText,
    drilldownBorder: "rgba(0, 0, 0, 0)", // TODO(lukasmasuch): Do we need a different color here?
  }
}

interface ResizableContainerProps {
  width: number
  height: number
  minHeight: number
  theme: Theme
}

/**
 * A resizable data grid container component.
 *
 * We need to use the styled-components library here instead of emotion.
 * The reason is that glide-data-grid requires a styled-component to pass down the theme.
 */
const ResizableContainer = styled.div<ResizableContainerProps>`
  overflow: hidden;
  position: relative;
  resize: vertical;
  min-height: ${p => p.minHeight}px;
  width: ${p => p.width}px;
  height: ${p => p.height}px;
  border: 1px solid ${p => p.theme.colors.fadedText05};

  > :first-child {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
  }

  // Hide the resize handle in the right corner. Resizing is still be possible.
  ::-webkit-resizer {
    display: none;
  }
`
interface DataGridContainerProps {
  width: number
  height: number
  minHeight: number
  children: ReactElement
}

/**
 * A themed and resizable container for then interactive data table.
 */
function ThemedDataGridContainer({
  width,
  height,
  minHeight,
  children,
}: DataGridContainerProps): ReactElement {
  const theme: Theme = useTheme()

  return (
    // This is a styled-components theme provider (not emotion!).
    // It is required by glide-data-grid to customize the theming.
    <ThemeProvider theme={createDataGridTheme(theme)}>
      <ResizableContainer
        className="stDataGrid"
        width={width}
        height={height}
        minHeight={minHeight}
        theme={theme}
      >
        {children}
      </ResizableContainer>
    </ThemeProvider>
  )
}

export default ThemedDataGridContainer
