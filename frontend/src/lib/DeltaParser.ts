/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  BlockPath,
  Delta,
  IForwardMsgMetadata,
  NamedDataSet,
} from "autogen/proto"
import { List, Map as ImmutableMap } from "immutable"
import { addRows } from "lib/dataFrameProto"
import { dispatchOneOf, toImmutableProto } from "lib/immutableProto"
import { MetricsManager } from "lib/MetricsManager"
import { requireNonNull } from "lib/utils"

type Container = "main" | "sidebar"
// The actual protobuf Element.proto
export type SimpleElement = ImmutableMap<string, any>
// A list of nodes to render (e.g. main, sidebar, st.container, st.column)
export interface BlockElement extends List<ReportElement> {}

// Pointers to the two root nodes of the element trees.
export interface Elements {
  main: BlockElement
  sidebar: BlockElement
}

/**
 * A node of the element tree, representing a single thing to render: {
 *  element: SimpleElement | BlockElement
 *  reportId: string
 *  metadata: IForwardMsgMetadata
 * }
 */
export type ReportElement = ImmutableMap<string, any>

export function applyDelta(
  elements: Elements,
  reportId: string,
  deltaMsg: Delta,
  metadata: IForwardMsgMetadata | null | undefined
): Elements {
  if (!metadata) {
    throw new Error("Delta metadata is required")
  }

  const delta = toImmutableProto(Delta, deltaMsg)
  const parentBlock = requireNonNull(metadata.parentBlock)
  const parentBlockPath = requireNonNull(parentBlock.path)
  const parentBlockContainer = requireNonNull(parentBlock.container)

  const container =
    parentBlockContainer === BlockPath.Container.MAIN ? "main" : "sidebar"
  // Build the full path to a delta: [1, 0, 2] => [1, "element", 0, "element", 2]
  let deltaPath: any[] = [...parentBlockPath, metadata.deltaId]
  deltaPath = deltaPath.flatMap(path => [path, "element"])
  deltaPath.pop() // Remove final "element" tag.

  dispatchOneOf(delta, "type", {
    newElement: (element: SimpleElement) => {
      const currentElement: ReportElement = elements[container].getIn(
        deltaPath
      )

      elements[container] = elements[container].setIn(
        deltaPath,
        handleNewElementMessage(
          container,
          currentElement,
          element,
          reportId,
          metadata
        )
      )
    },
    newBlock: () => {
      elements[container] = elements[container].updateIn(
        deltaPath,
        reportElement =>
          handleNewBlockMessage(container, reportElement, reportId, metadata)
      )
    },
    addRows: (namedDataSet: NamedDataSet) => {
      elements[container] = elements[container].updateIn(
        deltaPath,
        reportElement =>
          handleAddRowsMessage(container, reportElement, namedDataSet)
      )
    },
  })

  return elements
}

function handleNewElementMessage(
  container: Container,
  reportElement: ReportElement,
  element: SimpleElement,
  reportId: string,
  metadata: IForwardMsgMetadata
): ReportElement {
  MetricsManager.current.incrementDeltaCounter(container)
  MetricsManager.current.incrementDeltaCounter(element.get("type"))

  // Track component instance name.
  if (element.get("type") === "componentInstance") {
    const componentName = element.getIn(["componentInstance", "componentName"])
    MetricsManager.current.incrementCustomComponentCounter(componentName)
  }

  // Set reportId on elements so we can clear old elements
  // when the report script is re-executed.
  // Set metadata on elements so that we can use them downstream.
  if (reportElement && reportElement.get("element").equals(element)) {
    return reportElement.set("reportId", reportId).set("metadata", metadata)
  }

  return ImmutableMap({
    reportId,
    element,
    metadata,
  })
}

function handleNewBlockMessage(
  container: Container,
  reportElement: ReportElement,
  reportId: string,
  metadata: IForwardMsgMetadata
): ReportElement {
  MetricsManager.current.incrementDeltaCounter(container)
  MetricsManager.current.incrementDeltaCounter("new block")

  // There's nothing at this node (aka first run), so initialize an empty list.
  if (!reportElement) {
    return ImmutableMap({ element: List(), reportId, metadata })
  }

  // This node was already a list of elements; no need to change anything.
  if (reportElement.get("element") instanceof List) {
    return reportElement
  }

  // This node used to represent a single element; convert into an empty list.
  return reportElement.set("element", List())
}

function handleAddRowsMessage(
  container: Container,
  reportElement: ReportElement,
  namedDataSet: NamedDataSet
): ReportElement {
  MetricsManager.current.incrementDeltaCounter(container)
  MetricsManager.current.incrementDeltaCounter("add rows")

  return reportElement.update("element", element =>
    addRows(element, namedDataSet)
  )
}
