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

import { describe, expect, it } from "vitest"

import {
  Block as BlockProto,
  Delta as DeltaProto,
  Element,
  ForwardMsgMetadata,
} from "@streamlit/protobuf"

import { GENERATED_ELEMENT_ID_PREFIX, getElementId } from "~lib/util/utils"

import type { AppNode } from "./AppNode.interface"
import { AppRoot } from "./AppRoot"
import { BlockNode } from "./BlockNode"
import { ElementNode } from "./ElementNode"
import {
  getRetainedAfterRemoval,
  getRetainedAfterWrite,
  type RetainedElement,
  shiftRetainedAfter,
} from "./elementRetention"
import {
  block,
  blockWithId,
  FAKE_SCRIPT_HASH,
  forwardMsgMetadata,
  makeProto,
  text,
  textInput,
} from "./test-utils"
import { TransientNode } from "./TransientNode"

const PREV_RUN = "prev_run"
const CURRENT_RUN = "current_run"

/** The element ID that `textInput(label, id)` generates. */
const idOf = (id: string): string => `${GENERATED_ELEMENT_ID_PREFIX}-${id}-key`

function entry(id: string, before: number): RetainedElement {
  return { node: textInput(id, id, PREV_RUN), id: idOf(id), before }
}

/** Summarize entries as `id@before` for readable assertions. */
function summarize(retained: readonly RetainedElement[]): string[] {
  return retained.map(e => `${e.node.element.textInput?.label}@${e.before}`)
}

