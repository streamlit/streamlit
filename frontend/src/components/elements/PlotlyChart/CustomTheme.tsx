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

import { assign } from "lodash"

import { hasLightBackgroundColor, Theme } from "src/theme"
import { ensureError } from "src/lib/ErrorHandling"
import { logError } from "src/lib/log"

// TODO: for these colors below, these likely need to move to our theme!
// For the meantime, these colors will be defined for plotly.

const divergingColorscaleLightTheme = [
  [0.1, "#004280"],
  [0.2, "#0054A3"],
  [0.3, "#1C83E1"],
  [0.4, "#60B4FF"],
  [0.5, "#A6DCFF"],
  [0.6, "#FFC7C7"],
  [0.7, "#FF8C8C"],
  [0.8, "#FF4B4B"],
  [0.9, "#BD4043"],
  [1.0, "#7D353B"],
]

const divergingColorscaleDarkTheme = [
  [0, "#A6DCFF"],
  [0.1, "#A6DCFF"],
  [0.2, "#60B4FF"],
  [0.3, "#1C83E1"],
  [0.4, "#0054A3"],
  [0.5, "#004280"],
  [0.6, "#7D353B"],
  [0.7, "#BD4043"],
  [0.8, "#FF4B4B"],
  [0.9, "#FF8C8C"],
  [1.0, "#FFC7C7"],
]

const sequentialColorscaleLightTheme = [
  [0, "#E4F5FF"],
  [0.1111111111111111, "#C7EBFF"],
  [0.2222222222222222, "#A6DCFF"],
  [0.3333333333333333, "#83C9FF"],
  [0.4444444444444444, "#60B4FF"],
  [0.5555555555555556, "#3D9DF3"],
  [0.6666666666666666, "#1C83E1"],
  [0.7777777777777778, "#0068C9"],
  [0.8888888888888888, "#0054A3"],
  [1, "#004280"],
]

const sequentialColorscaleDarkTheme = [
  [0, "#004280"],
  [0.1111111111111111, "#0054A3"],
  [0.2222222222222222, "#0068C9"],
  [0.3333333333333333, "#1C83E1"],
  [0.4444444444444444, "#3D9DF3"],
  [0.5555555555555556, "#60B4FF"],
  [0.6666666666666666, "#83C9FF"],
  [0.7777777777777778, "#A6DCFF"],
  [0.8888888888888888, "#C7EBFF"],
  [1, "#E4F5FF"],
]

const categoryColorsLightTheme = [
  "#0068C9",
  "#83C9FF",
  "#FF2B2B",
  "#FFABAB",
  "#29B09D",
  "#7DEFA1",
  "#FF8700",
  "#FFD16A",
  "#6D3FC0",
  "#D5DAE5",
]

const categoryColorsDarkTheme = [
  "#83C9FF",
  "#0068C9",
  "#FFABAB",
  "#FF2B2B",
  "#7DEFA1",
  "#29B09D",
  "#FFD16A",
  "#FF8700",
  "#6D3FC0",
  "#D5DAE5",
]

function getGray70(theme: Theme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.gray70
    : theme.colors.gray30
}

function getGray30(theme: Theme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.gray30
    : theme.colors.gray85
}

function getGray90(theme: Theme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.gray90
    : theme.colors.gray10
}

function getDecreasingRed(theme: Theme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.red80
    : theme.colors.red40
}

function getIncreasingGreen(theme: Theme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.blueGreen80
    : theme.colors.green40
}

/**
 * This applies categorical colors (discrete or labeled data) to
 * graphs by mapping legend groups to marker colors and customdata to marker colors.
 * This is done because colorway is not fully respected by plotly.
 * @param data - spec.data
 */
