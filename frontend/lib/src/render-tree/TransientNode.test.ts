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

import { describe, expect, it, vi } from "vitest"

import { Element, ForwardMsgMetadata } from "@streamlit/protobuf"

import { ElementNode } from "./ElementNode"
import { TransientNode } from "./TransientNode"
import type { AppNodeVisitor } from "./visitors/AppNodeVisitor.interface"

function createFakeElementNode(scriptRunId: string): ElementNode {
  const mockElement = Element.create()
  const mockMetadata = ForwardMsgMetadata.create()
  return new ElementNode(
    mockElement,
    mockMetadata,
    scriptRunId,
    "activeScriptHash"
  )
}

describe("TransientNode", () => {
  describe("constructor", () => {
    it("sets defaults when optional args are omitted", () => {
      const node = new TransientNode("run-1")
      expect(node.scriptRunId).toBe("run-1")
      expect(node.anchor).toBeUndefined()
      expect(node.transientNodes.length).toBe(0)
    })

    it("uses provided anchor and transient array", () => {
      const anchor = createFakeElementNode("run-1")
      const transientElement = createFakeElementNode("run-1")
      const transientArray = [transientElement]

      const node = new TransientNode("run-1", anchor, transientArray)

      expect(node.anchor).toBe(anchor)
      expect(node.transientNodes).toStrictEqual(transientArray)
      expect(node.transientNodes[0]).toBe(transientElement)
    })
  })

  describe("replaceTransientNode", () => {
    it("prefers replacement anchor and preserves scriptRunId and transient array", () => {
      const originalAnchor = createFakeElementNode("run-1")
      const newAnchor = createFakeElementNode("other")
      const transientElement = createFakeElementNode("run-1")
      const transientArray = [transientElement]
      const replacer = new TransientNode(
        "run-1",
        newAnchor,
        transientArray,
        Date.now() + 1
      )

      const replacee = new TransientNode(
        "different-run",
        originalAnchor,
        [],
        Date.now()
      )

      const result = replacer.replaceTransientNode(replacee) as TransientNode

      expect(result).toBeInstanceOf(TransientNode)
      expect(result.scriptRunId).toBe("run-1")
      expect(result.anchor).toBe(newAnchor)
      expect(result.transientNodes).toStrictEqual([transientElement])
    })

    it("keeps original anchor if replacement has none", () => {
      const originalAnchor = createFakeElementNode("run-1")
      const base = new TransientNode("run-1", originalAnchor)
      const replacement = new TransientNode("run-2")

      const result = base.replaceTransientNode(replacement) as TransientNode

      expect(result.anchor).toBe(originalAnchor)
    })
  })

  describe("updateTransientNodes", () => {
    it("updates each entry and filters out undefined results", () => {
      const a = createFakeElementNode("run")
      const b = createFakeElementNode("run")
      const c = createFakeElementNode("run")

      const array = [a, b, c]
      const node = new TransientNode("run", undefined, array)

      const updater = vi.fn(
        (element: ElementNode): ElementNode | undefined => {
          if (element === a) return createFakeElementNode("updated")
          if (element === c) return undefined
          return element
        }
      )

      const newArray = node.updateTransientNodes(updater)

      expect(updater).toHaveBeenCalledTimes(3)
      expect(newArray.length).toBe(2)
      expect(newArray[0].scriptRunId).toBe("updated")
      expect(newArray[1]).toBe(b)

      // Original array remains unchanged
      expect(node.transientNodes.length).toBe(3)
    })
  })

  describe("accept", () => {
    it("delegates to visitor.visitTransientNode and returns its result", () => {
      const node = new TransientNode("run")
      const visitTransientNode = vi.fn().mockReturnValue("ok")
      const visitor: AppNodeVisitor<string> = {
        visitBlockNode: () => "block",
        visitElementNode: () => "element",
        visitStandaloneNode: () => "standalone",
        visitTransientNode,
      }

      const result = node.accept(visitor)

      expect(visitTransientNode).toHaveBeenCalledTimes(1)
      expect(visitTransientNode).toHaveBeenCalledWith(node)
      expect(result).toBe("ok")
    })
  })
})
