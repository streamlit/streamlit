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

import { type FC, useMemo } from "react"

import type { ElementNode } from "~lib/AppNode"
import { StyledElementContainer } from "~lib/components/core/Block/styled-components"
import { FlexContext } from "~lib/components/core/Layout/FlexContext"
import {
  extractLayoutSubElement,
  useLayoutStyles,
} from "~lib/components/core/Layout/useLayoutStyles"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"

import type { ElementContainerConfig } from "./ElementContainerConfig"

export const StyledElementContainerLayoutWrapper: FC<
  Omit<
    Parameters<typeof StyledElementContainer>[0],
    | "width"
    | "height"
    | "overflow"
    | "minWidth"
    | "flex"
    | "alignSelf"
    | "minHeight"
    | "maxHeight"
    | "contain"
  > & {
    node: ElementNode
    config: ElementContainerConfig
  }
> = ({ node, config, ...rest }) => {
  const { hasDefiniteHeight, isInHorizontalLayout } =
    useRequiredContext(FlexContext)

  const styleOverrides = useMemo(
    () => config.computeStyleOverrides(),
    [config]
  )
  const minStretchBehavior = useMemo(
    () => config.getMinStretchBehavior(),
    [config]
  )

  let styles = useLayoutStyles({
    element: node.element,
    subElement: extractLayoutSubElement(node.element),
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
        alignSelf: undefined,
        minHeight: undefined,
        maxHeight: undefined,
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

  // Stretch elements fill a definite-height parent with `height: 100%`. That
  // percentage is cyclic while a stretch container's min-content size is
  // calculated (`height: auto`), so an internally scrolling element such as
  // `st.code` would grow the container to its full content. Size containment
  // keeps the 100% box. Skip content width: containment would collapse it.
  const width = styles.width
  const widthIsSpecified =
    width === "100%" ||
    (typeof width === "string" &&
      (width.endsWith("px") || width.endsWith("rem")))
  const contain =
    hasDefiniteHeight &&
    !isInHorizontalLayout &&
    styles.height === "100%" &&
    widthIsSpecified
      ? "size"
      : undefined

  return <StyledElementContainer {...rest} {...styles} contain={contain} />
}
