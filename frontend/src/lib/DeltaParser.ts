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
// The actual protobuf Element.proto
export type SimpleElement = ImmutableMap<string, any>
// A list of nodes to render.
// Example BlockElements include: main, sidebar, st.container, st.column
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

  const topLevelBlock =
    parentBlockContainer === BlockPath.Container.MAIN ? "main" : "sidebar"
  // The full path to the ReportElement within the element tree
  // Used to find and update the element node specified by this Delta
  const deltaPath: any[] = [...parentBlockPath, metadata.deltaId]
    // e.g. [1, 0, 2] => [1, "element", 0, "element", 2]
    .flatMap(index => ["element", index])
    .slice(1)

  MetricsManager.current.incrementDeltaCounter(topLevelBlock)
  dispatchOneOf(delta, "type", {
    newElement: (element: SimpleElement) => {
      const currentElement: ReportElement = elements[topLevelBlock].getIn(
        deltaPath
      )

      elements[topLevelBlock] = elements[topLevelBlock].setIn(
        deltaPath,
        handleNewElementMessage(currentElement, element, reportId, metadata)
      )
    },
    newBlock: () => {
      elements[topLevelBlock] = elements[topLevelBlock].updateIn(
        deltaPath,
        reportElement =>
          handleNewBlockMessage(reportElement, reportId, metadata)
      )
    },
    addRows: (namedDataSet: NamedDataSet) => {
      elements[topLevelBlock] = elements[topLevelBlock].updateIn(
        deltaPath,
        reportElement => handleAddRowsMessage(reportElement, namedDataSet)
      )
    },
  })

  return elements
}

function handleNewElementMessage(
  reportElement: ReportElement,
  element: SimpleElement,
  reportId: string,
  metadata: IForwardMsgMetadata
): ReportElement {
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
  reportElement: ReportElement,
  reportId: string,
  metadata: IForwardMsgMetadata
): ReportElement {
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
  reportElement: ReportElement,
  namedDataSet: NamedDataSet
): ReportElement {
  MetricsManager.current.incrementDeltaCounter("add rows")

  return reportElement.update("element", element =>
    addRows(element, namedDataSet)
  )
}
