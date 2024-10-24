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

import merge from "lodash/merge"

import {
  convertRemToPx,
  EmotionTheme,
  getBlue80,
  getCategoricalColorsArray,
  getDecreasingRed,
  getDivergingColorsArray,
  getGray30,
  getGray70,
  getGray90,
  getIncreasingGreen,
  getSequentialColorsArray,
} from "@streamlit/lib/src/theme"
import { ensureError } from "@streamlit/lib/src/util/ErrorHandling"
import { logError } from "@streamlit/lib/src/util/log"

/**
 * This applies general layout changes to things such as x axis,
 * y axis, legends, titles, grid changes, background, etc.
 * @param layout - spec.layout.template.layout
 * @param theme - Theme from useTheme()
 */
export function applyStreamlitThemeTemplateLayout(
  layout: any,
  theme: EmotionTheme
): void {
  const { genericFonts, colors, fontSizes } = theme

  const streamlitTheme = {
    font: {
      color: getGray70(theme),
      family: genericFonts.bodyFont,
      size: fontSizes.twoSmPx,
    },
    title: {
      color: colors.headingColor,
      subtitleColor: colors.bodyText,
      font: {
        family: genericFonts.headingFont,
        size: convertRemToPx(fontSizes.md),
        color: colors.headingColor,
      },
      pad: {
        l: convertRemToPx(theme.spacing.twoXS),
      },
      xanchor: "left",
      x: 0,
    },
    legend: {
      title: {
        font: {
          size: fontSizes.twoSmPx,
          color: getGray70(theme),
        },
        side: "top",
      },
      valign: "top",
      bordercolor: colors.transparent,
      borderwidth: 0,
      font: {
        size: fontSizes.twoSmPx,
        color: getGray90(theme),
      },
    },
    paper_bgcolor: colors.bgColor,
    plot_bgcolor: colors.bgColor,
    yaxis: {
      ticklabelposition: "outside",
      zerolinecolor: getGray30(theme),
      title: {
        font: {
          color: getGray70(theme),
          size: fontSizes.smPx,
        },
        standoff: convertRemToPx(theme.spacing.twoXL),
      },
      tickcolor: getGray30(theme),
      tickfont: {
        color: getGray70(theme),
        size: fontSizes.twoSmPx,
      },
      gridcolor: getGray30(theme),
      minor: {
        gridcolor: getGray30(theme),
      },
      automargin: true,
    },
    xaxis: {
      zerolinecolor: getGray30(theme),
      gridcolor: getGray30(theme),
      showgrid: false,
      tickfont: {
        color: getGray70(theme),
        size: fontSizes.twoSmPx,
      },
      tickcolor: getGray30(theme),
      title: {
        font: {
          color: getGray70(theme),
          size: fontSizes.smPx,
        },
        standoff: convertRemToPx(theme.spacing.xl),
      },
      minor: {
        gridcolor: getGray30(theme),
      },
      zeroline: false,
      automargin: true,
      rangeselector: {
        bgcolor: colors.bgColor,
        bordercolor: getGray30(theme),
        // eslint-disable-next-line streamlit-custom/no-hardcoded-theme-values
        borderwidth: 1,
        x: 0,
      },
    },
    margin: {
      pad: convertRemToPx(theme.spacing.sm),
      r: 0,
      l: 0,
    },
    hoverlabel: {
      bgcolor: colors.bgColor,
      bordercolor: colors.borderColor,
      font: {
        color: getGray70(theme),
        family: genericFonts.bodyFont,
        size: fontSizes.twoSmPx,
      },
    },
    coloraxis: {
      colorbar: {
        thickness: 16,
        xpad: convertRemToPx(theme.spacing.twoXL),
        ticklabelposition: "outside",
        outlinecolor: colors.transparent,
        outlinewidth: 8,
        len: 0.75,
        y: 0.5745,
        title: {
          font: {
            color: getGray70(theme),
            size: fontSizes.smPx,
          },
        },
        tickfont: {
          color: getGray70(theme),
          size: fontSizes.twoSmPx,
        },
      },
    },
    // specifically for the ternary graph
    ternary: {
      gridcolor: getGray70(theme),
      bgcolor: colors.bgColor,
      title: {
        font: {
          family: genericFonts.bodyFont,
          size: fontSizes.smPx,
        },
      },
      color: getGray70(theme),
      aaxis: {
        gridcolor: getGray70(theme),
        linecolor: getGray70(theme),
        tickfont: {
          family: genericFonts.bodyFont,
          size: fontSizes.twoSmPx,
        },
      },
      baxis: {
        linecolor: getGray70(theme),
        gridcolor: getGray70(theme),
        tickfont: {
          family: genericFonts.bodyFont,
          size: fontSizes.twoSmPx,
        },
      },
      caxis: {
        linecolor: getGray70(theme),
        gridcolor: getGray70(theme),
        tickfont: {
          family: genericFonts.bodyFont,
          size: fontSizes.twoSmPx,
        },
      },
    },
  }

  merge(layout, streamlitTheme)
}

