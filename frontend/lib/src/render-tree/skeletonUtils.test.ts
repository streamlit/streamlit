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
import {
  getLoadingBlockState,
  hasVisibleContentFromRun,
  keepPreviousContentForSkeleton,
} from "./skeletonUtils"
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

function labeledSpinner(
  label: string,
  scriptRunId = CURRENT_RUN
): ElementNode {
  return elementNode(
    { spinner: { text: label, skeletonLabel: true } },
    scriptRunId
  )
}

function loadingBlock(
  children: AppNode[],
  scriptRunId = CURRENT_RUN
): BlockNode {
  return new BlockNode(
    FAKE_SCRIPT_HASH,
    children,
    makeProto(BlockProto, { flexContainer: {}, loading: {} }),
    scriptRunId
  )
}

describe("keepPreviousContentForSkeleton", () => {
  it("keeps a previous run's element and attaches the skeleton", () => {
    const previous = text("chart", PREVIOUS_RUN)
    const incoming = skeleton()

    const kept = keepPreviousContentForSkeleton(previous, incoming)

    expect(kept).toBeInstanceOf(ElementNode)
    expect((kept as ElementNode).element).toBe(previous.element)
    expect((kept as ElementNode).scriptRunId).toBe(PREVIOUS_RUN)
    expect((kept as ElementNode).pendingSkeleton).toBe(incoming)
  })

  it("keeps a previous run's block that holds visible content", () => {
    const previous = block([text("chart", PREVIOUS_RUN)], PREVIOUS_RUN)

    const kept = keepPreviousContentForSkeleton(previous, skeleton())

    expect(kept).toBeInstanceOf(BlockNode)
    expect((kept as BlockNode).children).toBe(previous.children)
  })

  it.each([
    ["content from the current run", text("chart", CURRENT_RUN)],
    ["a previous skeleton", skeleton(PREVIOUS_RUN)],
    [
      "a block without visible content",
      block([skeleton(PREVIOUS_RUN)], PREVIOUS_RUN),
    ],
    ["an empty slot", undefined],
  ])("lets the skeleton replace %s", (_, existing) => {
    expect(
      keepPreviousContentForSkeleton(existing, skeleton())
    ).toBeUndefined()
  })

  it("looks through a transient wrapper to its anchor", () => {
    const previous = text("chart", PREVIOUS_RUN)
    const wrapped = new TransientNode(CURRENT_RUN, previous, [])

    const kept = keepPreviousContentForSkeleton(wrapped, skeleton())

    expect((kept as ElementNode).element).toBe(previous.element)
  })
})

describe("hasVisibleContentFromRun", () => {
  it("ignores skeletons, empties, and transient spinners", () => {
    const node = block(
      [
        skeleton(),
        elementNode({ empty: {} }, CURRENT_RUN),
        new TransientNode(CURRENT_RUN, text("old", PREVIOUS_RUN), [
          labeledSpinner("Loading"),
        ]),
      ],
      CURRENT_RUN
    )

    expect(hasVisibleContentFromRun(node, CURRENT_RUN)).toBe(false)
    expect(hasVisibleContentFromRun(node, PREVIOUS_RUN)).toBe(true)
  })
})

describe("getLoadingBlockState", () => {
  it("is pending while the run hasn't drawn into the block", () => {
    const node = loadingBlock([])

    expect(getLoadingBlockState(node, CURRENT_RUN, true)).toEqual({
      isPending: true,
      hasPreviousContent: false,
      label: undefined,
    })
  })

  it("keeps a previous run's content and reports it", () => {
    const node = loadingBlock([text("chart", PREVIOUS_RUN)])

    const state = getLoadingBlockState(node, CURRENT_RUN, true)

    expect(state.isPending).toBe(true)
    expect(state.hasPreviousContent).toBe(true)
  })

  it("stops pending once the run draws visible content", () => {
    const node = loadingBlock([text("chart", CURRENT_RUN)])

    expect(getLoadingBlockState(node, CURRENT_RUN, true).isPending).toBe(false)
  })

  it.each([
    ["the run has ended", loadingBlock([]), CURRENT_RUN, false],
    [
      "the block is from a previous run",
      loadingBlock([], PREVIOUS_RUN),
      CURRENT_RUN,
      true,
    ],
    [
      "the block has no loading field",
      block([], CURRENT_RUN),
      CURRENT_RUN,
      true,
    ],
  ])("is not pending when %s", (_, node, scriptRunId, isRunning) => {
    expect(getLoadingBlockState(node, scriptRunId, isRunning).isPending).toBe(
      false
    )
  })

  it("labels the skeleton with a spinner from this run", () => {
    const node = loadingBlock([
      new TransientNode(CURRENT_RUN, undefined, [
        labeledSpinner("Fetching data..."),
      ]),
    ])

    expect(getLoadingBlockState(node, CURRENT_RUN, true).label).toBe(
      "Fetching data..."
    )
  })

  it("ignores spinners from previous runs", () => {
    const node = loadingBlock([
      new TransientNode(CURRENT_RUN, undefined, [
        labeledSpinner("Old", PREVIOUS_RUN),
      ]),
    ])

    expect(getLoadingBlockState(node, CURRENT_RUN, true).label).toBeUndefined()
  })
})

describe("AppRoot with skeletons", () => {
  const PATH = [0]

  function rootWith(child: AppNode): AppRoot {
    return new AppRoot(
      FAKE_SCRIPT_HASH,
      new BlockNode(FAKE_SCRIPT_HASH, [
        block([child], PREVIOUS_RUN),
        new BlockNode(FAKE_SCRIPT_HASH),
        new BlockNode(FAKE_SCRIPT_HASH),
        new BlockNode(FAKE_SCRIPT_HASH),
      ])
    )
  }

  function applySkeleton(root: AppRoot): AppRoot {
    return root.applyDelta(
      CURRENT_RUN,
      makeProto(DeltaProto, { newElement: { skeleton: {} } }),
      forwardMsgMetadata([0, ...PATH])
    )
  }

  function nodeAtPath(root: AppRoot): AppNode | undefined {
    return GetNodeByDeltaPathVisitor.getNodeAtPath(root.main, PATH)
  }

  it("keeps the previous content mounted under a skeleton", () => {
    const root = applySkeleton(rootWith(text("chart", PREVIOUS_RUN)))

    const node = nodeAtPath(root) as ElementNode
    expect(node).toBeTextNode("chart")
    expect(node.pendingSkeleton?.element.type).toBe("skeleton")
  })

  it("replaces the waiting content when new content arrives", () => {
    const root = applySkeleton(
      rootWith(text("chart", PREVIOUS_RUN))
    ).applyDelta(
      CURRENT_RUN,
      makeProto(DeltaProto, { newElement: { text: { body: "new chart" } } }),
      forwardMsgMetadata([0, ...PATH])
    )

    const node = nodeAtPath(root) as ElementNode
    expect(node).toBeTextNode("new chart")
    expect(node.pendingSkeleton).toBeUndefined()
  })

  it("lets the skeleton take the slot if no content arrives this run", () => {
    const root = applySkeleton(
      rootWith(text("chart", PREVIOUS_RUN))
    ).clearStaleNodes(CURRENT_RUN)

    expect((nodeAtPath(root) as ElementNode).element.type).toBe("skeleton")
  })

  it("replaces content from the current run as before", () => {
    const root = applySkeleton(rootWith(text("chart", CURRENT_RUN)))

    const node = nodeAtPath(root) as ElementNode
    expect(node.element.type).toBe("skeleton")
    expect(node.pendingSkeleton).toBeUndefined()
  })
})
