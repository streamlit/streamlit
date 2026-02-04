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

import { useMemo } from "react"

import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { EmotionTheme } from "~lib/theme"
import { isNullOrUndefined } from "~lib/util/utils"

import { VegaLiteChartElement } from "./arrowUtils"
import { resolveNamedColorsInSpec } from "./colorUtils"
import { applyStreamlitTheme, applyThemeDefaults } from "./CustomTheme"

/**
 * Fix bug where Vega Lite was vertically-cropping the x-axis in some cases.
 */
const BOTTOM_PADDING = 20

/**
 * Prepares the vega-lite spec for selections by transforming the select parameters
 * to a full object specification and by automatically adding encodings (if missing)
 * to point selections.
 *
 * The changes are applied in-place to the spec object.
 *
 * @param spec The Vega-Lite specification of the chart.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
export function prepareSpecForSelections(spec: any): void {
  if ("params" in spec && "encoding" in spec) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    spec.params.forEach((param: any) => {
      if (!("select" in param)) {
        // We are only interested in transforming select parameters.
        // Other parameters are skipped.
        return
      }

      if (["interval", "point"].includes(param.select)) {
        // The select object can be either a single string (short-hand) specifying
        // "interval" or "point" or an object that can contain additional
        // properties as defined here: https://vega.github.io/vega-lite/docs/selection.html
        // We convert the short-hand notation to the full object specification,
        // so that we can attach additional properties to this below.
        param.select = {
          type: param.select,
        }
      }

      if (!("type" in param.select)) {
        // The type property is required in the spec.
        // But we check anyways and skip all parameters that don't have it.
        return
      }

      if (
        param.select.type === "point" &&
        !("encodings" in param.select) &&
        isNullOrUndefined(param.select.encodings)
      ) {
        // If encodings are not specified by the user, we add all the encodings from
        // the chart to the selection parameter. This is required so that points
        // selections are correctly resolved to a PointSelection and not an IndexSelection:
        // https://github.com/altair-viz/altair/issues/3285#issuecomment-1858860696
        param.select.encodings = Object.keys(spec.encoding)
      }
    })
  }
}

/**
 * Applies common spec preprocessing: normalizes sizing, applies theming,
 * sets padding, validates datasets, prepares selections, and resolves colors.
 */
const applyCommonSpecProcessing = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  spec: any,
  vegaLiteTheme: string,
  selectionMode: string[],
  theme: EmotionTheme
): void => {
  // Normalize legacy "0"/non-positive sizing semantics: Historically, a
  // top-level width/height of 0 behaved like "unspecified" (Vega-Lite fell back
  // to its default height/auto width). After a Vega-Lite change, a value of 0
  // is treated as an explicit size, which results in charts rendering at 0px.
  // To ensure charts render, treat non-positive numeric values as "no value".
  if (typeof spec.height === "number" && spec.height <= 0) {
    delete spec.height
  }
  if (typeof spec.width === "number" && spec.width <= 0) {
    delete spec.width
  }

  // Apply theming
  if (vegaLiteTheme === "streamlit") {
    spec.config = applyStreamlitTheme(spec.config, theme)
  } else if (spec.usermeta?.embedOptions?.theme === "streamlit") {
    spec.config = applyStreamlitTheme(spec.config, theme)
    // Remove the theme from the usermeta so it doesn't get picked up by vega embed.
    spec.usermeta.embedOptions.theme = undefined
  } else {
    // Apply minor theming improvements to work better with Streamlit
    spec.config = applyThemeDefaults(spec.config, theme)
  }

  // Set default padding
  if (!spec.padding) {
    spec.padding = {}
  }
  if (isNullOrUndefined(spec.padding.bottom)) {
    spec.padding.bottom = BOTTOM_PADDING
  }

  // Validate datasets
  if (spec.datasets) {
    throw new Error("Datasets should not be passed as part of the spec")
  }

  // Prepare selections if enabled
  if (selectionMode.length > 0) {
    prepareSpecForSelections(spec)
  }

  // Resolve built-in color names (red, blue, etc.) to theme color values
  resolveNamedColorsInSpec(spec, theme)
}

/**
 * Generates a base spec without container dimensions.
 * This spec is stable and only changes when the actual chart structure changes,
 * not when the container resizes. Dimensions are applied separately via the Vega
 * view API for much better resize performance.
 */
const generateBaseSpec = (
  inputSpec: string,
  vegaLiteTheme: string,
  selectionMode: string[],
  theme: EmotionTheme
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
): any => {
  const spec = JSON.parse(inputSpec)
  applyCommonSpecProcessing(spec, vegaLiteTheme, selectionMode, theme)
  return spec
}