/**
 * Replace the colors that we are using from streamlit_plotly_theme.py.
 * This is done so that we change colors based on the background color
 * as the backend has no idea of the background color.
 * @param spec the spec that we want to update
 * @param theme
 * @param elementTheme element.theme
 * @returns the updated spec with the correct theme colors
 */
function replaceCategoricalColors(
  spec: string,
  theme: EmotionTheme,
  elementTheme: string
): string {
  // All the placeholder constants defined here are matching the placeholders in the python implementation.
  const CATEGORY_0 = "#000001"
  const CATEGORY_1 = "#000002"
  const CATEGORY_2 = "#000003"
  const CATEGORY_3 = "#000004"
  const CATEGORY_4 = "#000005"
  const CATEGORY_5 = "#000006"
  const CATEGORY_6 = "#000007"
  const CATEGORY_7 = "#000008"
  const CATEGORY_8 = "#000009"
  const CATEGORY_9 = "#000010"

  if (elementTheme === "streamlit") {
    const categoryColors = getCategoricalColorsArray(theme)
    spec = spec.replaceAll(CATEGORY_0, categoryColors[0])
    spec = spec.replaceAll(CATEGORY_1, categoryColors[1])
    spec = spec.replaceAll(CATEGORY_2, categoryColors[2])
    spec = spec.replaceAll(CATEGORY_3, categoryColors[3])
    spec = spec.replaceAll(CATEGORY_4, categoryColors[4])
    spec = spec.replaceAll(CATEGORY_5, categoryColors[5])
    spec = spec.replaceAll(CATEGORY_6, categoryColors[6])
    spec = spec.replaceAll(CATEGORY_7, categoryColors[7])
    spec = spec.replaceAll(CATEGORY_8, categoryColors[8])
    spec = spec.replaceAll(CATEGORY_9, categoryColors[9])
  } else {
    // Default plotly colors
    spec = spec.replaceAll(CATEGORY_0, "#636efa")
    spec = spec.replaceAll(CATEGORY_1, "#EF553B")
    spec = spec.replaceAll(CATEGORY_2, "#00cc96")
    spec = spec.replaceAll(CATEGORY_3, "#ab63fa")
    spec = spec.replaceAll(CATEGORY_4, "#FFA15A")
    spec = spec.replaceAll(CATEGORY_5, "#19d3f3")
    spec = spec.replaceAll(CATEGORY_6, "#FF6692")
    spec = spec.replaceAll(CATEGORY_7, "#B6E880")
    spec = spec.replaceAll(CATEGORY_8, "#FF97FF")
    spec = spec.replaceAll(CATEGORY_9, "#FECB52")
  }
  return spec
}

