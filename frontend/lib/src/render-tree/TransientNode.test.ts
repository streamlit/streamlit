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

import { text } from "~lib/render-tree/test-utils"
import { TransientNode } from "~lib/render-tree/TransientNode"
import { AppNodeVisitor } from "~lib/render-tree/visitors/AppNodeVisitor.interface"
import {
  DebugVisitor,
  MAX_HASH_LENGTH,
} from "~lib/render-tree/visitors/DebugVisitor"

describe("TransientNode", () => {
  describe("constructor defaults", () => {
    it("sets defaults for transientNodes and deltaMsgReceivedAt", () => {
      const now = 123456789
      const spy = vi.spyOn(Date, "now").mockReturnValue(now)

      const anchor = text("anchor")
      const node = new TransientNode("run-1", anchor)

      expect(node.scriptRunId).toBe("run-1")
      expect(node.anchor).toBe(anchor)
      expect(Array.isArray(node.transientNodes)).toBe(true)
      expect(node.transientNodes.length).toBe(0)
      expect(node.deltaMsgReceivedAt).toBe(now)

      spy.mockRestore()
    })

    it("uses provided transient nodes and timestamp", () => {
      const t1 = text("t1")
      const t2 = text("t2")
      const node = new TransientNode("run-2", undefined, [t1, t2], 42)

      expect(node.transientNodes).toEqual([t1, t2])
      expect(node.deltaMsgReceivedAt).toBe(42)
    })
  })

  describe("updateTransientNodes", () => {
    it("maps over transient nodes and filters undefined results", () => {
      const e1 = text("one")
      const e2 = text("two")
      const e3 = text("three")
      const node = new TransientNode("run-x", text("anchor"), [e1, e2, e3], 10)

      const result = node.updateTransientNodes(el => {
        if (el.element.text?.body === "two") return el
        return undefined
      })

      expect(result).toEqual([e2])
      // Original list remains unchanged
      expect(node.transientNodes).toEqual([e1, e2, e3])
    })

    it("returns newly mapped ElementNodes without mutating original list", () => {
      const e1 = text("one")
      const e2 = text("two")
      const node = new TransientNode("run-y", text("anchor"), [e1, e2], 20)

      const mapped = node.updateTransientNodes(el => {
        const body = el.element.text?.body ?? ""
        return text(`${body}!`)
      })

      expect(mapped).toHaveLength(2)
      expect(mapped[0].element.text?.body).toBe("one!")
      expect(mapped[1].element.text?.body).toBe("two!")
      // Ensure originals are intact
      expect(node.transientNodes[0].element.text?.body).toBe("one")
      expect(node.transientNodes[1].element.text?.body).toBe("two")
    })
  })

  describe("accept + debug", () => {
    it("accepts a visitor and returns its value", () => {
      const node = new TransientNode("run-v", text("a"), [], 1)
      const visitor: AppNodeVisitor<string> = {
        visitBlockNode: vi.fn(),
        visitElementNode: vi.fn(),
        visitTransientNode: vi.fn().mockReturnValue("ok"),
      }

      const out = node.accept(visitor)
      expect(out).toBe("ok")
      expect(visitor.visitTransientNode).toHaveBeenCalledWith(node)
    })

    it("produces a human-readable debug string including anchor and transients", () => {
      const anchor = text("anchor-text")
      const t1 = text("t1")
      const t2 = text("t2")
      const node = new TransientNode("run-xyz", anchor, [t1, t2], 5)

      const debug = node.debug()

      expect(debug.split("\n")[0]).toBe(
        `└── TransientNode [2 transient] (run: ${"run-xyz".substring(0, MAX_HASH_LENGTH)})`
      )
      expect(debug).toContain("anchor:")
      expect(debug).toContain("ElementNode [text]")
      expect(debug).toContain("transient nodes:")

      // Also validate DebugVisitor can be used directly
      const viaVisitor = node.accept(new DebugVisitor())
      expect(viaVisitor).toBe(debug)
    })
  })

  describe("replaceTransientNodeWithSelf", () => {
    it("returns combined this when this is as new or newer (or timestamps missing)", () => {
      const anchorThis = text("this-anchor")
      const t1 = text("t1")
      const current = new TransientNode("run-a", anchorThis, [t1], 200)

      const anchorOther = text("other-anchor")
      const other = new TransientNode(
        "run-b",
        anchorOther,
        [text("ignore")],
        100
      )

      const replaced = current.replaceTransientNodeWithSelf(
        other
      ) as TransientNode

      expect(replaced).not.toBe(other)
      expect(replaced.scriptRunId).toBe("run-a")
      expect(replaced.transientNodes).toEqual([t1])
      expect(replaced.deltaMsgReceivedAt).toBe(200)
      expect(replaced.anchor).toBe(anchorThis)
    })

    it("uses other anchor if this has no anchor when combining", () => {
      const otherAnchor = text("anchor")
      const current = new TransientNode("run-a", undefined, [text("t")], 300)
      const other = new TransientNode("run-b", otherAnchor, [text("x")], 100)

      const replaced = current.replaceTransientNodeWithSelf(
        other
      ) as TransientNode
      expect(replaced.anchor).toBe(otherAnchor)
    })

    it("returns the other node when other is newer", () => {
      const current = new TransientNode("run-a", text("a"), [text("t")], 50)
      const other = new TransientNode("run-b", text("b"), [text("x")], 100)

      const replaced = current.replaceTransientNodeWithSelf(other)
      expect(replaced).toBe(other)
    })
  })
})
