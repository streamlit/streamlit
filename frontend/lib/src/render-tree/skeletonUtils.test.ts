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

import {
  Block as BlockProto,
  Delta as DeltaProto,
  Element,
  ForwardMsgMetadata,
} from "@streamlit/protobuf"

import type { AppNode } from "./AppNode.interface"
import { AppRoot } from "./AppRoot"
import { BlockNode } from "./BlockNode"
import { ElementNode } from "./ElementNode"
import { keepPreviousContentForSkeleton } from "./skeletonUtils"
import {
  block,
  FAKE_SCRIPT_HASH,
  forwardMsgMetadata,
  makeProto,
  text,
} from "./test-utils"
import { TransientNode } from "./TransientNode"
import { GetNodeByDeltaPathVisitor } from "./visitors/GetNodeByDeltaPathVisitor"

const PREVIOUS_RUN = "previous_run"
const CURRENT_RUN = "current_run"

function elementNode(
  properties: Record<string, unknown>,
  scriptRunId: string
): ElementNode {
  return new ElementNode(
    makeProto(Element, properties),
    ForwardMsgMetadata.create(),
    scriptRunId,
    FAKE_SCRIPT_HASH
  )
}

function skeleton(scriptRunId = CURRENT_RUN): ElementNode {
  return elementNode({ skeleton: {} }, scriptRunId)
}

function container(children: AppNode[], scriptRunId: string): BlockNode {
  return new BlockNode(
    FAKE_SCRIPT_HASH,
    children,
    makeProto(BlockProto, { flexContainer: {} }),
    scriptRunId
  )
}

describe("keepPreviousContentForSkeleton", () => {
  it("keeps a previous run's container that holds visible content", () => {
    const previous = container([text("chart", PREVIOUS_RUN)], PREVIOUS_RUN)
    const incoming = skeleton()

    const kept = keepPreviousContentForSkeleton(previous, incoming)

    expect(kept).toBeInstanceOf(BlockNode)
    expect((kept as BlockNode).children).toBe(previous.children)
    expect((kept as BlockNode).pendingSkeleton).toBe(incoming)
  })

  it.each([
    ["content from the current run", text("chart", CURRENT_RUN)],
    ["a previous skeleton", skeleton(PREVIOUS_RUN)],
    [
      "a container without visible content",
      container([skeleton(PREVIOUS_RUN)], PREVIOUS_RUN),
    ],
    [
      "a block that isn't a flex container, such as an expander",
      block([text("chart", PREVIOUS_RUN)], PREVIOUS_RUN),
    ],
    ["an empty slot", undefined],
    ["a previous run's toast", elementNode({ toast: {} }, PREVIOUS_RUN)],
    ["a previous run's balloons", elementNode({ balloons: {} }, PREVIOUS_RUN)],
    ["a previous run's snow", elementNode({ snow: {} }, PREVIOUS_RUN)],
  ])("lets the skeleton replace %s", (_, existing) => {
    expect(
      keepPreviousContentForSkeleton(existing, skeleton())
    ).toBeUndefined()
  })

  it("keeps a transient wrapper's anchor and its running spinner", () => {
    const previous = text("chart", PREVIOUS_RUN)
    const spinner = elementNode(
      { spinner: { text: "Loading..." } },
      CURRENT_RUN
    )
    const wrapped = new TransientNode(CURRENT_RUN, previous, [spinner])

    const kept = keepPreviousContentForSkeleton(wrapped, skeleton())

    expect(kept).toBeInstanceOf(TransientNode)
    expect((kept as TransientNode).transientNodes).toEqual([spinner])
    const keptAnchor = (kept as TransientNode).anchor as ElementNode
    expect(keptAnchor.element).toBe(previous.element)
    expect(keptAnchor.pendingSkeleton).toBeDefined()
  })
})

describe("AppRoot with skeletons", () => {
  const PATH = [0]

  /** A root whose slot holds `previous` and this run's skeleton. */
  function skeletonOverPreviousChart(
    previous: AppNode = text("chart", PREVIOUS_RUN)
  ): AppRoot {
    return new AppRoot(
      FAKE_SCRIPT_HASH,
      new BlockNode(FAKE_SCRIPT_HASH, [
        block([previous], PREVIOUS_RUN),
        new BlockNode(FAKE_SCRIPT_HASH),
        new BlockNode(FAKE_SCRIPT_HASH),
        new BlockNode(FAKE_SCRIPT_HASH),
      ])
    ).applyDelta(
      CURRENT_RUN,
      makeProto(DeltaProto, { newElement: { skeleton: {} } }),
      forwardMsgMetadata([0, ...PATH])
    )
  }

  function nodeAtPath(root: AppRoot): AppNode | undefined {
    return GetNodeByDeltaPathVisitor.getNodeAtPath(root.main, PATH)
  }

  it("keeps the previous content mounted under a skeleton", () => {
    const node = nodeAtPath(skeletonOverPreviousChart()) as ElementNode

    expect(node).toBeTextNode("chart")
    expect(node.pendingSkeleton?.element.type).toBe("skeleton")
  })

  it("replaces the waiting content when new content arrives", () => {
    const root = skeletonOverPreviousChart().applyDelta(
      CURRENT_RUN,
      makeProto(DeltaProto, { newElement: { text: { body: "new chart" } } }),
      forwardMsgMetadata([0, ...PATH])
    )

    const node = nodeAtPath(root) as ElementNode
    expect(node).toBeTextNode("new chart")
    expect(node.pendingSkeleton).toBeUndefined()
  })

  it.each([
    ["an element", text("chart", PREVIOUS_RUN)],
    ["a container", container([text("chart", PREVIOUS_RUN)], PREVIOUS_RUN)],
  ])(
    "lets the skeleton take %s's slot if no content arrives this run",
    (_, previous) => {
      const root =
        skeletonOverPreviousChart(previous).clearStaleNodes(CURRENT_RUN)

      expect((nodeAtPath(root) as ElementNode).element.type).toBe("skeleton")
    }
  )
})