function replaceSequentialColors(
  spec: string,
  theme: EmotionTheme,
  elementTheme: string
): string {
  // All the placeholder constants defined here are matching the placeholders in the python implementation.
  const SEQUENTIAL_0 = "#000011"
  const SEQUENTIAL_1 = "#000012"
  const SEQUENTIAL_2 = "#000013"
  const SEQUENTIAL_3 = "#000014"
  const SEQUENTIAL_4 = "#000015"
  const SEQUENTIAL_5 = "#000016"
  const SEQUENTIAL_6 = "#000017"
  const SEQUENTIAL_7 = "#000018"
  const SEQUENTIAL_8 = "#000019"
  const SEQUENTIAL_9 = "#000020"

  if (elementTheme === "streamlit") {
    const sequentialColors = getSequentialColorsArray(theme)
    spec = spec.replaceAll(SEQUENTIAL_0, sequentialColors[0])
    spec = spec.replaceAll(SEQUENTIAL_1, sequentialColors[1])
    spec = spec.replaceAll(SEQUENTIAL_2, sequentialColors[2])
    spec = spec.replaceAll(SEQUENTIAL_3, sequentialColors[3])
    spec = spec.replaceAll(SEQUENTIAL_4, sequentialColors[4])
    spec = spec.replaceAll(SEQUENTIAL_5, sequentialColors[5])
    spec = spec.replaceAll(SEQUENTIAL_6, sequentialColors[6])
    spec = spec.replaceAll(SEQUENTIAL_7, sequentialColors[7])
    spec = spec.replaceAll(SEQUENTIAL_8, sequentialColors[8])
    spec = spec.replaceAll(SEQUENTIAL_9, sequentialColors[9])
  } else {
    // Default plotly colors
    spec = spec.replaceAll(SEQUENTIAL_0, "#0d0887")
    spec = spec.replaceAll(SEQUENTIAL_1, "#46039f")
    spec = spec.replaceAll(SEQUENTIAL_2, "#7201a8")
    spec = spec.replaceAll(SEQUENTIAL_3, "#9c179e")
    spec = spec.replaceAll(SEQUENTIAL_4, "#bd3786")
    spec = spec.replaceAll(SEQUENTIAL_5, "#d8576b")
    spec = spec.replaceAll(SEQUENTIAL_6, "#ed7953")
    spec = spec.replaceAll(SEQUENTIAL_7, "#fb9f3a")
    spec = spec.replaceAll(SEQUENTIAL_8, "#fdca26")
    spec = spec.replaceAll(SEQUENTIAL_9, "#f0f921")
  }
  return spec
}

function replaceDivergingColors(
  spec: string,
  theme: EmotionTheme,
  elementTheme: string
): string {
  // All the placeholder constants defined here are matching the placeholders in the python implementation.
  const DIVERGING_0 = "#000021"
  const DIVERGING_1 = "#000022"
  const DIVERGING_2 = "#000023"
  const DIVERGING_3 = "#000024"
  const DIVERGING_4 = "#000025"
  const DIVERGING_5 = "#000026"
  const DIVERGING_6 = "#000027"
  const DIVERGING_7 = "#000028"
  const DIVERGING_8 = "#000029"
  const DIVERGING_9 = "#000030"
  const DIVERGING_10 = "#000031"

  if (elementTheme === "streamlit") {
    const divergingColors = getDivergingColorsArray(theme)
    spec = spec.replaceAll(DIVERGING_0, divergingColors[0])
    spec = spec.replaceAll(DIVERGING_1, divergingColors[1])
    spec = spec.replaceAll(DIVERGING_2, divergingColors[2])
    spec = spec.replaceAll(DIVERGING_3, divergingColors[3])
    spec = spec.replaceAll(DIVERGING_4, divergingColors[4])
    spec = spec.replaceAll(DIVERGING_5, divergingColors[5])
    spec = spec.replaceAll(DIVERGING_6, divergingColors[6])
    spec = spec.replaceAll(DIVERGING_7, divergingColors[7])
    spec = spec.replaceAll(DIVERGING_8, divergingColors[8])
    spec = spec.replaceAll(DIVERGING_9, divergingColors[9])
    spec = spec.replaceAll(DIVERGING_10, divergingColors[10])
  } else {
    // Default plotly colors
    spec = spec.replaceAll(DIVERGING_0, "#8e0152")
    spec = spec.replaceAll(DIVERGING_1, "#c51b7d")
    spec = spec.replaceAll(DIVERGING_2, "#de77ae")
    spec = spec.replaceAll(DIVERGING_3, "#f1b6da")
    spec = spec.replaceAll(DIVERGING_4, "#fde0ef")
    spec = spec.replaceAll(DIVERGING_5, "#f7f7f7")
    spec = spec.replaceAll(DIVERGING_6, "#e6f5d0")
    spec = spec.replaceAll(DIVERGING_7, "#b8e186")
    spec = spec.replaceAll(DIVERGING_8, "#7fbc41")
    spec = spec.replaceAll(DIVERGING_9, "#4d9221")
    spec = spec.replaceAll(DIVERGING_10, "#276419")
  }
  return spec
}