describe("getRetainedAfterWrite", () => {
  it("retains a prior-run keyed occupant displaced by a new element", () => {
    const retained = getRetainedAfterWrite({
      retained: [],
      index: 1,
      prev: textInput("w", "w", PREV_RUN),
      next: text("notice", CURRENT_RUN),
      scriptRunId: CURRENT_RUN,
    })

    expect(summarize(retained)).toEqual(["w@2"])
  })

  it("retains a prior-run keyed occupant displaced by a block", () => {
    const retained = getRetainedAfterWrite({
      retained: [],
      index: 0,
      prev: textInput("w", "w", PREV_RUN),
      next: block([], CURRENT_RUN),
      scriptRunId: CURRENT_RUN,
    })

    expect(summarize(retained)).toEqual(["w@1"])
  })

  it("drops an occupant written earlier in the same run", () => {
    const retained = getRetainedAfterWrite({
      retained: [],
      index: 1,
      prev: textInput("w", "w", CURRENT_RUN),
      next: text("replacement", CURRENT_RUN),
      scriptRunId: CURRENT_RUN,
    })

    expect(retained).toEqual([])
  })

  it("drops an occupant without an element ID", () => {
    const retained = getRetainedAfterWrite({
      retained: [],
      index: 1,
      prev: text("old", PREV_RUN),
      next: textInput("w", "w", CURRENT_RUN),
      scriptRunId: CURRENT_RUN,
    })

    expect(retained).toEqual([])
  })

  it.each(["audio", "video", "cameraInput", "audioInput"])(
    "drops a displaced %s element",
    type => {
      const element = makeProto(Element, {
        [type]: { id: `${GENERATED_ELEMENT_ID_PREFIX}-media-key` },
      })
      const prev = new ElementNode(
        element,
        ForwardMsgMetadata.create(),
        PREV_RUN,
        FAKE_SCRIPT_HASH
      )

      const retained = getRetainedAfterWrite({
        retained: [],
        index: 0,
        prev,
        next: text("notice", CURRENT_RUN),
        scriptRunId: CURRENT_RUN,
      })

      expect(retained).toEqual([])
    }
  )

  it.each([
    [true, []],
    [false, ["chat@1"]],
  ])(
    "retains a displaced chat input only without audio (acceptAudio=%s)",
    (acceptAudio, expected) => {
      const element = makeProto(Element, {
        chatInput: {
          id: `${GENERATED_ELEMENT_ID_PREFIX}-chat-key`,
          placeholder: "chat",
          acceptAudio,
        },
      })
      const prev = new ElementNode(
        element,
        ForwardMsgMetadata.create(),
        PREV_RUN,
        FAKE_SCRIPT_HASH
      )

      const retained = getRetainedAfterWrite({
        retained: [],
        index: 0,
        prev,
        next: text("notice", CURRENT_RUN),
        scriptRunId: CURRENT_RUN,
      })

      expect(
        retained.map(
          e => `${e.node.element.chatInput?.placeholder}@${e.before}`
        )
      ).toEqual(expected)
    }
  )

  it("drops a displaced element with a one-shot effect", () => {
    const prev = textInput("w", "w", PREV_RUN)
    prev.element.hasOneShotEffect = true

    const retained = getRetainedAfterWrite({
      retained: [],
      index: 0,
      prev,
      next: text("notice", CURRENT_RUN),
      scriptRunId: CURRENT_RUN,
    })

    expect(retained).toEqual([])
  })

  it("reclaims the entry when the same element ID is written", () => {
    const retained = getRetainedAfterWrite({
      retained: [entry("w", 2), entry("z", 2)],
      index: 2,
      prev: undefined,
      next: textInput("w", "w", CURRENT_RUN),
      scriptRunId: CURRENT_RUN,
    })

    // The reclaimed element renders at index 2, so the rest render after it.
    expect(summarize(retained)).toEqual(["z@3"])
  })

  it("reclaims an entry anchored in front of an earlier slot", () => {
    const retained = getRetainedAfterWrite({
      retained: [entry("w", 1), entry("z", 3)],
      index: 3,
      prev: text("old", PREV_RUN),
      next: textInput("w", "w", CURRENT_RUN),
      scriptRunId: CURRENT_RUN,
    })

    // "w" moved after the nodes between slots 1 and 3; "z" stays behind it.
    expect(summarize(retained)).toEqual(["z@4"])
  })

  it.each([
    [
      "the same element ID",
      textInput("y", "y", PREV_RUN),
      textInput("y", "y", CURRENT_RUN),
    ],
    ["two unkeyed elements", text("old", PREV_RUN), text("new", CURRENT_RUN)],
    [
      "the same block ID",
      blockWithId("b", [], PREV_RUN),
      blockWithId("b", [], CURRENT_RUN),
    ],
  ])("keeps entries in place for %s at the slot", (_name, prev, next) => {
    const before = [entry("w", 1)]

    const retained = getRetainedAfterWrite({
      retained: before,
      index: 1,
      prev,
      next,
      scriptRunId: CURRENT_RUN,
    })

    expect(retained).toBe(before)
  })

  it("moves entries at the slot behind a fresh node, followed by the occupant", () => {
    const retained = getRetainedAfterWrite({
      retained: [entry("a", 0), entry("w", 2), entry("q", 3)],
      index: 2,
      prev: textInput("z", "z", PREV_RUN),
      next: text("inserted", CURRENT_RUN),
      scriptRunId: CURRENT_RUN,
    })

    // "w" rendered before "z", and both rendered before "q".
    expect(summarize(retained)).toEqual(["a@0", "w@3", "z@3", "q@3"])
  })

  it("moves entries at the end behind an appended node", () => {
    const retained = getRetainedAfterWrite({
      retained: [entry("w", 3)],
      index: 3,
      prev: undefined,
      next: text("appended", CURRENT_RUN),
      scriptRunId: CURRENT_RUN,
    })

    expect(summarize(retained)).toEqual(["w@4"])
  })

  it("leaves entries unchanged when a spinner is shown or cleared", () => {
    const before = [entry("w", 1)]
    const z = textInput("z", "z", PREV_RUN)
    const spinner = [text("spinner", CURRENT_RUN)]
    const shownOverZ = new TransientNode(CURRENT_RUN, z, spinner)
    const writes: [AppNode | undefined, AppNode][] = [
      // Shown in an empty slot.
      [undefined, new TransientNode(CURRENT_RUN, undefined, spinner)],
      // Shown over the occupant, which becomes its anchor.
      [z, shownOverZ],
      // Cleared again, which keeps the anchor.
      [shownOverZ, new TransientNode(CURRENT_RUN, z, [])],
    ]

    for (const [prev, next] of writes) {
      expect(
        getRetainedAfterWrite({
          retained: before,
          index: 1,
          prev,
          next,
          scriptRunId: CURRENT_RUN,
        })
      ).toBe(before)
    }
  })

  it.each([
    ["the element itself", textInput("w", "w", CURRENT_RUN)],
    [
      "a transient anchored on it",
      new TransientNode(CURRENT_RUN, textInput("w", "w", CURRENT_RUN), [
        text("spinner", CURRENT_RUN),
      ]),
    ],
  ])(
    "reclaims through a transient slot when the write is %s",
    (_name, next) => {
      const retained = getRetainedAfterWrite({
        retained: [entry("w", 2), entry("z", 2)],
        index: 2,
        prev: new TransientNode(CURRENT_RUN),
        next,
        scriptRunId: CURRENT_RUN,
      })

      // "z" rendered after "w", so it stays behind the reclaimed element.
      expect(summarize(retained)).toEqual(["z@3"])
    }
  )

  it("retains a spinner's prior-run anchor that a new element replaces", () => {
    const retained = getRetainedAfterWrite({
      retained: [],
      index: 1,
      prev: new TransientNode(CURRENT_RUN, textInput("w", "w", PREV_RUN), []),
      next: text("notice", CURRENT_RUN),
      scriptRunId: CURRENT_RUN,
    })

    expect(summarize(retained)).toEqual(["w@2"])
  })
})