function applyDiscreteColors(data: any, theme: Theme): void {
  const categoryColors = hasLightBackgroundColor(theme)
    ? categoryColorsLightTheme
    : categoryColorsDarkTheme

  const legendGroupToIndexes = new Map<string, number[]>()
  const customDataToDataIdx = new Map<string, number[]>()
  const graphIdxToCustomData = new Map<number, Map<string, number[]>>()
  data.forEach((graph: any, graphIndex: number) => {
    if (
      graph.customdata !== undefined &&
      graph.marker !== undefined &&
      Array.isArray(graph.marker.colors) &&
      graph.marker.colors.length > 0 &&
      typeof graph.marker.colors[0] !== "number"
    ) {
      graph.customdata.forEach((data: any, dataIndex: any) => {
        const dataString = data.toString()
        if (Array.isArray(data) && data.length > 0) {
          if (customDataToDataIdx.has(dataString)) {
            customDataToDataIdx.set(
              dataString,
              // @ts-ignore
              customDataToDataIdx.get(dataString)?.concat(dataIndex)
            )
          } else {
            customDataToDataIdx.set(dataString, [dataIndex])
          }
        }
      })
      graphIdxToCustomData.set(graphIndex, customDataToDataIdx)
    }
    if (graph.legendgroup !== undefined) {
      if (legendGroupToIndexes.has(graph.legendgroup)) {
        legendGroupToIndexes.set(
          graph.legendgroup,
          // @ts-ignore
          legendGroupToIndexes.get(graph.legendgroup).concat(graphIndex)
        )
      } else {
        legendGroupToIndexes.set(graph.legendgroup, [graphIndex])
      }
    }
  })

  let colorIndex = 0
  legendGroupToIndexes.forEach((dataIdx: number[]) => {
    dataIdx.forEach((index: number) => {
      if (data[index].line !== undefined) {
        // dont assign colors for dist plot boxes when they're transparent
        if (
          data[index].type !== "box" &&
          data[index].line.color !== "rgba(255,255,255,0)" &&
          data[index].line.color !== "transparent"
        ) {
          data[index].line = assign(data[index].line, {
            color: categoryColors[colorIndex % categoryColors.length],
          })
        }
      }
      if (
        data[index].marker !== undefined &&
        typeof data[index].marker.color === "string"
      ) {
        data[index].marker = assign(data[index].marker, {
          color: categoryColors[colorIndex % categoryColors.length],
        })
      }
    })
    colorIndex++
  })

  colorIndex = 0
  graphIdxToCustomData.forEach(
    (customData: Map<string, number[]>, dataIndex: number) => {
      customData.forEach(markerIndexes => {
        markerIndexes.forEach(markerIndex => {
          data[dataIndex].marker.colors[markerIndex] =
            categoryColors[colorIndex % categoryColors.length]
        })
        colorIndex++
      })
    }
  )
}

/**
 * This overrides the colorscale (continuous colorscale) to all graphs.
 * @param data - spec.data
 */
export function applyColorscale(data: any, theme: Theme): any {
  data.forEach((entry: any) => {
    entry = assign(entry, {
      colorscale: hasLightBackgroundColor(theme)
        ? sequentialColorscaleLightTheme
        : sequentialColorscaleDarkTheme,
    })
  })
  return data
}

/**
 * This applies colors specifically for the table, candlestick, and waterfall plot
 * because their dictionary structure is different from other more regular charts.
 * @param data - spec.data
 */
export function applyUniqueGraphColorsData(data: any, theme: Theme): void {
  const { colors, genericFonts } = theme
  data.forEach((entry: any) => {
    // entry.type is always defined
    if (entry.type === "table") {
      entry.header = assign(entry.header, {
        font: {
          color: getGray70(theme),
          family: genericFonts.bodyFont,
        },
        line: { color: colors.fadedText05, width: 1 },
        fill: {
          color: colors.bgMix,
        },
      })
      entry.cells = assign(entry.cells, {
        font: {
          color: getGray90(theme),
          family: genericFonts.bodyFont,
        },
        line: { color: colors.fadedText05, width: 1 },
        fill: {
          color: colors.bgColor,
        },
      })
    } else if (entry.type === "candlestick") {
      if (entry.decreasing === undefined) {
        entry = assign(entry, {
          decreasing: {
            line: {
              color: getDecreasingRed(theme),
            },
          },
        })
        entry = assign(entry, {
          increasing: {
            line: {
              color: getIncreasingGreen(theme),
            },
          },
        })
      }
    } else if (entry.type === "waterfall") {
      entry = assign(entry, {
        connector: {
          line: {
            color: getGray30(theme),
            width: 2,
          },
        },
      })
      if (entry.decreasing === undefined) {
        entry = assign(entry, {
          decreasing: {
            marker: {
              color: getDecreasingRed(theme),
            },
          },
          increasing: {
            marker: {
              color: getIncreasingGreen(theme),
            },
          },
          totals: {
            marker: {
              color: hasLightBackgroundColor(theme)
                ? theme.colors.green40
                : theme.colors.blue40,
            },
          },
        })
      }
    }
  })
}

/**
 * This applies general layout changes to things such as x axis,
 * y axis, legends, titles, grid changes, background, etc.
 * @param layout - spec.layout.template.layout
 * @param theme - Theme from useTheme()
 */
