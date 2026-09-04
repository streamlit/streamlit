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

import { merge } from "lodash-es"
import { getLogger } from "loglevel"

import {
  getBlue80,
  getDecreasingRed,
  getGray30,
  getGray70,
  getGray90,
  getIncreasingGreen,
} from "~lib/theme/getColors"
import type { EmotionTheme } from "~lib/theme/types"
import { convertRemToPx } from "~lib/theme/utils"
import { ensureError } from "~lib/util/ErrorHandling"
import { notNullOrUndefined } from "~lib/util/utils"

const LOG = getLogger("PlotlyChart:CustomTheme")

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Plotly accepts `layout.title` as a string or `{ text, ... }`. */
function plotlyTitleObject(title: unknown): Record<string, unknown> {
  if (typeof title === "string") {
    return { text: title }
  }
  if (isRecord(title)) {
    return title
  }
  return {}
}

/**
 * This applies general layout changes to things such as x axis,
 * y axis, legends, titles, grid changes, background, etc.
 * @param layout - spec.layout.template.layout
 * @param theme - Theme from useEmotionTheme()
 */
export function applyStreamlitThemeTemplateLayout(
  layout: Record<string, unknown>,
  theme: EmotionTheme
): void {
  const { genericFonts, colors, fontSizes } = theme

  const streamlitTheme = {
    font: {
      color: getGray70(theme),
      family: genericFonts.bodyFont,
      size: convertRemToPx(fontSizes.twoSm),
      weight: theme.fontWeights.normal,
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
          size: convertRemToPx(fontSizes.twoSm),
          color: getGray70(theme),
        },
        side: "top",
      },
      valign: "top",
      bordercolor: colors.transparent,
      borderwidth: 0,
      font: {
        size: convertRemToPx(fontSizes.twoSm),
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
          size: convertRemToPx(fontSizes.sm),
        },
        standoff: convertRemToPx(theme.spacing.twoXL),
      },
      tickcolor: getGray30(theme),
      tickfont: {
        color: getGray70(theme),
        size: convertRemToPx(fontSizes.twoSm),
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
        size: convertRemToPx(fontSizes.twoSm),
      },
      tickcolor: getGray30(theme),
      title: {
        font: {
          color: getGray70(theme),
          size: convertRemToPx(fontSizes.sm),
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
        size: convertRemToPx(fontSizes.twoSm),
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
            size: convertRemToPx(fontSizes.sm),
          },
        },
        tickfont: {
          color: getGray70(theme),
          size: convertRemToPx(fontSizes.twoSm),
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
          size: convertRemToPx(fontSizes.sm),
        },
      },
      color: getGray70(theme),
      aaxis: {
        gridcolor: getGray70(theme),
        linecolor: getGray70(theme),
        tickfont: {
          family: genericFonts.bodyFont,
          size: convertRemToPx(fontSizes.twoSm),
        },
      },
      baxis: {
        linecolor: getGray70(theme),
        gridcolor: getGray70(theme),
        tickfont: {
          family: genericFonts.bodyFont,
          size: convertRemToPx(fontSizes.twoSm),
        },
      },
      caxis: {
        linecolor: getGray70(theme),
        gridcolor: getGray70(theme),
        tickfont: {
          family: genericFonts.bodyFont,
          size: convertRemToPx(fontSizes.twoSm),
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
    const categoryColors = theme.colors.chartCategoricalColors
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
    const sequentialColors = theme.colors.chartSequentialColors
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

  if (elementTheme === "streamlit") {
    const divergingColors = theme.colors.chartDivergingColors
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
  } else {
    // Default plotly colors (PiYG scale)
    spec = spec.replaceAll(DIVERGING_0, "#8e0152")
    spec = spec.replaceAll(DIVERGING_1, "#c51b7d")
    spec = spec.replaceAll(DIVERGING_2, "#de77ae")
    spec = spec.replaceAll(DIVERGING_3, "#f1b6da")
    spec = spec.replaceAll(DIVERGING_4, "#fde0ef")
    spec = spec.replaceAll(DIVERGING_5, "#e6f5d0")
    spec = spec.replaceAll(DIVERGING_6, "#b8e186")
    spec = spec.replaceAll(DIVERGING_7, "#7fbc41")
    spec = spec.replaceAll(DIVERGING_8, "#4d9221")
    spec = spec.replaceAll(DIVERGING_9, "#276419")
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
export function applyStreamlitTheme(
  spec: Record<string, unknown>,
  theme: EmotionTheme
): void {
  if (!isRecord(spec.layout)) {
    spec.layout = {}
  }
  const layout = spec.layout

  // Figures sent as raw JSON (or without Python's streamlit template) have no
  // `layout.template`. Still apply Streamlit colors so `theme="streamlit"`
  // does not fall through to plotly.js's light defaults.
  if (!isRecord(layout.template)) {
    layout.template = {}
  }
  const template = layout.template
  if (!isRecord(template.layout)) {
    template.layout = {}
  }

  try {
    applyStreamlitThemeTemplateLayout(template.layout, theme)
    // Ensure user-provided `layout.font` overrides Streamlit's trace-level
    // `textfont` defaults (e.g. Sankey, icicle); otherwise those template
    // defaults shadow user settings.
    // See https://github.com/streamlit/streamlit/issues/11031.
    respectUserFontOnTemplateTraces(spec, theme)
  } catch (e) {
    LOG.error(ensureError(e))
  }

  if ("title" in layout && notNullOrUndefined(layout.title)) {
    const title = plotlyTitleObject(layout.title)
    const titleText = typeof title.text === "string" ? title.text : ""
    layout.title = merge({}, title, {
      text: `<b>${titleText}</b>`,
    })
  }
}

/**
 * Trace-level `textfont.color` values injected by the Streamlit Plotly theme.
 * These shadow the user's `layout.font.color` and are scrubbed only when their
 * current value matches the Streamlit-injected default — so a user-owned
 * custom template that sets a different `textfont.color` on the same trace
 * type is preserved. Keep in sync with the `textfont=` entries in
 * `lib/streamlit/elements/lib/streamlit_plotly_theme.py`. Trace types not in
 * this map are treated as user-owned. `family` is not injected by the
 * Streamlit theme on any trace type, so `layout.font.family` inherits via
 * Plotly's normal cascade with no frontend intervention.
 */
function getStreamlitInjectedTextfontColors(
  theme: EmotionTheme
): ReadonlyMap<string, string> {
  return new Map([
    ["icicle", "white"],
    ["sankey", getGray70(theme)],
  ])
}

/**
 * Drops `textfont.color` from Streamlit-owned template traces when the user
 * provided `layout.font.color`. Plotly prefers template `textfont` over
 * `layout.font`, so removing Streamlit's trace-level defaults (e.g. Sankey
 * `textfont.color`) lets the user's layout font be inherited. User-owned
 * custom traces — including custom `sankey`/`icicle` templates whose
 * `textfont.color` does not match the Streamlit-injected value — are left
 * untouched.
 */
function respectUserFontOnTemplateTraces(
  spec: Record<string, unknown>,
  theme: EmotionTheme
): void {
  const layout = spec.layout as Record<string, unknown> | undefined
  const userFont = layout?.font as Record<string, unknown> | undefined
  if (userFont?.color === undefined) {
    return
  }
  const template = layout?.template as Record<string, unknown> | undefined
  const templateData = template?.data as Record<string, unknown[]> | undefined
  if (!templateData) {
    return
  }
  const injectedColors = getStreamlitInjectedTextfontColors(theme)
  for (const [traceType, traces] of Object.entries(templateData)) {
    const injectedColor = injectedColors.get(traceType)
    if (injectedColor === undefined || !Array.isArray(traces)) {
      continue
    }
    for (const trace of traces) {
      const textfont = (trace as Record<string, unknown>)?.textfont as
        | Record<string, unknown>
        | undefined
      if (textfont?.color === injectedColor) {
        delete textfont.color
      }
    }
  }
}

/**
 * Apply minimum changes to graph to fit streamlit
 * @param layout - spec.layout
 * @param theme - theme from useEmotionTheme()
 * @returns modified spec.layout
 */
export function layoutWithThemeDefaults(
  layout: Record<string, unknown>,
  theme: EmotionTheme
): Record<string, unknown> {
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
      ...(layout.font as Record<string, unknown> | undefined),
    },
    paper_bgcolor: layout.paper_bgcolor || themeDefaults.paper_bgcolor,
    plot_bgcolor: layout.plot_bgcolor || themeDefaults.plot_bgcolor,
  }
}