const generateSpec = (
  inputSpec: string,
  useContainerWidth: boolean,
  useContainerHeight: boolean,
  vegaLiteTheme: string,
  selectionMode: string[],
  theme: EmotionTheme,
  containerWidth: number,
  containerHeight?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
): any => {
  const spec = JSON.parse(inputSpec)
  applyCommonSpecProcessing(spec, vegaLiteTheme, selectionMode, theme)

  // Apply title limit based on container width
  if (spec.title) {
    if (typeof spec.title === "string") {
      spec.title = { text: spec.title }
    }

    spec.title.limit =
      // Preserve existing limit if it exists,
      spec.title.limit ??
      // Otherwise, calculate the width - 40px to give some padding, especially
      // for the ... menu button. If the width is less than 40px, we set it to
      // 0 to avoid negative values.
      Math.max(containerWidth - 40, 0)
  }

  // Only apply a container-derived height when we have a positive measurement.
  // `containerHeight` is -1 until the ResizeObserver has measured the element
  // and we also avoid writing 0, since Vega-Lite now treats 0 as an explicit size.
  if (useContainerHeight && containerHeight && containerHeight > 0) {
    spec.height = containerHeight
  }

  // Same rationale as height: guard against the initial -1 sentinel and 0 so
  // that we only set `spec.width` when the container has a real, positive
  // width measurement.
  if (useContainerWidth && containerWidth && containerWidth > 0) {
    spec.width = containerWidth

    if ("vconcat" in spec) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
      spec.vconcat.forEach((child: any) => {
        // Skip non-object children (defensive check)
        if (child === null || typeof child !== "object") {
          return
        }
        // Skip setting width on children that are nested compositions
        // (hconcat, vconcat, concat, layer) as it causes "infinite extent" errors.
        // In valid Vega-Lite specs, composition operators are always top-level keys.
        if (
          "hconcat" in child ||
          "vconcat" in child ||
          "concat" in child ||
          "layer" in child
        ) {
          return
        }
        child.width = containerWidth
      })
    }
  }

  return spec
}

/**
 * Preprocesses the element to generate the VegaLite spec.
 * It stabilizes some of the references (e.g. selectionMode and spec)
 * and avoids further processing if unnecessary.
 *
 * Returns separate spec and dimensions to allow resizing without view recreation.
 */
export const useVegaElementPreprocessor = (
  element: VegaLiteChartElement,
  containerWidth: number,
  containerHeight: number,
  useContainerWidth: boolean,
  useContainerHeight: boolean
): VegaLiteChartElement & {
  // Dimensions exposed separately for efficient resize operations
  chartWidth: number
  chartHeight: number | undefined
  // Base spec without dimensions for stable view creation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  baseSpec: any
} => {
  const theme = useEmotionTheme()

  const {
    id,
    formId,
    spec: inputSpec,
    data,
    datasets,
    vegaLiteTheme,
    selectionMode: inputSelectionMode,
  } = element

  // Selection Mode is an array, so we want to update it only when the contents
  // change, not the reference itself (since each forward message would be a new
  // reference).
  const selectionMode = useMemo(() => {
    return inputSelectionMode
    // eslint-disable-next-line react-hooks/exhaustive-deps -- TODO: Update to match React best practices
  }, [JSON.stringify(inputSelectionMode)])

  // Generate a base spec that is stable across resize events.
  // This prevents expensive view recreation on every resize.
  const baseSpec = useMemo(
    () => generateBaseSpec(inputSpec, vegaLiteTheme, selectionMode, theme),
    [inputSpec, vegaLiteTheme, selectionMode, theme]
  )

  // Generate the full spec with dimensions (for backwards compatibility)
  const spec = useMemo(
    () =>
      generateSpec(
        inputSpec,
        useContainerWidth,
        useContainerHeight,
        vegaLiteTheme,
        selectionMode,
        theme,
        containerWidth,
        containerHeight
      ),
    [
      inputSpec,
      useContainerWidth,
      useContainerHeight,
      vegaLiteTheme,
      selectionMode,
      theme,
      containerWidth,
      containerHeight,
    ]
  )

  // Calculate the target chart dimensions for the resize API
  const chartWidth =
    useContainerWidth && containerWidth > 0 ? containerWidth : 0
  const chartHeight =
    useContainerHeight && containerHeight > 0 ? containerHeight : undefined

  return {
    id,
    formId,
    vegaLiteTheme,
    spec,
    baseSpec,
    selectionMode,
    data,
    datasets,
    useContainerWidth,
    chartWidth,
    chartHeight,
  }
}
