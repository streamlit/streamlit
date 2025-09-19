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
import { ElementsSetVisitor } from "./visitors/ElementsSetVisitor"

// prettier-ignore
const BLOCK = block([
  text("1"),
  block([
    text("2"),
  ]),
])

// Initialize new AppRoot with a main block node and three child block nodes - sidebar, events and bottom.
const ROOT = new AppRoot(FAKE_SCRIPT_HASH, {
  main: BLOCK,
  sidebar: new BlockNode(FAKE_SCRIPT_HASH),
  event: new BlockNode(FAKE_SCRIPT_HASH),
  bottom: new BlockNode(FAKE_SCRIPT_HASH),
})

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
  it("returns all elements using ElementsSetVisitor", () => {
    // We have elements at main.[0] and main.[1, 0]
    expect(ROOT.getElements()).toEqual(
      new Set([
        (ROOT.main.getIn([0]) as ElementNode).element,
        (ROOT.main.getIn([1, 0]) as ElementNode).element,
      ])
    )
  })

  it("uses visitor pattern internally", () => {
    // Create a more complex structure to test visitor traversal
    const delta1 = makeProto(DeltaProto, {
      newElement: { text: { body: "main_element" } },
    })
    const delta2 = makeProto(DeltaProto, {
      newElement: { text: { body: "sidebar_element" } },
    })

    const rootWithElements = ROOT.applyDelta(
      "test_run",
      delta1,
      forwardMsgMetadata([0, 0]) // main section
    ).applyDelta(
      "test_run",
      delta2,
      forwardMsgMetadata([1, 0]) // sidebar section
    )

    const elements = rootWithElements.getElements()

    // Should find elements from main, sidebar, and the original ROOT elements
    expect(elements.size).toBe(3) // 2 original + 1 new (second overwrites first)

    // Verify we can find the sidebar element specifically
    const elementsArray = Array.from(elements)
    const sidebarElement = elementsArray.find(
      el => el.text?.body === "sidebar_element"
    )

    expect(sidebarElement).toBeDefined()
  })

  it("demonstrates visitor pattern flexibility", () => {
    // Show that we can use ElementsSetVisitor directly on parts of the tree
    const mainElements = ElementsSetVisitor.collectElements(ROOT.main)
    const sidebarElements = ElementsSetVisitor.collectElements(ROOT.sidebar)

    // Should have elements in main, none in sidebar for basic ROOT
    expect(mainElements.size).toBe(2) // The original elements from ROOT
    expect(sidebarElements.size).toBe(0)

    // Combined should equal getElements() result
    const combinedSize = mainElements.size + sidebarElements.size
    expect(ROOT.getElements().size).toBe(combinedSize)
  })
})
