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

import { text } from "./test-utils"
import { TransientNode } from "./TransientNode"

describe("ElementNode", () => {
  describe("ElementNode.accept", () => {
    it("calls visitElementNode on the visitor", () => {
      const node = text("test")
      const mockVisitor = {
        visitElementNode: vi.fn().mockReturnValue("element-result"),
        visitBlockNode: vi.fn().mockReturnValue("block-result"),
        visitTransientNode: vi.fn().mockReturnValue("transient-result"),
      }

      const result = node.accept(mockVisitor)

      expect(mockVisitor.visitElementNode).toHaveBeenCalledWith(node)
      expect(mockVisitor.visitBlockNode).not.toHaveBeenCalled()
      expect(result).toEqual("element-result")
    })

    it("allows visitor to return the same node", () => {
      const node = text("test")
      const identityVisitor = {
        visitElementNode: vi.fn().mockReturnValue(node),
        visitBlockNode: vi.fn(),
        visitTransientNode: vi.fn(),
      }

      const result = node.accept(identityVisitor)

      expect(result).toBe(node)
    })

    it("allows visitor to return undefined", () => {
      const node = text("test")
      const nullVisitor = {
        visitElementNode: vi.fn().mockReturnValue(undefined),
        visitBlockNode: vi.fn(),
        visitTransientNode: vi.fn(),
      }

      const result = node.accept(nullVisitor)

      expect(result).toBeUndefined()
    })
  })

  describe("ElementNode.replaceTransientNodeWithSelf", () => {
    it("returns this when transient node scriptRunId differs", () => {
      const el = text("a", "runA")
      const t = new TransientNode("runB", text("anchor"), [text("t")], 1)
      const result = el.replaceTransientNodeWithSelf(t)
      expect(result).toBe(el)
    })

    it("returns this when transient node has no transients", () => {
      const el = text("a", "runA")
      const t = new TransientNode("runA", text("anchor"), [], 1)
      const result = el.replaceTransientNodeWithSelf(t)
      expect(result).toBe(el)
    })

    it("returns TransientNode anchored to this element with filtered transients", () => {
      const runId = "cur"
      const el = text("a", runId)
      const keep = text("keep", runId)
      const drop = text("drop", "old")
      const t = new TransientNode(
        runId,
        text("old-anchor", "old"),
        [keep, drop],
        42
      )

      const result = el.replaceTransientNodeWithSelf(t) as TransientNode
      expect(result).toBeInstanceOf(TransientNode)
      expect(result.anchor).toBe(el)
      expect(result.transientNodes).toEqual([keep])
      expect(result.scriptRunId).toBe(runId)
      expect(result.deltaMsgReceivedAt).toBe(42)
    })
  })
})
