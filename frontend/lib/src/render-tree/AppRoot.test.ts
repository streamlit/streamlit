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

import { NO_SCRIPT_RUN_ID } from "./AppNode.interface"
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

describe("AppRoot", () => {
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

    it("creates empty tree with no loading screen if query param is set", () => {
      windowSpy.mockImplementation(() => ({
        location: {
          search: "?embed_options=hide_loading_screen",
        },
      }))

      const empty = AppRoot.empty(FAKE_SCRIPT_HASH)

      expect(empty.main.isEmpty).toBe(true)
      expect(empty.sidebar.isEmpty).toBe(true)
    })

    it("creates empty tree with v1 loading screen if query param is set", () => {
      windowSpy.mockImplementation(() => ({
        location: {
          search: "?embed_options=show_loading_screen_v1",
        },
      }))

      const empty = AppRoot.empty(FAKE_SCRIPT_HASH)

      expect(empty.main.children.length).toBe(1)
      const child = empty.main.getIn([0]) as ElementNode
      expect(child.element.alert).toBeDefined()

      expect(empty.sidebar.isEmpty).toBe(true)
    })

    it("creates empty tree with v2 loading screen if query param is set", () => {
      windowSpy.mockImplementation(() => ({
        location: {
          search: "?embed_options=show_loading_screen_v2",
        },
      }))

      const empty = AppRoot.empty(FAKE_SCRIPT_HASH)

      expect(empty.main.children.length).toBe(1)
      const child = empty.main.getIn([0]) as ElementNode
      expect(child.element.skeleton).not.toBeNull()

      expect(empty.sidebar.isEmpty).toBe(true)
    })

    it("creates empty tree with no loading screen if query param is v1 and it's not first load", () => {
      windowSpy.mockImplementation(() => ({
        location: {
          search: "?embed_options=show_loading_screen_v1",
        },
      }))

      const empty = AppRoot.empty(FAKE_SCRIPT_HASH, false)

      expect(empty.main.isEmpty).toBe(true)
      expect(empty.sidebar.isEmpty).toBe(true)
    })

    it("passes logo to new Root if empty is called with logo", () => {
      windowSpy.mockImplementation(() => ({
        location: {
          search: "",
        },
      }))
      const logo = LogoProto.create({
        image:
          "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png",
      })

      // Replicate .empty call on initial render
      const empty = AppRoot.empty("", true)
      expect(empty.logo).toBeNull()

      // Replicate .empty call in AppNav's clearPageElements for MPA V1
      const empty2 = AppRoot.empty(FAKE_SCRIPT_HASH, false, undefined, logo)
      expect(empty2.logo).not.toBeNull()
    })
  })

  describe("AppRoot.filterMainScriptElements", () => {
    it("does not clear nodes associated with main script hash", () => {
      // Add a new element and clear stale nodes
      const delta = makeProto(DeltaProto, {
        newElement: { text: { body: "newElement!" } },
      })
      const newRoot = ROOT.applyDelta(
        "new_session_id",
        delta,
        forwardMsgMetadata([0, 1, 1])
      ).filterMainScriptElements(FAKE_SCRIPT_HASH)

      // We should now only have a single element, inside a single block
      expect(newRoot.main.getIn([1, 1])).toBeTextNode("newElement!")
      expect(newRoot.getElements().size).toBe(3)
    })

    it("clears nodes not associated with main script hash", () => {
      // Add a new element and clear stale nodes
      const delta = makeProto(DeltaProto, {
        newElement: { text: { body: "newElement!" } },
      })
      const newRoot = ROOT.applyDelta(
        "new_session_id",
        delta,
        forwardMsgMetadata([0, 1, 1], "DIFFERENT_HASH")
      ).filterMainScriptElements(FAKE_SCRIPT_HASH)

      // We should now only have a single element, inside a single block
      expect(newRoot.main.getIn([1, 1])).toBeUndefined()
      expect(newRoot.getElements().size).toBe(2)
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

      // Check that our new scriptRunId has been set only on the touched nodes
      expect(newRoot.main.scriptRunId).toBe("new_session_id")
      expect(newRoot.main.fragmentId).toBe(undefined)
      expect(newRoot.main.deltaMsgReceivedAt).toBe(undefined)
      expect(newRoot.main.getIn([0])?.scriptRunId).toBe(NO_SCRIPT_RUN_ID)
      expect(newRoot.main.getIn([1])?.scriptRunId).toBe("new_session_id")
      expect(newRoot.main.getIn([1, 0])?.scriptRunId).toBe(NO_SCRIPT_RUN_ID)
      expect(newRoot.main.getIn([1, 1])?.scriptRunId).toBe("new_session_id")
      expect(newNode.activeScriptHash).toBe(FAKE_SCRIPT_HASH)
      expect(newRoot.sidebar.scriptRunId).toBe(NO_SCRIPT_RUN_ID)
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

      // Check that our new scriptRunId has been set only on the touched nodes
      expect(newRoot.main.scriptRunId).toBe("new_session_id")
      expect(newRoot.main.fragmentId).toBe(undefined)
      expect(newRoot.main.deltaMsgReceivedAt).toBe(undefined)
      expect(newRoot.main.getIn([0])?.scriptRunId).toBe(NO_SCRIPT_RUN_ID)
      expect(newRoot.main.getIn([1])?.scriptRunId).toBe("new_session_id")
      expect(newRoot.main.getIn([1, 0])?.scriptRunId).toBe(NO_SCRIPT_RUN_ID)
      expect(newRoot.main.getIn([1, 1])?.scriptRunId).toBe("new_session_id")
      expect(newNode.activeScriptHash).toBe(FAKE_SCRIPT_HASH)
      expect(newRoot.sidebar.scriptRunId).toBe(NO_SCRIPT_RUN_ID)
    })

    it("removes a block's children if the block type changes for the same delta path", () => {
      const newRoot = ROOT.applyDelta(
        "script_run_id",
        makeProto(DeltaProto, {
          addBlock: {
            expandable: {
              expanded: true,
              label: "label",
              icon: "",
            },
          },
        }),
        forwardMsgMetadata([0, 1, 1])
      ).applyDelta(
        "script_run_id",
        makeProto(DeltaProto, {
          newElement: { text: { body: "newElement!" } },
        }),
        forwardMsgMetadata([0, 1, 1, 0])
      )

      const newNode = newRoot.main.getIn([1, 1]) as BlockNode
      expect(newNode).toBeDefined()
      expect(newNode.deltaBlock.type).toBe("expandable")
      expect(newNode.children.length).toBe(1)

      const newRoot2 = newRoot.applyDelta(
        "new_script_run_id",
        makeProto(DeltaProto, {
          addBlock: {
            tabContainer: {},
          },
        }),
        forwardMsgMetadata([0, 1, 1])
      )

      const replacedBlock = newRoot2.main.getIn([1, 1]) as BlockNode
      expect(replacedBlock).toBeDefined()
      expect(replacedBlock.deltaBlock.type).toBe("tabContainer")
      expect(replacedBlock.children.length).toBe(0)
    })

    it("will not remove a block's children if the block type is the same for the same delta path", () => {
      const newRoot = ROOT.applyDelta(
        "script_run_id",
        makeProto(DeltaProto, {
          addBlock: {
            expandable: {
              expanded: true,
              label: "label",
              icon: "",
            },
          },
        }),
        forwardMsgMetadata([0, 1, 1])
      ).applyDelta(
        "script_run_id",
        makeProto(DeltaProto, {
          newElement: { text: { body: "newElement!" } },
        }),
        forwardMsgMetadata([0, 1, 1, 0])
      )

      const newNode = newRoot.main.getIn([1, 1]) as BlockNode
      expect(newNode).toBeDefined()
      expect(newNode.deltaBlock.type).toBe("expandable")
      expect(newNode.children.length).toBe(1)

      const newRoot2 = newRoot.applyDelta(
        "new_script_run_id",
        makeProto(DeltaProto, {
          addBlock: {
            expandable: {
              expanded: true,
              label: "other label",
              icon: "",
            },
          },
        }),
        forwardMsgMetadata([0, 1, 1])
      )

      const replacedBlock = newRoot2.main.getIn([1, 1]) as BlockNode
      expect(replacedBlock).toBeDefined()
      expect(replacedBlock.deltaBlock.type).toBe("expandable")
      expect(replacedBlock.children.length).toBe(1)
    })

    it("specifies active script hash on 'newElement' deltas", () => {
      const delta = makeProto(DeltaProto, {
        newElement: { text: { body: "newElement!" } },
      })
      const NEW_FAKE_SCRIPT_HASH = "new_fake_script_hash"
      const newRoot = ROOT.applyDelta(
        "new_session_id",
        delta,
        forwardMsgMetadata([0, 1, 1], NEW_FAKE_SCRIPT_HASH)
      )

      const newNode = newRoot.main.getIn([1, 1]) as ElementNode
      expect(newNode).toBeDefined()

      // Check that our new other nodes are not affected by the new script hash
      expect(newRoot.main.getIn([1, 0])?.activeScriptHash).toBe(
        FAKE_SCRIPT_HASH
      )
      expect(newNode.activeScriptHash).toBe(NEW_FAKE_SCRIPT_HASH)
    })

    it("specifies active script hash on 'addBlock' deltas", () => {
      const delta = makeProto(DeltaProto, { addBlock: {} })
      const NEW_FAKE_SCRIPT_HASH = "new_fake_script_hash"
      const newRoot = ROOT.applyDelta(
        "new_session_id",
        delta,
        forwardMsgMetadata([0, 1, 1], NEW_FAKE_SCRIPT_HASH)
      )

      const newNode = newRoot.main.getIn([1, 1]) as BlockNode
      expect(newNode).toBeDefined()

      // Check that our new scriptRunId has been set only on the touched nodes
      expect(newRoot.main.getIn([1, 0])?.activeScriptHash).toBe(
        FAKE_SCRIPT_HASH
      )
      expect(newNode.activeScriptHash).toBe(NEW_FAKE_SCRIPT_HASH)
    })

    it("can set fragmentId in 'newElement' deltas", () => {
      const delta = makeProto(DeltaProto, {
        newElement: { text: { body: "newElement!" } },
        fragmentId: "myFragmentId",
      })
      const newRoot = ROOT.applyDelta(
        "new_session_id",
        delta,
        forwardMsgMetadata([0, 1, 1])
      )

      const newNode = newRoot.main.getIn([1, 1]) as ElementNode
      expect(newNode.fragmentId).toBe("myFragmentId")
    })

    it("can set fragmentId in 'addBlock' deltas", () => {
      const delta = makeProto(DeltaProto, {
        addBlock: {},
        fragmentId: "myFragmentId",
      })
      const newRoot = ROOT.applyDelta(
        "new_session_id",
        delta,
        forwardMsgMetadata([0, 1, 1])
      )

      const newNode = newRoot.main.getIn([1, 1]) as BlockNode
      expect(newNode.fragmentId).toBe("myFragmentId")
    })

    it("timestamp is set on BlockNode as message id", () => {
      const timestamp = new Date(Date.UTC(2017, 1, 14)).valueOf()
      Date.now = vi.fn(() => timestamp)
      const delta = makeProto(DeltaProto, {
        addBlock: {},
      })
      const newRoot = ROOT.applyDelta(
        "new_session_id",
        delta,
        forwardMsgMetadata([0, 1, 1])
      )

      const newNode = newRoot.main.getIn([1, 1]) as BlockNode
      expect(newNode.deltaMsgReceivedAt).toBe(timestamp)
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

    it("does not clear logo on fragment run", () => {
      const logo = LogoProto.create({
        image:
          "https://global.discourse-cdn.com/business7/uploads/streamlit/original/2X/8/8cb5b6c0e1fe4e4ebfd30b769204c0d30c332fec.png",
      })
      const newRoot = ROOT.appRootWithLogo(logo, {
        activeScriptHash: "hash",
        scriptRunId: "script_run_id",
      })
      expect(newRoot.logo).not.toBeNull()

      const newNewRoot = newRoot.clearStaleNodes("new_script_run_id", [
        "my_fragment_id",
      ])
      expect(newNewRoot.logo).not.toBeNull()
    })

    it("handles currentFragmentId correctly", () => {
      const tabContainerProto = makeProto(DeltaProto, {
        addBlock: { tabContainer: {}, allowEmpty: false },
        fragmentId: "my_fragment_id",
      })
      const tab1 = makeProto(DeltaProto, {
        addBlock: { tab: { label: "tab1" }, allowEmpty: true },
        fragmentId: "my_fragment_id",
      })
      const tab2 = makeProto(DeltaProto, {
        addBlock: { tab: { label: "tab2" }, allowEmpty: true },
        fragmentId: "my_fragment_id",
      })

      // const BLOCK = block([text("1"), block([text("2")])])
      const root = AppRoot.empty(FAKE_SCRIPT_HASH)
        // Block not corresponding to my_fragment_id. Should be preserved.
        .applyDelta(
          "old_session_id",
          makeProto(DeltaProto, { addBlock: { allowEmpty: true } }),
          forwardMsgMetadata([0, 0])
        )
        // Element in block unrelated to my_fragment_id. Should be preserved.
        .applyDelta(
          "old_session_id",
          makeProto(DeltaProto, {
            newElement: { text: { body: "oldElement!" } },
          }),
          forwardMsgMetadata([0, 0, 0])
        )
        // Another element in block unrelated to my_fragment_id. Should be preserved.
        .applyDelta(
          "old_session_id",
          makeProto(DeltaProto, {
            newElement: { text: { body: "oldElement2!" } },
            fragmentId: "other_fragment_id",
          }),
          forwardMsgMetadata([0, 0, 1])
        )
        // Old element related to my_fragment_id but in an unrelated block. Should be preserved.
        .applyDelta(
          "old_session_id",
          makeProto(DeltaProto, {
            newElement: { text: { body: "oldElement4!" } },
            fragmentId: "my_fragment_id",
          }),
          forwardMsgMetadata([0, 0, 2])
        )
        // Block corresponding to my_fragment_id
        .applyDelta(
          "new_session_id",
          makeProto(DeltaProto, {
            addBlock: { allowEmpty: false },
            fragmentId: "my_fragment_id",
          }),
          forwardMsgMetadata([0, 1])
        )
        // Old element related to my_fragment_id. Should be pruned.
        .applyDelta(
          "old_session_id",
          makeProto(DeltaProto, {
            newElement: { text: { body: "oldElement3!" } },
            fragmentId: "my_fragment_id",
          }),
          forwardMsgMetadata([0, 1, 0])
        )
        // New element related to my_fragment_id. Should be preserved.
        .applyDelta(
          "new_session_id",
          makeProto(DeltaProto, {
            newElement: { text: { body: "newElement!" } },
            fragmentId: "my_fragment_id",
          }),
          forwardMsgMetadata([0, 1, 1])
        )
        // New element container related to my_fragment_id, having children which will be handled individually
        // Create a tab container with two tabs in the old session; then send new delta with the container and
        // only one tab. The second tab with the old_session_id should be pruned.
        .applyDelta(
          "old_session_id",
          tabContainerProto,
          forwardMsgMetadata([0, 2])
        )
        .applyDelta("old_session_id", tab1, forwardMsgMetadata([0, 2, 0]))
        .applyDelta("old_session_id", tab2, forwardMsgMetadata([0, 2, 1]))
        .applyDelta(
          "new_session_id",
          tabContainerProto,
          forwardMsgMetadata([0, 2])
        )
        .applyDelta("new_session_id", tab1, forwardMsgMetadata([0, 2, 0]))

      const pruned = root.clearStaleNodes("new_session_id", ["my_fragment_id"])

      expect(pruned.main.getIn([0])).toBeInstanceOf(BlockNode)
      expect((pruned.main.getIn([0]) as BlockNode).children).toHaveLength(3)
      expect(pruned.main.getIn([0, 0])).toBeTextNode("oldElement!")
      expect(pruned.main.getIn([0, 1])).toBeTextNode("oldElement2!")
      expect(pruned.main.getIn([0, 2])).toBeTextNode("oldElement4!")

      expect(pruned.main.getIn([1])).toBeInstanceOf(BlockNode)
      expect((pruned.main.getIn([1]) as BlockNode).children).toHaveLength(1)
      expect(pruned.main.getIn([1, 0])).toBeTextNode("newElement!")

      expect(pruned.main.getIn([2])).toBeInstanceOf(BlockNode)
      expect((pruned.main.getIn([2]) as BlockNode).children).toHaveLength(1)
      expect(
        (pruned.main.getIn([2, 0]) as BlockNode).deltaBlock.tab?.label
      ).toContain("tab1")
    })

    it("clear childNodes of a block node in fragment run", () => {
      // Add a new element and clear stale nodes
      const delta = makeProto(DeltaProto, {
        newElement: { text: { body: "newElement!" } },
        fragmentId: "my_fragment_id",
      })
      const newRoot = AppRoot.empty(FAKE_SCRIPT_HASH)
        // Block corresponding to my_fragment_id
        .applyDelta(
          "new_session_id",
          makeProto(DeltaProto, {
            addBlock: { vertical: {}, allowEmpty: false },
            fragmentId: "my_fragment_id",
          }),
          forwardMsgMetadata([0, 0])
        )
        .applyDelta("new_session_id", delta, forwardMsgMetadata([0, 0, 0]))
        // Block with child where scriptRunId is different
        .applyDelta(
          "new_session_id",
          makeProto(DeltaProto, {
            addBlock: { vertical: {}, allowEmpty: false },
            fragmentId: "my_fragment_id",
          }),
          forwardMsgMetadata([0, 1])
        )
        .applyDelta("new_session_id", delta, forwardMsgMetadata([0, 1, 0]))
        .applyDelta("new_session_id", delta, forwardMsgMetadata([0, 1, 1]))
        // this child is a nested fragment_id from an old run and should be pruned
        .applyDelta(
          "old_session_id",
          makeProto(DeltaProto, {
            newElement: { text: { body: "oldElement!" } },
            fragmentId: "my_nested_fragment_id",
          }),
          forwardMsgMetadata([0, 1, 2])
        )
        // this child is a nested fragment_id from the same run and should be preserved
        .applyDelta(
          "new_session_id",
          makeProto(DeltaProto, {
            newElement: { text: { body: "newElement!" } },
            fragmentId: "my_nested_fragment_id",
          }),
          forwardMsgMetadata([0, 1, 3])
        )

      expect((newRoot.main.getIn([1]) as BlockNode).children).toHaveLength(4)

      const pruned = newRoot.clearStaleNodes("new_session_id", [
        "my_fragment_id",
      ])

      expect(pruned.main.getIn([0])).toBeInstanceOf(BlockNode)
      expect((pruned.main.getIn([0]) as BlockNode).children).toHaveLength(1)
      expect(pruned.main.getIn([1])).toBeInstanceOf(BlockNode)
      // the stale nested fragment child should have been pruned
      expect((pruned.main.getIn([1]) as BlockNode).children).toHaveLength(3)
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
})