describe("shiftRetainedAfter", () => {
  it("shifts entries anchored after the index", () => {
    const retained = shiftRetainedAfter(
      [entry("a", 1), entry("b", 2), entry("c", 4)],
      1
    )

    expect(summarize(retained)).toEqual(["a@1", "b@3", "c@5"])
  })

  it("returns the same list when no entry is affected", () => {
    const before = [entry("a", 1)]

    expect(shiftRetainedAfter(before, 1)).toBe(before)
  })
})

describe("getRetainedAfterRemoval", () => {
  it("re-anchors entries to the surviving children", () => {
    // Children 1 and 2 were removed out of four.
    const retained = getRetainedAfterRemoval(
      [entry("a", 1), entry("b", 3), entry("c", 4)],
      [true, false, false, true],
      () => true
    )

    expect(summarize(retained)).toEqual(["a@1", "b@1", "c@2"])
  })

  it("drops entries rejected by the predicate", () => {
    const retained = getRetainedAfterRemoval(
      [entry("a", 1), entry("b", 1)],
      [true, true],
      e => e.id !== idOf("a")
    )

    expect(summarize(retained)).toEqual(["b@1"])
  })

  it("returns the same list when nothing changed", () => {
    const before = [entry("a", 1)]

    expect(getRetainedAfterRemoval(before, [true, true], () => true)).toBe(
      before
    )
  })
})

