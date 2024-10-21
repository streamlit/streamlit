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
import mergeWith from "lodash/mergeWith"

import {
  convertRemToPx,
  EmotionTheme,
  getBlue80,
  getCategoricalColorsArray,
  getDivergingColorsArray,
  getGray30,
  getGray70,
  getSequentialColorsArray,
} from "@streamlit/lib/src/theme"

export function applyStreamlitTheme(config: any, theme: EmotionTheme): any {
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
      fontSize: theme.fontSizes.mdPx,
      orient: "top",
      offset: 26,
    },
    header: {
      titleFontWeight: theme.fontWeights.normal,
      titleFontSize: theme.fontSizes.mdPx,
      titleColor: getGray70(theme),
      titleFontStyle: "normal",
      labelFontSize: theme.fontSizes.twoSmPx,
      labelFontWeight: theme.fontWeights.normal,
      labelColor: getGray70(theme),
      labelFontStyle: "normal",
    },
    axis: {
      labelFontSize: theme.fontSizes.twoSmPx,
      labelFontWeight: theme.fontWeights.normal,
      labelColor: getGray70(theme),
      labelFontStyle: "normal",
      titleFontWeight: theme.fontWeights.normal,
      titleFontSize: theme.fontSizes.smPx,
      titleColor: getGray70(theme),
      titleFontStyle: "normal",
      ticks: false,
      gridColor: getGray30(theme),
      domain: false,
      domainWidth: 1,
      domainColor: getGray30(theme),
      labelFlush: true,
      labelFlushOffset: 1,
      labelBound: false,
      labelLimit: 100,
      titlePadding: convertRemToPx(theme.spacing.lg),
      labelPadding: convertRemToPx(theme.spacing.lg),
      labelSeparation: convertRemToPx(theme.spacing.twoXS),
      labelOverlap: true,
    },
    legend: {
      labelFontSize: theme.fontSizes.smPx,
      labelFontWeight: theme.fontWeights.normal,
      labelColor: getGray70(theme),
      titleFontSize: theme.fontSizes.smPx,
      titleFontWeight: theme.fontWeights.normal,
      titleFontStyle: "normal",
      titleColor: getGray70(theme),
      titlePadding: 5,
      labelPadding: convertRemToPx(theme.spacing.lg),
      columnPadding: convertRemToPx(theme.spacing.sm),
      rowPadding: convertRemToPx(theme.spacing.twoXS),
      // eslint-disable-next-line streamlit-custom/no-hardcoded-theme-values
      padding: 7,
      symbolStrokeWidth: 4,
    },
    range: {
      category: getCategoricalColorsArray(theme),
      diverging: getDivergingColorsArray(theme),
      ramp: getSequentialColorsArray(theme),
      heatmap: getSequentialColorsArray(theme),
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
      color: getBlue80(theme),
    },
    bar: {
      binSpacing: convertRemToPx(theme.spacing.twoXS),
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
    Array.isArray(b) ? b : undefined
  )
}

export function applyThemeDefaults(config: any, theme: EmotionTheme): any {
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
      gridColor: getGray30(theme),
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
      titleColor: colors.bodyText,
      ...themeFonts,
    },
    view: {
      stroke: getGray30(theme),
      continuousHeight: 350,
      continuousWidth: 400,
    },
    mark: {
      tooltip: true,
    },
  }

  if (!config) {
    return themeDefaults
  }

  // Fill in theme defaults where the user didn't specify config options.
  return merge({}, themeDefaults, config)
}
