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

/**
 * Virtual DOM Reconciler for preserving React component state
 * when elements are inserted/removed/reordered.
 *
 * This reconciler only preserves state for elements with IDs (typically widgets).
 * Elements without IDs (like text, markdown, etc.) are rendered normally and
 * will lose state if their position changes, which is acceptable since they
 * typically don't have meaningful React state to preserve.
 */

import React, {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import { AppNode, ElementNode } from "~lib/AppNode"

interface ReconcilerChildProps {
  node: AppNode
  isHidden: boolean
  renderChild: (node: AppNode, key: string) => ReactNode
}

interface ReconcilerState {
  // Maps stable keys to their rendered components
  renderedElements: Map<
    string,
    {
      node: AppNode
      element: ReactNode
      lastSeen: number
    }
  >
  // Track the order of elements
  elementOrder: string[]
}

/**
 * A wrapper component that preserves child components when they're temporarily
 * removed from the tree (e.g., when new elements are inserted before them).
 */
const ReconcilerChild: React.FC<ReconcilerChildProps> = ({
  node,
  isHidden,
  renderChild,
}) => {
  const key =
    node instanceof ElementNode
      ? (node.element.type || "element") +
        "-" +
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (node.element as any)[node.element.type || ""]?.id
      : "block-" + Math.random()

  return (
    <div
      style={{
        display: isHidden ? "none" : "contents",
      }}
      data-reconciler-key={key}
      data-hidden={isHidden}
    >
      {renderChild(node, key)}
    </div>
  )
}

interface VirtualReconcilerProps {
  nodes: AppNode[]
  renderChild: (node: AppNode, key: string) => ReactNode
  scriptRunId: string
  enableReconciliation?: boolean
}

/**
 * VirtualReconciler preserves React state for widgets (elements with IDs) when
 * they're temporarily removed from the tree due to element reordering.
 *
 * Instead of unmounting widgets when they're removed, it hides them and
 * only unmounts them after the script run is complete if they weren't re-rendered.
 *
 * Elements without IDs (text, markdown, etc.) are rendered normally and may
 * lose state on reordering, which is acceptable as they typically don't have
 * meaningful interactive state.
 */
export const VirtualReconciler: React.FC<VirtualReconcilerProps> = ({
  nodes,
  renderChild,
  scriptRunId,
  enableReconciliation = true,
}) => {
  const [state, setState] = useState<ReconcilerState>(() => ({
    renderedElements: new Map(),
    elementOrder: [],
  }))
  const scriptRunIdRef = useRef(scriptRunId)
  const previousNodesRef = useRef<AppNode[]>([])

  // Generate stable keys for nodes - only track elements with IDs
  const getNodeKey = useCallback((node: AppNode, index: number): string => {
    if (node instanceof ElementNode) {
      const element = node.element
      const elementType = element.type || "element"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementId = (element as any)[elementType]?.id
      if (elementId) {
        return elementId
      }
    }
    // For nodes without IDs, use index-based keys (they won't be preserved)
    return `temp-${index}-${Date.now()}`
  }, [])

  useEffect(() => {
    if (!enableReconciliation) {
      return
    }

    // Detect script run change
    const isNewScriptRun = scriptRunIdRef.current !== scriptRunId
    if (isNewScriptRun) {
      // Clean up elements from previous script run that are no longer present
      setState(prevState => {
        const newRenderedElements = new Map(prevState.renderedElements)
        const currentNodeKeys = new Set(
          nodes.map((node, idx) => getNodeKey(node, idx))
        )

        // Remove elements that weren't rendered in the new script run
        for (const [key, elementData] of newRenderedElements) {
          if (
            !currentNodeKeys.has(key) &&
            elementData.lastSeen !== Date.now()
          ) {
            newRenderedElements.delete(key)
          }
        }

        return {
          ...prevState,
          renderedElements: newRenderedElements,
        }
      })
      scriptRunIdRef.current = scriptRunId
    }

    // Update state with current nodes
    setState(prevState => {
      const newRenderedElements = new Map(prevState.renderedElements)
      const newElementOrder: string[] = []
      const now = Date.now()

      nodes.forEach((node, index) => {
        const key = getNodeKey(node, index)
        newElementOrder.push(key)

        // Only track elements with stable IDs (not temp keys)
        if (!key.startsWith("temp-")) {
          // Update or add the element
          const existingElement = newRenderedElements.get(key)
          if (!existingElement || existingElement.node !== node) {
            newRenderedElements.set(key, {
              node,
              element: renderChild(node, key),
              lastSeen: now,
            })
          } else {
            // Update last seen time
            existingElement.lastSeen = now
          }
        }
      })

      // Mark elements as hidden if they're not in the current node list
      for (const [key, elementData] of newRenderedElements) {
        if (!newElementOrder.includes(key)) {
          // Keep the element but mark when it was last seen
          elementData.lastSeen = now - 1
        }
      }

      return {
        renderedElements: newRenderedElements,
        elementOrder: newElementOrder,
      }
    })

    previousNodesRef.current = nodes
  }, [nodes, renderChild, scriptRunId, enableReconciliation, getNodeKey])

  if (!enableReconciliation) {
    // Fallback to normal rendering without reconciliation
    return (
      <>
        {nodes.map((node, index) => (
          <React.Fragment key={getNodeKey(node, index)}>
            {renderChild(node, getNodeKey(node, index))}
          </React.Fragment>
        ))}
      </>
    )
  }

  // Render all elements
  const allElements: ReactNode[] = []
  const renderedKeys = new Set<string>()

  // First, render elements in their current order
  state.elementOrder.forEach((key, index) => {
    // For elements with IDs that we're tracking
    const elementData = state.renderedElements.get(key)
    if (elementData) {
      renderedKeys.add(key)
      allElements.push(
        <ReconcilerChild
          key={key}
          node={elementData.node}
          isHidden={false}
          renderChild={renderChild}
        />
      )
    } else {
      // For elements without IDs, render directly with their temp key
      const node = nodes[index]
      if (node) {
        allElements.push(
          <React.Fragment key={key}>{renderChild(node, key)}</React.Fragment>
        )
      }
    }
  })

  // Then, render hidden elements with IDs (to preserve their state)
  for (const [key, elementData] of state.renderedElements) {
    if (!renderedKeys.has(key)) {
      allElements.push(
        <ReconcilerChild
          key={key}
          node={elementData.node}
          isHidden={true}
          renderChild={renderChild}
        />
      )
    }
  }

  return <>{allElements}</>
}

export default VirtualReconciler
