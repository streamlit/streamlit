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
})
