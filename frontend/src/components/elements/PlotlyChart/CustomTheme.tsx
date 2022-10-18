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

import { merge, assign } from "lodash"

import { useTheme } from "@emotion/react"

import { hasLightBackgroundColor, Theme } from "src/theme"

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

export function getGray70(theme: Theme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.gray70
    : theme.colors.gray30
}

export function getGray30(theme: Theme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.gray30
    : theme.colors.gray85
}

export function getGray90(theme: Theme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.gray90
    : theme.colors.gray10
}

export function getDecreasingRed(theme: Theme): string {
  return hasLightBackgroundColor(theme) ? "#FF2B2B" : "#FFABAB"
}

export function getIncreasingGreen(theme: Theme): string {
  return hasLightBackgroundColor(theme) ? "#29B09D" : "#7DEFA1"
}

export function changeDiscreteColors(data: any): void {
  const theme: Theme = useTheme()
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
  legendGroupToIndexes.forEach((value: number[]) => {
    value.forEach((index: number) => {
      if (data[index].line !== undefined) {
        // dont assign colors for dist plot boxes when they're transparent
        if (
          data[index].type === "box" &&
          data[index].line.color !== "rgba(255,255,255,0)" &&
          data[index].line.color !== "transparent"
        ) {
          data[index].line = assign(data[index].line, {
            color: categoryColors[colorIndex % categoryColors.length],
          })
        }
      } else if (
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

export function applyColorscale(data: any): any {
  const theme = useTheme()
  data.forEach((entry: any) => {
    entry = assign(entry, {
      colorscale: hasLightBackgroundColor(theme)
        ? sequentialColorscaleLightTheme
        : sequentialColorscaleDarkTheme,
    })
  })
  return data
}

export function applyUniqueGraphColorsData(data: any): void {
  const theme = useTheme()
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
              color: hasLightBackgroundColor(theme) ? "#0068C9" : "#83C9FF",
            },
          },
        })
      }
    }
    if (entry.marker !== undefined) {
      entry.marker.line = assign(entry.marker.line, {
        width: 0,
        color: colors.transparent,
      })
    }
  })
}

export function applyStreamlitThemeTemplateLayout(
  layout: any,
  theme: Theme
): void {
  // This theming config contains multiple hard coded spacing values.
  // The reason is that we currently only have rem values in our spacing
  // definitions and vega lite requires numerical (pixel) values.
  const { genericFonts, colors, fontSizes } = theme

  const streamlitTheme = {
    // hide all text that is less than 8 px
    uniformtext: {
      minsize: 8,
      mode: "hide",
    },
    background: colors.bgColor,
    header: {
      labelColor: colors.bodyText,
    },
    view: {
      continuousHeight: 350,
      continuousWidth: 400,
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
        family: genericFonts.bodyFont,
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
              sequentialminus: sequentialColorscaleDarkTheme,
            }
          : {
              diverging: divergingColorscaleDarkTheme,
              sequential: sequentialColorscaleDarkTheme,
              sequentialminus: sequentialColorscaleLightTheme,
            }),
      },
    },
    colorscale: {
      // TODO: Eventually, we might want to move those color schemes to our theme.
      // But For now, this is specifically defined for plotly based charts.
      ...(hasLightBackgroundColor(theme)
        ? {
            diverging: divergingColorscaleLightTheme,
            sequential: sequentialColorscaleLightTheme,
            sequentialminus: sequentialColorscaleDarkTheme,
          }
        : {
            diverging: divergingColorscaleDarkTheme,
            sequential: sequentialColorscaleDarkTheme,
            sequentialminus: sequentialColorscaleLightTheme,
          }),
    },
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

  assign(layout, streamlitTheme)
}

export function applyStreamlitThemeData(data: any): void {
  const { colors } = useTheme()
  applyColorscale(data)
  applyUniqueGraphColorsData(data)
  changeDiscreteColors(data)
  data.forEach((entry: any) => {
    if (entry.marker !== undefined) {
      entry.marker.line = assign(entry.marker.line, {
        width: 0,
        color: colors.transparent,
      })
    }
  })
}

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

export function applyStreamlitTheme(spec: any): void {
  const theme: Theme = useTheme()
  applyStreamlitThemeTemplateLayout(spec.layout.template.layout, theme)
  applyStreamlitThemeTemplateData(spec.layout.template.data, theme)
  applyStreamlitThemeData(spec.data)
  if ("title" in spec.layout) {
    spec.layout.title = assign({
      text: `<b>${spec.layout.title.text}</b>`,
    })
  }
}

export function applyThemeDefaults(config: any, theme: Theme): any {
  const { colors, fontSizes, genericFonts } = theme
  const themeFonts = {
    labelFont: genericFonts.bodyFont,
    titleFont: genericFonts.bodyFont,
    labelFontSize: fontSizes.twoSmPx,
    titleFontSize: fontSizes.twoSmPx,
  }
  const themeDefaults = {
    background: colors.bgColor,
    axis: {
      labelColor: colors.bodyText,
      titleColor: colors.bodyText,
      gridColor: colors.fadedText10,
      ...themeFonts,
    },
    legend: {
      labelColor: colors.bodyText,
      titleColor: colors.bodyText,
      ...themeFonts,
    },
    title: {
      color: colors.bodyText,
      subtitleColor: colors.bodyText,
      ...themeFonts,
    },
    header: {
      labelColor: colors.bodyText,
    },
    view: {
      continuousHeight: 350,
      continuousWidth: 400,
    },
  }

  if (!config) {
    return themeDefaults
  }

  // Fill in theme defaults where the user didn't specify config options.
  return merge({}, themeDefaults, config || {})
}