export function applyStreamlitThemeTemplateLayout(
  layout: any,
  theme: Theme
): void {
  const { genericFonts, colors, fontSizes } = theme

  const streamlitTheme = {
    uniformtext: {
      // hide all text that is less than 6 px
      minsize: 6,
      mode: "hide",
    },
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
        size: fontSizes.mdPx,
        color: colors.headingColor,
      },
      pad: {
        l: 4,
      },
      xanchor: "left",
      x: 0,
    },
    colorway: hasLightBackgroundColor(theme)
      ? categoryColorsLightTheme
      : categoryColorsDarkTheme,
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
    colorDiscreteSequence: hasLightBackgroundColor(theme)
      ? categoryColorsLightTheme
      : categoryColorsDarkTheme,
    yaxis: {
      ticklabelposition: "outside",
      zerolinecolor: getGray30(theme),
      title: {
        font: {
          color: getGray70(theme),
          size: fontSizes.smPx,
        },
        standoff: 24,
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
        standoff: 12,
      },
      minor: {
        gridcolor: getGray30(theme),
      },
      zeroline: false,
      automargin: true,
    },
    margin: {
      pad: 16,
      r: 0,
      l: 0,
    },
    hoverlabel: {
      bgcolor: colors.bgColor,
      bordercolor: colors.fadedText10,
      font: {
        color: getGray70(theme),
        family: genericFonts.bodyFont,
        size: fontSizes.twoSmPx,
      },
    },
    coloraxis: {
      colorbar: {
        thickness: 16,
        xpad: 24,
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
      colorscale: {
        ...(hasLightBackgroundColor(theme)
          ? {
              diverging: divergingColorscaleLightTheme,
              sequential: sequentialColorscaleLightTheme,
              // reverse to dark for sequential minus
              sequentialminus: sequentialColorscaleDarkTheme,
            }
          : {
              diverging: divergingColorscaleDarkTheme,
              sequential: sequentialColorscaleDarkTheme,
              // reverse to light for sequential minus
              sequentialminus: sequentialColorscaleLightTheme,
            }),
      },
    },
    colorscale: {
      ...(hasLightBackgroundColor(theme)
        ? {
            diverging: divergingColorscaleLightTheme,
            sequential: sequentialColorscaleLightTheme,
            // reverse to dark for sequential minus
            sequentialminus: sequentialColorscaleDarkTheme,
          }
        : {
            diverging: divergingColorscaleDarkTheme,
            sequential: sequentialColorscaleDarkTheme,
            // reverse to light for sequential minus
            sequentialminus: sequentialColorscaleLightTheme,
          }),
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

  // cant use merge. use assign because plotly already has properties defined.
  assign(layout, streamlitTheme)
}

/**
 * Applies the colorscale, colors for unique graphs, and discrete coloring
 * for in general through assigning properties in spec.data
 * @param data - spec.data
 */
export function applyStreamlitThemeData(data: any, theme: Theme): void {
  applyColorscale(data, theme)
  applyUniqueGraphColorsData(data, theme)
  applyDiscreteColors(data, theme)
  data.forEach((entry: any) => {
    if (entry.marker !== undefined) {
      entry.marker.line = assign(entry.marker.line, {
        width: 0,
        color: theme.colors.transparent,
      })
    }
  })
}

/**
 * This applies specific changes for spec.layout.template.data because
 * spec.data does not fully catch these and neither does spec.layout.template.layout
 * @param data - spec.layout.template.data
 * @param theme - Theme from useTheme()
 */
export function applyStreamlitThemeTemplateData(
  data: any,
  theme: Theme
): void {
  if (data !== undefined) {
    data.bar.forEach((entry: any) => {
      if (entry.marker !== undefined && entry.marker.line !== undefined) {
        entry.marker.line = assign(entry.marker.line, {
          color: getGray30(theme),
        })
      }
    })
    const graphs = Object.values(data)
    graphs.forEach((graph: any) => {
      if (graph.colorbar !== undefined && graph.colorbar.ticks === "") {
        // make tick values show
        delete graph.colorbar.ticks
      }
    })
  }
}

/**
 * Applies the Streamlit theme by overriding properties in
 * spec.data, spec.layout.template.data, and spec.layout.template.layout
 * @param spec - spec
 */
export function applyStreamlitTheme(spec: any, theme: Theme): void {
  try {
    applyStreamlitThemeTemplateLayout(spec.layout.template.layout, theme)
    applyStreamlitThemeTemplateData(spec.layout.template.data, theme)
    applyStreamlitThemeData(spec.data, theme)
  } catch (e) {
    const err = ensureError(e)
    logError(err)
  }
  if ("title" in spec.layout) {
    spec.layout.title = { text: `<b>${spec.layout.title.text}</b>` }
  }
}

/**
 * Apply minimum changes to graph to fit streamlit
 * @param layout - spec.layout
 * @param theme - theme from useTheme()
 * @returns modified spec.layout
 */
export function layoutWithThemeDefaults(layout: any, theme: Theme): any {
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
