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

import { FC, ReactNode, Suspense, useContext } from "react"

import classNames from "classnames"

import { Skeleton as SkeletonProto } from "@streamlit/protobuf"

import { ElementNode } from "~lib/AppNode"
import { ViewStateContext } from "~lib/components/core/ViewStateContext"
import { Skeleton } from "~lib/components/elements/Skeleton/Skeleton"
import ErrorBoundary from "~lib/components/shared/ErrorBoundary/ErrorBoundary"
import { getElementId } from "~lib/util/utils"

import { ElementContainerConfig } from "./ElementContainerConfig"
import { StyledElementContainerLayoutWrapper } from "./StyledElementContainerLayoutWrapper"
import { convertKeyToClassName, getKeyFromId } from "./utils"

export interface ElementContainerProps {
  /** The element node being rendered */
  node: ElementNode
  /** Configuration for layout container styling */
  config: ElementContainerConfig
  /** Whether the element is stale (from a previous script run) */
  isStale: boolean
  /** The element to render inside the container */
  children: ReactNode
}

/**
 * Wrapper component that encapsulates the element container layers:
 * - StyledElementContainerLayoutWrapper (layout styling)
 * - ErrorBoundary (error handling)
 * - Suspense (lazy loading fallback)
 *
 * Used in each case block of RawElementNodeRenderer to wrap elements
 * with their specific configuration.
 *
 * @example
 * ```typescript
 * case "textArea": {
 *   const config = new ElementContainerConfig({
 *     minStretchWidth: MinStretchWidth.MEDIUM,
 *     styleOverrides: { height: "auto" },
 *   })
 *   return (
 *     <ElementContainer node={node} config={config} isStale={isStale}>
 *       <TextArea {...props} />
 *     </ElementContainer>
 *   )
 * }
 * ```
 */
export const ElementContainer: FC<ElementContainerProps> = ({
  node,
  config,
  isStale,
  children,
}) => {
  const { isFullScreen } = useContext(ViewStateContext)

  const elementType = node.element.type || ""
  const elementId = getElementId(node.element)
  const userKey = getKeyFromId(elementId)

  return (
    <StyledElementContainerLayoutWrapper
      className={classNames(
        "stElementContainer",
        "element-container",
        convertKeyToClassName(userKey)
      )}
      data-testid="stElementContainer"
      data-stale={isStale}
      isStale={isStale && !isFullScreen}
      elementType={elementType}
      node={node}
      config={config}
    >
      <ErrorBoundary>
        <Suspense
          fallback={
            <Skeleton
              element={SkeletonProto.create({
                style: SkeletonProto.SkeletonStyle.ELEMENT,
              })}
            />
          }
        >
          {children}
        </Suspense>
      </ErrorBoundary>
    </StyledElementContainerLayoutWrapper>
  )
}
