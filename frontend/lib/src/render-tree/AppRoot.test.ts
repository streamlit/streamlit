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

import { MockInstance } from "vitest"

import { Delta as DeltaProto, Logo as LogoProto } from "@streamlit/protobuf"

import { AppRoot } from "./AppRoot"
import { BlockNode } from "./BlockNode"
import { ElementNode } from "./ElementNode"
import {
  block,
  FAKE_SCRIPT_HASH,
  forwardMsgMetadata,
  makeProto,
  text,
} from "./test-utils"

// prettier-ignore
const BLOCK = block([
  text("1"),
  block([
    text("2"),
  ]),
])

// Initialize new AppRoot with a main block node and three child block nodes - sidebar, events and bottom.
const ROOT = new AppRoot(
  FAKE_SCRIPT_HASH,
  new BlockNode(FAKE_SCRIPT_HASH, [
    BLOCK,
    new BlockNode(FAKE_SCRIPT_HASH),
    new BlockNode(FAKE_SCRIPT_HASH),
    new BlockNode(FAKE_SCRIPT_HASH),
  ])
)

describe("AppRoot.empty", () => {
  let windowSpy: MockInstance

  beforeEach(() => {
    windowSpy = vi.spyOn(window, "window", "get")
  })

  afterEach(() => {
    windowSpy.mockRestore()
  })

  it("creates empty tree except for a skeleton", () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search: "",
      },
    }))
    const empty = AppRoot.empty(FAKE_SCRIPT_HASH)

    expect(empty.main.children.length).toBe(1)
    const child = empty.main.getIn([0]) as ElementNode
    expect(child.element.skeleton).not.toBeNull()

    expect(empty.sidebar.isEmpty).toBe(true)
  })

  it("sets the main script hash and active script hash", () => {
    windowSpy.mockImplementation(() => ({
      location: {
        search: "",
      },
    }))
    const empty = AppRoot.empty(FAKE_SCRIPT_HASH)

    expect(empty.mainScriptHash).toBe(FAKE_SCRIPT_HASH)
    expect(empty.main.activeScriptHash).toBe(FAKE_SCRIPT_HASH)
    expect(empty.sidebar.activeScriptHash).toBe(FAKE_SCRIPT_HASH)
    expect(empty.event.activeScriptHash).toBe(FAKE_SCRIPT_HASH)
    expect(empty.bottom.activeScriptHash).toBe(FAKE_SCRIPT_HASH)
    expect(empty.root.activeScriptHash).toBe(FAKE_SCRIPT_HASH)
  })
})

describe("AppRoot.applyDelta", () => {
  it("handles 'newElement' deltas", () => {
    const delta = makeProto(DeltaProto, {
      newElement: { text: { body: "newElement!" } },
    })
    const newRoot = ROOT.applyDelta(
      "new_session_id",
      delta,
      forwardMsgMetadata([0, 1, 1])
    )

    const newNode = newRoot.main.getIn([1, 1]) as ElementNode
    expect(newNode).toBeTextNode("newElement!")
  })

  it("handles 'addBlock' deltas", () => {
    const delta = makeProto(DeltaProto, { addBlock: {} })
    const newRoot = ROOT.applyDelta(
      "new_session_id",
      delta,
      forwardMsgMetadata([0, 1, 1])
    )

    const newNode = newRoot.main.getIn([1, 1]) as BlockNode
    expect(newNode).toBeDefined()
  })
})

describe("AppRoot.clearStaleNodes", () => {
  it("clears stale nodes", () => {
    // Add a new element and clear stale nodes
    const delta = makeProto(DeltaProto, {
      newElement: { text: { body: "newElement!" } },
    })
    const newRoot = ROOT.applyDelta(
      "new_session_id",
      delta,
      forwardMsgMetadata([0, 1, 1])
    ).clearStaleNodes("new_session_id", [])

    // We should now only have a single element, inside a single block
    expect(newRoot.main.getIn([0, 0])).toBeTextNode("newElement!")
    expect(newRoot.getElements().size).toBe(1)
  })

  it("clears a stale logo", () => {
    const logo = LogoProto.create({
      image:
        "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png",
    })
    const newRoot = ROOT.appRootWithLogo(logo, {
      activeScriptHash: "hash",
      scriptRunId: "script_run_id",
    })
    expect(newRoot.logo).not.toBeNull()

    const newNewRoot = newRoot.clearStaleNodes("new_script_run_id", [])
    expect(newNewRoot.logo).toBeNull()
  })

  it("uses ClearStaleNodeVisitor internally", () => {
    // Create a more complex tree with multiple nodes
    const delta1 = makeProto(DeltaProto, {
      newElement: { text: { body: "element1" } },
    })
    const delta2 = makeProto(DeltaProto, {
      newElement: { text: { body: "element2" } },
    })

    // Add elements with different script run IDs
    const rootWithElements = ROOT.applyDelta(
      "run_id_1",
      delta1,
      forwardMsgMetadata([0, 0])
    ).applyDelta("run_id_2", delta2, forwardMsgMetadata([0, 1]))

    // Before clearing: should have both elements
    expect(rootWithElements.getElements().size).toBe(2) // 2 new elements

    // Clear stale nodes - only keep elements from run_id_2
    const clearedRoot = rootWithElements.clearStaleNodes("run_id_2", [])

    // After clearing: should only have element2 (from run_id_2)
    expect(clearedRoot.getElements().size).toBe(1)
    expect(clearedRoot.main.getIn([0])).toBeTextNode("element2")
  })

  it("preserves non-stale nodes during visitor traversal", () => {
    const delta = makeProto(DeltaProto, {
      newElement: { text: { body: "current_element" } },
    })
    const currentRunId = "current_run"

    const rootWithCurrent = ROOT.applyDelta(
      currentRunId,
      delta,
      forwardMsgMetadata([0, 0])
    )

    // Clear stale nodes with same run ID - element should be preserved
    const clearedRoot = rootWithCurrent.clearStaleNodes(currentRunId, [])

    expect(clearedRoot.main.getIn([0])).toBeTextNode("current_element")
    expect(clearedRoot.getElements().size).toBe(1)
  })
})

describe("AppRoot.getElements", () => {
  it("returns all elements", () => {
    // We have elements at main.[0] and main.[1, 0]
    expect(ROOT.getElements()).toEqual(
      new Set([
        (ROOT.main.getIn([0]) as ElementNode).element,
        (ROOT.main.getIn([1, 0]) as ElementNode).element,
      ])
    )
  })
})
