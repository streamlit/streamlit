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

import React, { FC, useMemo } from "react"

import { ButtonGroup } from "@streamlit/protobuf"

import type { ElementNode } from "~lib/AppNode"
import { StyledElementContainer } from "~lib/components/core/Block/styled-components"
import { FlexContext } from "~lib/components/core/Layout/FlexContext"
import { useLayoutStyles } from "~lib/components/core/Layout/useLayoutStyles"
import { MinFlexElementWidth } from "~lib/components/core/Layout/utils"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"

const LARGE_STRETCH_BEHAVIOR = [
  "graphvizChart",
  "arrowVegaLiteChart",
  "deckGlJsonChart",
  "plotlyChart",
  "docString",
  "arrowDataFrame",
  "json",
  "audioInput",
  "fileUploader",
  "cameraInput",
  "audio",
  "video",
  "code", // also includes st.echo
  "buttonGroup",
  "iframe",
]

const MEDIUM_STRETCH_BEHAVIOR = [
  "dateInput",
  "radio",
  "slider", // also includes st.select_slider
  "textArea",
  "progress",
  "multiselect",
  "selectbox",
  "timeInput",
  "numberInput",
  "textInput",
]

const WIDTH_STRETCH_OVERRIDE = [
  // Because of how width is handled for custom components, we need the
  // element wrapper to be full width.
  "componentInstance",
  // Without this style, the skeleton width relies on the flex container that
  // wraps the page contents having align-items: stretch. There was a regression
  // where this default was changed. It is more robust to ensure that the skeleton
  // has this width.
  "skeleton",
]

const VISIBLE_OVERFLOW_OVERRIDE = [
  // TODO(lwilby): Some elements need overflow to be visible in webkit. Will investigate
  // if we can remove this custom handling in future layouts work.
  "iframe",
  "arrowDataFrame",
  "deckGlJsonChart",
  "arrowVegaLiteChart",
  "graphvizChart",
]

export const StyledElementContainerLayoutWrapper: FC<
  Omit<
    Parameters<typeof StyledElementContainer>[0],
    "width" | "height" | "overflow" | "minWidth" | "flex"
  > & {
    node: ElementNode
  }
> = ({ node, ...rest }) => {
  const { isInHorizontalLayout, isInRoot } = useRequiredContext(FlexContext)

  let minStretchBehavior: MinFlexElementWidth
  if (LARGE_STRETCH_BEHAVIOR.includes(node.element.type ?? "")) {
    minStretchBehavior = "14rem"
  } else if (MEDIUM_STRETCH_BEHAVIOR.includes(node.element.type ?? "")) {
    minStretchBehavior = "8rem"
  }

  if (
    node.element.type === "buttonGroup" &&
    node.element.buttonGroup?.style === ButtonGroup.Style.BORDERLESS
  ) {
    minStretchBehavior = "fit-content"
  }

  const styleOverrides = useMemo(() => {
    const styles: React.CSSProperties = {}

    if (WIDTH_STRETCH_OVERRIDE.includes(node.element.type ?? "")) {
      styles.width = "100%"
    }

    if (VISIBLE_OVERFLOW_OVERRIDE.includes(node.element.type ?? "")) {
      styles.overflow = "visible"
    }

    if (node.element.type === "textArea") {
      // The st.text_area element has a legacy implementation where the height
      // is measuring only the input box so the pixel height must be set in the element
      // and the container must be allowed to expand. Additionally, we don't want the
      // flex with height to be set on the element container.
      if (node.element.heightConfig?.useStretch) {
        return {
          height: "100%",
          flex: "1 1 8rem",
        }
      } else if (isInHorizontalLayout) {
        return {
          height: "auto",
        }
      }
      return {
        height: "auto",
        // Content height text area in vertical layout cannot have flex.
        flex: "",
      }
    } else if (node.element.type === "arrowVegaLiteChart") {
      if (node.element.widthConfig?.useContent && isInRoot) {
        // VegaLite charts with embedded dataframes need a defined parent width
        // (not fit-content) for proper measurement and rendering due to the resize feature.
        // Resize is disabled in nested containers, so this is only necessary in the root container.
        styles.width = "100%"
      }
      if (isInHorizontalLayout && !node.element.widthConfig) {
        // TODO (lawilby): This can be removed once the new width style is implemented for all of the vega charts.
        styles.flex = "1 1 14rem"
      }
      return styles
    } else if (node.element.type === "arrowDataFrame") {
      if (node.element.widthConfig?.useContent && isInRoot) {
        // Resizable dataframes measure parent container width for the resize feature.
        // Parent needs defined width (not fit-content) for measurement to work.
        // Only needed in root where resize is enabled; disabled in nested containers.
        styles.width = "100%"
      }
      return styles
    } else if (node.element.type === "imgs") {
      // The st.image element is potentially a list of images, so we defer the sizing to the ImageList component.
      // This also covers st.pyplot() which is a special case of st.image.
      //
      // Use "auto" when image has explicit non-stretch size (content/pixel/rem) to enable horizontal alignment (#12435).
      // Use "100%" when using stretch or when no width config is set to ensure container has dimensions for width calculation (#12678).
      //
      // Legacy behavior: When widthConfig is not set, the default is to stretch (use container width).
      // This is consistent with how useLayoutStyles handles missing config for other elements.
      const isUsingStretch =
        !node.element.widthConfig || node.element.widthConfig.useStretch

      styles.width = isUsingStretch ? "100%" : "auto"
    }

    return styles
  }, [
    node.element.type,
    node.element.heightConfig?.useStretch,
    isInHorizontalLayout,
    isInRoot,
    node.element.widthConfig,
  ])

  let styles = useLayoutStyles({
    element: node.element,
    subElement:
      (node.element?.type && node.element[node.element.type]) || undefined,
    styleOverrides,
    minStretchBehavior,
  })

  // Special handling for space elements: apply only relevant dimension
  // to prevent unintended cross-axis spacing
  if (node.element.type === "space") {
    if (isInHorizontalLayout) {
      // In horizontal layout: keep width, clear height
      // This prevents unwanted vertical spacing
      styles = {
        ...styles,
        height: "auto",
      }
    } else {
      // In vertical layout (default): keep height, clear width
      // This prevents unwanted horizontal spacing
      styles = {
        ...styles,
        width: "auto",
      }
    }
  }

  return <StyledElementContainer {...rest} {...styles} />
}
