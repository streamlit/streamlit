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

import { merge, mergeWith, isArray } from "lodash"

import { hasLightBackgroundColor, Theme } from "src/theme"

export function applyStreamlitTheme(config: any, theme: Theme): any {
  // This theming config contains multiple hard coded spacing values.
  // The reason is that we currently only have rem values in our spacing
  // definitions and vega lite requires numerical (pixel) values.

  const streamlitTheme = {
    font: theme.genericFonts.bodyFont,
    background: theme.colors.bgColor,
    fieldTitle: "verbal",
    autosize: { type: "fit", contains: "padding" },
    title: {
      align: "left",
      anchor: "start",
      color: theme.colors.headingColor,
      titleFontStyle: "normal",
      fontWeight: theme.fontWeights.bold,
      fontSize: theme.fontSizes.smPx + 2,
      orient: "top",
      offset: 26,
    },
    axis: {
      labelFontSize: theme.fontSizes.twoSmPx,
      labelFontWeight: theme.fontWeights.normal,
      labelColor: theme.colors.fadedText60,
      labelFontStyle: "normal",
      titleFontWeight: theme.fontWeights.normal,
      titleFontSize: theme.fontSizes.smPx,
      titleColor: theme.colors.fadedText60,
      titleFontStyle: "normal",
      ticks: false,
      gridColor: theme.colors.fadedText05,
      domain: false,
      domainWidth: 1,
      domainColor: theme.colors.fadedText05,
      labelFlush: true,
      labelFlushOffset: 1,
      labelBound: false,
      labelLimit: 100,
      titlePadding: 16,
      labelPadding: 16,
      labelSeparation: 4,
      labelOverlap: true,
    },
    legend: {
      labelFontSize: theme.fontSizes.smPx,
      labelFontWeight: theme.fontWeights.normal,
      labelColor: theme.colors.bodyText,
      titleFontSize: theme.fontSizes.smPx,
      titleFontWeight: theme.fontWeights.normal,
      titleFontStyle: "normal",
      titleColor: theme.colors.fadedText60,
      titlePadding: 12,
      labelPadding: 16,
      columnPadding: 8,
      rowPadding: 4,
      padding: -1,
      symbolStrokeWidth: 4,
    },
    range: {
      // TODO: Eventually, we might want to move those color schemes to our theme.
      // But For now, this is specifically defined for vega lite based charts.
      // Ramp & heatmap are both using the sequential color scheme.
      ...(hasLightBackgroundColor(theme)
        ? {
            category: [
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
            ],
            diverging: [
              "#004280",
              "#0054A3",
              "#1C83E1",
              "#60B4FF",
              "#A6DCFF",
              "#FFC7C7",
              "#FF8C8C",
              "#FF4B4B",
              "#BD4043",
              "#7D353B",
            ],
            ramp: [
              "#E4F5FF",
              "#C7EBFF",
              "#A6DCFF",
              "#83C9FF",
              "#60B4FF",
              "#3D9DF3",
              "#1C83E1",
              "#0068C9",
              "#0054A3",
              "#004280",
            ],
            heatmap: [
              "#E4F5FF",
              "#C7EBFF",
              "#A6DCFF",
              "#83C9FF",
              "#60B4FF",
              "#3D9DF3",
              "#1C83E1",
              "#0068C9",
              "#0054A3",
              "#004280",
            ],
          }
        : {
            category: [
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
            ],
            diverging: [
              "#A6DCFF",
              "#60B4FF",
              "#1C83E1",
              "#0054A3",
              "#004280",
              "#7D353B",
              "#BD4043",
              "#FF4B4B",
              "#FF8C8C",
              "#FFC7C7",
            ],
            ramp: [
              "#004280",
              "#0054A3",
              "#0068C9",
              "#1C83E1",
              "#3D9DF3",
              "#60B4FF",
              "#83C9FF",
              "#A6DCFF",
              "#C7EBFF",
              "#E4F5FF",
            ],
            heatmap: [
              "#004280",
              "#0054A3",
              "#0068C9",
              "#1C83E1",
              "#3D9DF3",
              "#60B4FF",
              "#83C9FF",
              "#A6DCFF",
              "#C7EBFF",
              "#E4F5FF",
            ],
          }),
    },
    view: {
      columns: 1,
      strokeWidth: 0,
      stroke: "transparent",
      continuousHeight: 350,
      continuousWidth: 400,
    },
    concat: {
      columns: 1,
    },
    facet: {
      columns: 1,
    },
    mark: {
      tooltip: true,
      ...(hasLightBackgroundColor(theme)
        ? { color: "#0068C9" }
        : { color: "#83C9FF" }),
    },
    bar: {
      binSpacing: 4,
      discreteBandSize: { band: 0.85 },
    },
    axisDiscrete: {
      grid: false,
    },
    axisXPoint: {
      grid: false,
    },
    axisTemporal: {
      grid: false,
    },
    axisXBand: {
      grid: false,
    },
  }

  if (!config) {
    return streamlitTheme
  }

  // Fill in theme defaults where the user didn't specify config options.
  return mergeWith({}, streamlitTheme, config, (_, b) =>
    isArray(b) ? b : undefined
  )
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
