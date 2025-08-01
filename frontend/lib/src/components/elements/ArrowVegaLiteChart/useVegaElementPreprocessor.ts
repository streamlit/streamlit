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

import { useMemo } from "react"

import { useEmotionTheme } from "~lib/hooks/useEmotionTheme"
import { EmotionTheme } from "~lib/theme"
import { isNullOrUndefined } from "~lib/util/utils"

import { VegaLiteChartElement } from "./arrowUtils"
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

const generateSpec = (
  inputSpec: string,
  useContainerWidth: boolean,
  vegaLiteTheme: string,
  selectionMode: string[],
  theme: EmotionTheme,
  isFullScreen: boolean,
  width: number,
  height?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
): any => {
  const spec = JSON.parse(inputSpec)
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
      Math.max(width - 40, 0)
  }

  if (isFullScreen) {
    spec.width = width
    spec.height = height

    if ("vconcat" in spec) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
      spec.vconcat.forEach((child: any) => {
        child.width = width
      })
    }
  } else if (useContainerWidth) {
    spec.width = width

    if ("vconcat" in spec) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
      spec.vconcat.forEach((child: any) => {
        child.width = width
      })
    }
  }

  if (!spec.padding) {
    spec.padding = {}
  }

  if (isNullOrUndefined(spec.padding.bottom)) {
    spec.padding.bottom = BOTTOM_PADDING
  }

  if (spec.datasets) {
    throw new Error("Datasets should not be passed as part of the spec")
  }

  if (selectionMode.length > 0) {
    prepareSpecForSelections(spec)
  }
  return spec
}

/**
 * Preprocesses the element to generate the VegaLite spec.
 * It stabilizes some of the references (e.g. selectionMode and spec)
 * and avoids further processing if unnecessary.
 */
export const useVegaElementPreprocessor = (
  element: VegaLiteChartElement,
  isFullScreen: boolean,
  width: number,
  height: number
): VegaLiteChartElement => {
  const theme = useEmotionTheme()

  const {
    id,
    formId,
    spec: inputSpec,
    data,
    datasets,
    useContainerWidth,
    vegaLiteTheme,
    selectionMode: inputSelectionMode,
  } = element

  // Selection Mode is an array, so we want to update it only when the contents
  // change, not the reference itself (since each forward message would be a new
  // reference).
  const selectionMode = useMemo(() => {
    return inputSelectionMode
    // eslint-disable-next-line react-hooks/react-compiler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(inputSelectionMode)])

  const spec = useMemo(
    () =>
      generateSpec(
        inputSpec,
        useContainerWidth,
        vegaLiteTheme,
        selectionMode,
        theme,
        isFullScreen,
        width || 0,
        height
      ),
    [
      inputSpec,
      useContainerWidth,
      vegaLiteTheme,
      selectionMode,
      theme,
      isFullScreen,
      width,
      height,
    ]
  )

  return {
    id,
    formId,
    vegaLiteTheme,
    spec,
    selectionMode,
    data,
    datasets,
    useContainerWidth,
  }
}
