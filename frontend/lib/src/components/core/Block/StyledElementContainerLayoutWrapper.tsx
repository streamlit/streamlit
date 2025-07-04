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

import { useLayoutStyles } from "~lib/components/core/Layout/useLayoutStyles"
import type { ElementNode } from "~lib/AppNode"

import { StyledElementContainer } from "./styled-components"

export const StyledElementContainerLayoutWrapper: FC<
  Omit<
    Parameters<typeof StyledElementContainer>[0],
    "width" | "height" | "overflow"
  > & {
    node: ElementNode
  }
> = ({ node, ...rest }) => {
  const styleOverrides = useMemo(() => {
    if (node.element.type === "imgs") {
      // The st.image element is potentially a list of images, so we always want
      // the enclosing container to be full width. The size of individual
      // images is managed in the ImageList component.
      return {
        width: "100%",
      }
    } else if (node.element.type === "textArea") {
      // The st.text_area element has a legacy implementation where the height
      // is measuring only the input box so the pixel height must be set in the element
      // and the container must be allowed to expand. Additionally, we don't want the
      // flex with height to be set on the element container.
      // TODO(lawilby): The PR expanding the height of text_area elements will
      // make st.text_area consistent with the other elements and we can remove this.
      if (node.element.heightConfig?.useStretch) {
        return {
          height: "auto",
          flex: "1 1 auto",
        }
      }
      return {
        height: "auto",
        flex: "",
      }
    } else if (
      node.element.type === "iframe" ||
      node.element.type === "deckGlJsonChart" ||
      node.element.type === "arrowDataFrame"
    ) {
      // TODO(lwilby): Some elements need overflow to be visible in webkit. Will investigate
      // if we can remove this custom handling in future layouts work.
      return {
        overflow: "visible",
      }
    }

    return {}
  }, [node.element.type, node.element.heightConfig?.useStretch])

  const styles = useLayoutStyles({
    element: node.element,
    subElement:
      (node.element?.type && node.element[node.element.type]) || undefined,
    styleOverrides,
  })

  return <StyledElementContainer {...rest} {...styles} />
}
