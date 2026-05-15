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

import { FC, useMemo } from "react"

import { streamlit } from "@streamlit/protobuf"

import type { ElementNode } from "~lib/AppNode"
import { StyledElementContainer } from "~lib/components/core/Block/styled-components"
import { FlexContext } from "~lib/components/core/Layout/FlexContext"
import {
  useLayoutStyles,
  type UseLayoutStylesArgs,
} from "~lib/components/core/Layout/useLayoutStyles"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"

import { ElementContainerConfig } from "./ElementContainerConfig"

const getLayoutSubElement = (
  node: ElementNode
): UseLayoutStylesArgs["subElement"] => {
  const typeKey = node.element.type as keyof typeof node.element | undefined
  const raw = typeKey
    ? (node.element as unknown as Record<string, unknown>)[typeKey]
    : undefined
  if (!raw || typeof raw !== "object") return undefined

  const candidate = raw as Record<string, unknown>
  const subElement = {
    useContainerWidth: candidate.useContainerWidth as
      | boolean
      | null
      | undefined,
    height: candidate.height as number | undefined,
    width: candidate.width as number | undefined,
    widthConfig: candidate.widthConfig as
      | streamlit.IWidthConfig
      | null
      | undefined,
  }

  if (
    subElement.useContainerWidth === undefined &&
    subElement.height === undefined &&
    subElement.width === undefined &&
    subElement.widthConfig === undefined
  ) {
    return undefined
  }

  return subElement
}

export const StyledElementContainerLayoutWrapper: FC<
  Omit<
    Parameters<typeof StyledElementContainer>[0],
    "width" | "height" | "overflow" | "minWidth" | "flex"
  > & {
    node: ElementNode
    config: ElementContainerConfig
  }
> = ({ node, config, ...rest }) => {
  const { isInHorizontalLayout } = useRequiredContext(FlexContext)

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
    subElement: getLayoutSubElement(node),
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