describe("element retention in AppRoot", () => {
  type ElementProps = Element.$Properties

  const keyed = (name: string): ElementProps => ({
    textInput: { id: idOf(name), label: name },
  })
  const unkeyed = (body: string): ElementProps => ({ text: { body } })

  function emptyRoot(): AppRoot {
    return new AppRoot(
      FAKE_SCRIPT_HASH,
      new BlockNode(FAKE_SCRIPT_HASH, [
        new BlockNode(FAKE_SCRIPT_HASH),
        new BlockNode(FAKE_SCRIPT_HASH),
        new BlockNode(FAKE_SCRIPT_HASH),
        new BlockNode(FAKE_SCRIPT_HASH),
      ])
    )
  }

  function write(
    root: AppRoot,
    scriptRunId: string,
    path: number[],
    element: ElementProps,
    fragmentId?: string
  ): AppRoot {
    return root.applyDelta(
      scriptRunId,
      makeProto(DeltaProto, { newElement: element, fragmentId }),
      forwardMsgMetadata([0, ...path])
    )
  }

  /** Show (or, with no elements, clear) a spinner-like transient at `path`. */
  function writeTransient(
    root: AppRoot,
    scriptRunId: string,
    path: number[],
    elements: ElementProps[]
  ): AppRoot {
    return root.applyDelta(
      scriptRunId,
      makeProto(DeltaProto, { newTransient: { elements } }),
      forwardMsgMetadata([0, ...path])
    )
  }

  /** Run a full script run writing `elements` into main, in order. */
  function run(
    root: AppRoot,
    scriptRunId: string,
    elements: ElementProps[]
  ): AppRoot {
    return elements.reduce(
      (current, element, index) =>
        write(current, scriptRunId, [index], element),
      root
    )
  }

  function labelOf(node: AppNode): string {
    if (node instanceof TransientNode) {
      return node.anchor ? labelOf(node.anchor) : "transient"
    }
    if (!(node instanceof ElementNode)) {
      return "block"
    }
    return node.element.textInput?.label ?? node.element.text?.body ?? "?"
  }

  const labels = (blockNode: BlockNode): string[] =>
    blockNode.children.map(labelOf)
  const retainedOf = (blockNode: BlockNode): string[] =>
    blockNode.retained.map(e => `${labelOf(e.node)}@${e.before}`)

  const initialRoot = (): AppRoot =>
    run(emptyRoot(), "run0", [unkeyed("a"), keyed("w"), keyed("z")])

  it("keeps displaced keyed elements until the run re-emits them", () => {
    let root = initialRoot().clearStaleNodes("run0")
    const originalW = root.main.children[1]

    root = write(root, "run1", [0], unkeyed("a"))
    expect(root.main.retained).toEqual([])

    root = write(root, "run1", [1], unkeyed("x1"))
    expect(labels(root.main)).toEqual(["a", "x1", "z"])
    expect(retainedOf(root.main)).toEqual(["w@2"])
    expect(root.main.retained[0].node).toBe(originalW)

    root = write(root, "run1", [2], unkeyed("x2"))
    expect(labels(root.main)).toEqual(["a", "x1", "x2"])
    expect(retainedOf(root.main)).toEqual(["w@3", "z@3"])

    root = write(root, "run1", [3], keyed("w"))
    expect(retainedOf(root.main)).toEqual(["z@4"])

    root = write(root, "run1", [4], keyed("z"))
    expect(labels(root.main)).toEqual(["a", "x1", "x2", "w", "z"])
    expect(root.main.retained).toEqual([])
  })

  it.each([
    ["after the spinner clears", true],
    ["while the spinner shows", false],
  ])(
    "reclaims elements re-emitted where a spinner was shown %s",
    (_name, clearSpinner) => {
      let root = initialRoot().clearStaleNodes("run0")
      root = run(root, "run1", [unkeyed("a"), unkeyed("x1"), unkeyed("x2")])
      expect(retainedOf(root.main)).toEqual(["w@3", "z@3"])

      root = writeTransient(root, "run1", [3], [unkeyed("spinner")])
      if (clearSpinner) {
        root = writeTransient(root, "run1", [3], [])
      }
      root = write(root, "run1", [3], keyed("w"))
      expect(retainedOf(root.main)).toEqual(["z@4"])

      root = write(root, "run1", [4], keyed("z"))
      expect(root.main.retained).toEqual([])
    }
  )

  it("excludes retained elements from the active ids", () => {
    let root = initialRoot().clearStaleNodes("run0")
    root = write(root, "run1", [0], unkeyed("a"))
    root = write(root, "run1", [1], unkeyed("x"))
    root = root.clearStaleNodes("run1")

    expect(root.main.retained).toEqual([])
    const activeIds = [...root.getElements()].map(getElementId)
    expect(activeIds).not.toContain(idOf("w"))
  })

  it("drops unclaimed elements when the run finishes successfully", () => {
    let root = initialRoot().clearStaleNodes("run0")
    root = run(root, "run1", [unkeyed("a"), unkeyed("x")])
    expect(retainedOf(root.main)).toEqual(["w@2"])

    root = root.clearStaleNodes("run1")

    expect(labels(root.main)).toEqual(["a", "x"])
    expect(root.main.retained).toEqual([])
  })

  it("keeps entries across an interrupted run so the next run can reclaim them", () => {
    let root = initialRoot().clearStaleNodes("run0")
    // run1 is interrupted after displacing "w"; no cleanup happens.
    root = run(root, "run1", [unkeyed("a"), unkeyed("x")])
    expect(retainedOf(root.main)).toEqual(["w@2"])

    root = run(root, "run2", [
      unkeyed("a"),
      unkeyed("x"),
      unkeyed("y"),
      keyed("w"),
      keyed("z"),
    ])
    root = root.clearStaleNodes("run2")

    expect(labels(root.main)).toEqual(["a", "x", "y", "w", "z"])
    expect(root.main.retained).toEqual([])
  })

  it("only drops entries in the fragment that ran", () => {
    const mainRunEntry = entry("main_only", 1)
    let root = new AppRoot(
      FAKE_SCRIPT_HASH,
      new BlockNode(FAKE_SCRIPT_HASH, [
        new BlockNode(
          FAKE_SCRIPT_HASH,
          [
            new BlockNode(
              FAKE_SCRIPT_HASH,
              [],
              new BlockProto({}),
              "run0",
              "fragment"
            ),
          ],
          new BlockProto({}),
          "run0",
          undefined,
          undefined,
          [mainRunEntry]
        ),
        new BlockNode(FAKE_SCRIPT_HASH),
        new BlockNode(FAKE_SCRIPT_HASH),
        new BlockNode(FAKE_SCRIPT_HASH),
      ])
    )
    root = write(root, "run0", [0, 0], keyed("w"), "fragment")

    root = write(root, "run1", [0, 0], unkeyed("x"), "fragment")
    const fragmentBlock = (): BlockNode => root.main.children[0] as BlockNode
    expect(retainedOf(fragmentBlock())).toEqual(["w@1"])

    root = root.clearStaleNodes("run1", ["fragment"])

    expect(fragmentBlock().retained).toEqual([])
    expect(root.main.retained).toEqual([mainRunEntry])
  })

  it("inherits retained elements with the children of a same-type block", () => {
    const retained = [entry("w", 1)]
    let root = new AppRoot(
      FAKE_SCRIPT_HASH,
      new BlockNode(FAKE_SCRIPT_HASH, [
        new BlockNode(FAKE_SCRIPT_HASH, [
          new BlockNode(
            FAKE_SCRIPT_HASH,
            [text("child", "run0")],
            new BlockProto({}),
            "run0",
            undefined,
            undefined,
            retained
          ),
        ]),
        new BlockNode(FAKE_SCRIPT_HASH),
        new BlockNode(FAKE_SCRIPT_HASH),
        new BlockNode(FAKE_SCRIPT_HASH),
      ])
    )

    root = root.applyDelta(
      "run1",
      makeProto(DeltaProto, { addBlock: {} }),
      forwardMsgMetadata([0, 0])
    )

    expect((root.main.children[0] as BlockNode).retained).toBe(retained)
  })

  it("drops retained elements on page filtering", () => {
    let root = initialRoot().clearStaleNodes("run0")
    root = run(root, "run1", [unkeyed("a"), unkeyed("x")])
    expect(root.main.retained).toHaveLength(1)

    root = root.filterMainScriptElements(FAKE_SCRIPT_HASH)

    expect(root.main.retained).toEqual([])
  })

  it("never changes the delta-addressable children", () => {
    // Deterministic pseudo-random sequences of writes, compared with a plain
    // positional-overwrite model of the main block.
    let seed = 7
    const random = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed / 2147483648
    }

    for (let trial = 0; trial < 200; trial++) {
      let root = emptyRoot()
      let model: { label: string; run: string }[] = []
      for (let runIndex = 0; runIndex < 4; runIndex++) {
        const runId = `run${runIndex}`
        const usedIds = new Set<string>()
        let frontier = -1
        const writes = 1 + Math.floor(random() * 6)
        for (let w = 0; w < writes; w++) {
          // Mostly advance the cursor; sometimes rewrite an earlier slot like
          // a locked cursor (st.empty) would.
          const index =
            frontier >= 0 && random() < 0.2
              ? Math.floor(random() * (frontier + 1))
              : frontier + 1
          // st.spinner shows at the cursor's next slot, and the next element is
          // written over it, either after it clears or while it still shows.
          const spinner =
            index > frontier && random() < 0.3
              ? random() < 0.5
                ? "clears before"
                : "clears after"
              : undefined
          frontier = Math.max(frontier, index)
          const name = `k${Math.floor(random() * 5)}`
          const useKey = random() < 0.7 && !usedIds.has(name)
          if (useKey) {
            usedIds.add(name)
          }
          const label = useKey ? name : `u${trial}-${runIndex}-${w}`
          if (spinner !== undefined) {
            root = writeTransient(root, runId, [index], [unkeyed("spinner")])
          }
          if (spinner === "clears before") {
            root = writeTransient(root, runId, [index], [])
          }
          root = write(
            root,
            runId,
            [index],
            useKey ? keyed(name) : unkeyed(label)
          )
          if (spinner === "clears after") {
            root = writeTransient(root, runId, [index], [])
          }
          model[index] = { label, run: runId }

          expect(root.main.children.map(labelOf)).toEqual(
            model.map(m => m.label)
          )
          const retainedIds = root.main.retained.map(e => e.id)
          expect(new Set(retainedIds).size).toBe(retainedIds.length)
          for (const e of root.main.retained) {
            expect(e.node.scriptRunId).not.toBe(runId)
            // A retained copy of an element the run already wrote renders
            // behind it, so render dedup keeps the current copy.
            const currentIndex = root.main.children.findIndex(child => {
              const c = child instanceof TransientNode ? child.anchor : child
              return (
                c instanceof ElementNode &&
                c.scriptRunId === runId &&
                getElementId(c.element) === e.id
              )
            })
            expect(currentIndex === -1 || currentIndex < e.before).toBe(true)
          }
          const anchors = root.main.retained.map(e => e.before)
          expect(anchors).toEqual(anchors.toSorted((a, b) => a - b))
        }
        // Half of the runs finish successfully; the others are interrupted.
        const finishes = random() < 0.5
        if (finishes) {
          root = root.clearStaleNodes(runId)
          model = model.filter(m => m.run === runId)
        }
        expect(finishes && root.main.retained.length > 0).toBe(false)
      }
    }
  })
})
