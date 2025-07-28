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

import type { ElementNode } from "~lib/AppNode"
import { FlexContext } from "~lib/components/core/Layout/FlexContext"
import { useLayoutStyles } from "~lib/components/core/Layout/useLayoutStyles"
import { useRequiredContext } from "~lib/hooks/useRequiredContext"
import { StyledElementContainer } from "~lib/components/core/Block/styled-components"

export const StyledElementContainerLayoutWrapper: FC<
  Omit<
    Parameters<typeof StyledElementContainer>[0],
    "width" | "height" | "overflow"
  > & {
    node: ElementNode
  }
> = ({ node, ...rest }) => {
  const { isInHorizontalLayout } = useRequiredContext(FlexContext)
  const isContentWidthDataframe =
    node.element.type === "arrowDataFrame" &&
    !node.element["arrowDataFrame"]?.width &&
    !node.element["arrowDataFrame"]?.useContainerWidth

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
      if (node.element.heightConfig?.useStretch) {
        return {
          height: "100%",
          flex: "1 1",
        }
      } else if (isInHorizontalLayout) {
        return {
          height: "auto",
          // In horizontal we need the flex here
          // so that the text area will share the row with the other elements
          // and not cause them to immediately wrap.
          flex: "1 1",
        }
      }
      return {
        height: "auto",
        // Content height text area in vertical layout cannot have flex.
        flex: "",
      }
    } else if (node.element.type === "iframe") {
      // TODO(lwilby): Some elements need overflow to be visible in webkit. Will investigate
      // if we can remove this custom handling in future layouts work.
      return {
        overflow: "visible",
      }
    } else if (node.element.type === "componentInstance") {
      // Because of how width is handled for custom components, we need the
      // element wrapper to be full width.
      return {
        width: "100%",
      }
    } else if (node.element.type === "arrowDataFrame") {
      // TODO (lawilby): Some of this can be removed once the width changes
      // are implemented for dataframe.
      const styles: React.CSSProperties = {
        overflow: "visible",
        width: "100%",
      }
      if (isContentWidthDataframe && isInHorizontalLayout) {
        styles.width = "fit-content"
        styles.flex = "0 0 auto"
      }
      return styles
    } else if (node.element.type === "plotlyChart") {
      // TODO (lawilby): This can probably be removed once width is
      // implemented for plotly charts. But currently, it seems like when
      // we have use_container_width=False and the minWidth change the image
      // doesn't render large enough.
      return {
        width: "100%",
      }
    } else if (node.element.type === "deckGlJsonChart") {
      // TODO (lawilby): When width is implemented for deckGlJsonChart, we
      // should try to remove these custom styles.
      // Currently, maps with use_container_width=False and a size layer
      // don't render correctly without the width override.
      const styles: React.CSSProperties = {
        overflow: "visible",
      }
      if (
        !node.element.deckGlJsonChart?.useContainerWidth &&
        !node.element.deckGlJsonChart?.width
      ) {
        styles.width = "100%"
      }
      return styles
    }

    return {}
  }, [
    node.element.type,
    node.element.heightConfig?.useStretch,
    isContentWidthDataframe,
    isInHorizontalLayout,
  ])

  const styles = useLayoutStyles({
    element: node.element,
    subElement:
      (node.element?.type && node.element[node.element.type]) || undefined,
    styleOverrides,
  })

  return <StyledElementContainer {...rest} {...styles} />
}