/**
 * Because Template.layout doesn't affect the go(plotly.graph_objects) graphs,
 * we use this method to specifically replace these graph properties.
 * */
function replaceGOSpecificColors(spec: string, theme: EmotionTheme): string {
  // All the placeholder constants defined here are matching the placeholders in the python implementation.
  const INCREASING = "#000032"
  const DECREASING = "#000033"
  const TOTAL = "#000034"

  const GRAY_30 = "#000035"
  const GRAY_70 = "#000036"
  const GRAY_90 = "#000037"
  const BG_COLOR = "#000038"
  const FADED_TEXT_05 = "#000039"
  const BG_MIX = "#000040"

  spec = spec.replaceAll(INCREASING, getIncreasingGreen(theme))
  spec = spec.replaceAll(DECREASING, getDecreasingRed(theme))
  spec = spec.replaceAll(TOTAL, getBlue80(theme))

  spec = spec.replaceAll(GRAY_30, getGray30(theme))
  spec = spec.replaceAll(GRAY_70, getGray70(theme))
  spec = spec.replaceAll(GRAY_90, getGray90(theme))

  spec = spec.replaceAll(BG_COLOR, theme.colors.bgColor)
  spec = spec.replaceAll(FADED_TEXT_05, theme.colors.fadedText05)
  spec = spec.replaceAll(BG_MIX, theme.colors.bgMix)
  return spec
}

export function replaceTemporaryColors(
  spec: string,
  theme: EmotionTheme,
  elementTheme: string
): string {
  spec = replaceGOSpecificColors(spec, theme)
  spec = replaceCategoricalColors(spec, theme, elementTheme)
  spec = replaceSequentialColors(spec, theme, elementTheme)
  spec = replaceDivergingColors(spec, theme, elementTheme)
  return spec
}

/**
 * Applies the Streamlit theme by overriding properties in
 * spec.data, spec.layout.template.data, and spec.layout.template.layout
 * @param spec - spec
 */
export function applyStreamlitTheme(spec: any, theme: EmotionTheme): void {
  try {
    applyStreamlitThemeTemplateLayout(spec.layout.template.layout, theme)
  } catch (e) {
    const err = ensureError(e)
    logError(err)
  }
  if ("title" in spec.layout) {
    spec.layout.title = merge(spec.layout.title, {
      text: `<b>${spec.layout.title.text}</b>`,
    })
  }
}

/**
 * Apply minimum changes to graph to fit streamlit
 * @param layout - spec.layout
 * @param theme - theme from useTheme()
 * @returns modified spec.layout
 */
export function layoutWithThemeDefaults(
  layout: any,
  theme: EmotionTheme
): any {
  const { colors, genericFonts } = theme

  const themeDefaults = {
    font: {
      color: colors.bodyText,
      family: genericFonts.bodyFont,
    },
    paper_bgcolor: colors.bgColor,
    plot_bgcolor: colors.secondaryBg,
  }

  // Fill in theme defaults where the user didn't specify layout options.
  return {
    ...layout,
    font: {
      ...themeDefaults.font,
      ...layout.font,
    },
    paper_bgcolor: layout.paper_bgcolor || themeDefaults.paper_bgcolor,
    plot_bgcolor: layout.plot_bgcolor || themeDefaults.plot_bgcolor,
  }
}
