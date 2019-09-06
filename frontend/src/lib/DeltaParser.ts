/**
 * @license
 * Copyright 2018-2019 Streamlit Inc.
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
  ForwardMsgMetadata,
  NamedDataSet,
} from "autogen/proto"
import { List, Map as ImmutableMap } from "immutable"
import { addRows } from "lib/dataFrameProto"
import { dispatchOneOf, toImmutableProto } from "lib/immutableProto"
import { MetricsManager } from "lib/MetricsManager"
import { requireNonNull } from "lib/utils"

type Container = "main" | "sidebar"
type SimpleElement = ImmutableMap<string, any>
type Element = SimpleElement | BlockElement
interface BlockElement extends List<Element> {}

interface Elements {
  main: BlockElement
  sidebar: BlockElement
}

export function applyDelta(
  elements: Elements,
  reportId: string,
  deltaMsg: Delta,
  metadata: ForwardMsgMetadata
): Elements {
  const delta = toImmutableProto(Delta, deltaMsg)
  const parentBlock = requireNonNull(metadata.parentBlock)
  const parentBlockPath = requireNonNull(parentBlock.path)
  const parentBlockContainer = requireNonNull(parentBlock.container)

  const container =
    parentBlockContainer === BlockPath.Container.MAIN ? "main" : "sidebar"
  const deltaPath = [...parentBlockPath, metadata.deltaId]

  dispatchOneOf(delta, "type", {
    newElement: (element: SimpleElement) => {
      elements[container] = elements[container].setIn(
        deltaPath,
        handleNewElementMessage(container, element, reportId, metadata)
      )
    },
    newBlock: () => {
      elements[container] = elements[container].updateIn(deltaPath, element =>
        handleNewBlockMessage(container, element)
      )
    },
    addRows: (namedDataSet: NamedDataSet) => {
      elements[container] = elements[container].updateIn(deltaPath, element =>
        handleAddRowsMessage(container, element, namedDataSet)
      )
    },
  })

  return elements
}

function handleNewElementMessage(
  container: Container,
  element: SimpleElement,
  reportId: string,
  metadata: ForwardMsgMetadata
): SimpleElement {
  MetricsManager.current.incrementDeltaCounter(container)
  MetricsManager.current.incrementDeltaCounter(element.get("type"))
  // Set reportId on elements so we can clear old elements
  // when the report script is re-executed.
  // Set metadata on elements so that we can use them downstream.
  return element.set("reportId", reportId).set("metadata", metadata)
}

function handleNewBlockMessage(
  container: Container,
  element: BlockElement
): BlockElement {
  MetricsManager.current.incrementDeltaCounter(container)
  MetricsManager.current.incrementDeltaCounter("new block")
  if (element instanceof List) {
    return element
  }
  return List()
}

function handleAddRowsMessage(
  container: Container,
  element: SimpleElement,
  namedDataSet: NamedDataSet
): SimpleElement {
  MetricsManager.current.incrementDeltaCounter(container)
  MetricsManager.current.incrementDeltaCounter("add rows")
  return addRows(element, namedDataSet)
}
