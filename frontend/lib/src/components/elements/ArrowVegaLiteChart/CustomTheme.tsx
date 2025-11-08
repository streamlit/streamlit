/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
  getDivergingColorsArray,
  getGray30,
  getGray70,
} from "~lib/theme"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
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
      fontSize: convertRemToPx(theme.fontSizes.md),
      orient: "top",
      offset: 26,
    },
    header: {
      titleFontWeight: theme.fontWeights.normal,
      titleFontSize: convertRemToPx(theme.fontSizes.md),
      titleColor: getGray70(theme),
      titleFontStyle: "normal",
      labelFontSize: convertRemToPx(theme.fontSizes.twoSm),
      labelFontWeight: theme.fontWeights.normal,
      labelColor: getGray70(theme),
      labelFontStyle: "normal",
    },
    axis: {
      labelFontSize: convertRemToPx(theme.fontSizes.twoSm),
      labelFontWeight: theme.fontWeights.normal,
      labelColor: getGray70(theme),
      labelFontStyle: "normal",
      titleFontWeight: theme.fontWeights.normal,
      titleFontSize: convertRemToPx(theme.fontSizes.sm),
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
      labelFontSize: convertRemToPx(theme.fontSizes.sm),
      labelFontWeight: theme.fontWeights.normal,
      labelColor: getGray70(theme),
      titleFontSize: convertRemToPx(theme.fontSizes.sm),
      titleFontWeight: theme.fontWeights.normal,
      titleFontStyle: "normal",
      titleColor: getGray70(theme),
      // TODO(lukasmasuch): Change padding here to use a spacing
      // based on our available spacings (-> 4px = 0.25rem)
      titlePadding: 5,
      labelPadding: convertRemToPx(theme.spacing.lg),
      columnPadding: convertRemToPx(theme.spacing.sm),
      rowPadding: convertRemToPx(theme.spacing.twoXS),
      // TODO(lukasmasuch): Change padding here to use a spacing
      // based on our available spacings (-> 8px = 0.5rem)
      // eslint-disable-next-line streamlit-custom/no-hardcoded-theme-values
      padding: 7,
      symbolStrokeWidth: convertRemToPx(theme.spacing.twoXS),
    },
    range: {
      category: theme.colors.chartCategoricalColors,
      diverging: getDivergingColorsArray(theme),
      ramp: theme.colors.chartSequentialColors,
      heatmap: theme.colors.chartSequentialColors,
    },
    view: {
      columns: 1,
      strokeWidth: 0,
      stroke: "transparent",
      continuousHeight: convertRemToPx(theme.sizes.defaultChartHeight),
      continuousWidth: convertRemToPx(theme.sizes.defaultChartWidth),
    },
    concat: {
      columns: 1,
    },
    facet: {
      columns: 1,
    },
    mark: {
      tooltip: { content: "encoding" },
      color: theme.colors.chartCategoricalColors[0],
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
export function applyThemeDefaults(config: any, theme: EmotionTheme): any {
  const { colors, fontSizes, genericFonts } = theme
  const themeFonts = {
    labelFont: genericFonts.bodyFont,
    titleFont: genericFonts.bodyFont,
    labelFontSize: convertRemToPx(fontSizes.twoSm),
    titleFontSize: convertRemToPx(fontSizes.twoSm),
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
      continuousHeight: convertRemToPx(theme.sizes.defaultChartHeight),
      continuousWidth: convertRemToPx(theme.sizes.defaultChartWidth),
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
