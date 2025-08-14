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
  "arrowDataFrame",
  // TODO (lawilby): This can probably be removed once width is
  // implemented for plotly charts. But currently, it seems like when
  // we have use_container_width=False and the minWidth change the image
  // doesn't render large enough.
  "plotlyChart",
  // The st.image element is potentially a list of images, so we always want
  // the enclosing container to be full width. The size of individual
  // images is managed in the ImageList component.
  // This also covers st.pyplot() which is a special case of st.image.
  "imgs",
  "skeleton",
]

const VISIBLE_OVERFLOW_OVERRIDE = [
  // TODO(lwilby): Some elements need overflow to be visible in webkit. Will investigate
  // if we can remove this custom handling in future layouts work.
  "iframe",
  "arrowDataFrame",
  "deckGlJsonChart",
]

export const StyledElementContainerLayoutWrapper: FC<
  Omit<
    Parameters<typeof StyledElementContainer>[0],
    "width" | "height" | "overflow"
  > & {
    node: ElementNode
  }
> = ({ node, ...rest }) => {
  const { isInHorizontalLayout } = useRequiredContext(FlexContext)

  let minStretchBehavior: MinFlexElementWidth = "fit-content"
  if (
    isInHorizontalLayout &&
    LARGE_STRETCH_BEHAVIOR.includes(node.element.type ?? "")
  ) {
    minStretchBehavior = "14rem"
  } else if (
    isInHorizontalLayout &&
    MEDIUM_STRETCH_BEHAVIOR.includes(node.element.type ?? "")
  ) {
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
    } else if (node.element.type === "deckGlJsonChart") {
      // TODO (lawilby): When width is implemented for deckGlJsonChart, we
      // should try to remove these custom styles.
      // Currently, maps with use_container_width=False and a size layer
      // don't render correctly without the width override.
      if (
        !node.element.deckGlJsonChart?.useContainerWidth &&
        !node.element.deckGlJsonChart?.width
      ) {
        styles.width = "100%"
      }
      return styles
    } else if (node.element.type === "arrowVegaLiteChart") {
      if (isInHorizontalLayout) {
        styles.flex = "1 1 14rem"
      }
      return styles
    }

    return styles
  }, [
    node.element.type,
    node.element.heightConfig?.useStretch,
    node.element.deckGlJsonChart?.useContainerWidth,
    node.element.deckGlJsonChart?.width,
    isInHorizontalLayout,
  ])

  const styles = useLayoutStyles({
    element: node.element,
    subElement:
      (node.element?.type && node.element[node.element.type]) || undefined,
    styleOverrides,
    minStretchBehavior,
  })

  return <StyledElementContainer {...rest} {...styles} />
}
