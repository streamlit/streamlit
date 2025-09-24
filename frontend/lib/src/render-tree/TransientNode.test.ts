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

import type { AppNode } from "./AppNode.interface"
import { TransientNode, TransientNodeMap } from "./TransientNode"
import type { AppNodeVisitor } from "./visitors/AppNodeVisitor.interface"

function createFakeAppNode(scriptRunId: string): AppNode {
  const node: AppNode = {
    scriptRunId,
    accept: <T>(_visitor: AppNodeVisitor<T>): T => {
      return undefined as unknown as T
    },
    replaceTransientNode: (_node: TransientNode): AppNode => node,
    debug: (): string => {
      return `FakeAppNode (run: ${scriptRunId})\n`
    },
  }
  return node
}

describe("TransientNode", () => {
  describe("constructor", () => {
    it("sets defaults when optional args are omitted", () => {
      const node = new TransientNode("run-1")
      expect(node.scriptRunId).toBe("run-1")
      expect(node.anchor).toBeUndefined()
      expect(node.transientNodes.length).toBe(0)
    })

    it("uses provided anchor and transient map", () => {
      const anchor = createFakeAppNode("run-1")
      const transientElement = createFakeAppNode("run-1")
      const transientMap = [["t1", transientElement, 0]] as TransientNodeMap

      const node = new TransientNode("run-1", anchor, transientMap)

      expect(node.anchor).toBe(anchor)
      expect(node.transientNodes).toStrictEqual(transientMap)
      expect(node.transientNodes[0][0]).toBe("t1")
      expect(node.transientNodes[0][1]).toBe(transientElement)
      expect(node.transientNodes[0][2]).toBe(0)
    })
  })

  describe("replaceTransientNode", () => {
    it("prefers replacement anchor and preserves scriptRunId and transient map", () => {
      const originalAnchor = createFakeAppNode("run-1")
      const transientElement = createFakeAppNode("run-1")
      const transientMap = [["a", transientElement, 0]] as TransientNodeMap
      const base = new TransientNode("run-1", originalAnchor, transientMap)

      const newAnchor = createFakeAppNode("other")
      const replacement = new TransientNode("different-run", newAnchor)

      const result = base.replaceTransientNode(replacement) as TransientNode

      expect(result).not.toBe(base)
      expect(result).toBeInstanceOf(TransientNode)
      expect(result.scriptRunId).toBe("run-1")
      expect(result.anchor).toBe(newAnchor)
      expect(result.transientNodes).toStrictEqual([["a", transientElement, 0]])
    })

    it("keeps original anchor if replacement has none", () => {
      const originalAnchor = createFakeAppNode("run-1")
      const base = new TransientNode("run-1", originalAnchor)
      const replacement = new TransientNode("run-2")

      const result = base.replaceTransientNode(replacement) as TransientNode

      expect(result.anchor).toBe(originalAnchor)
    })
  })

  describe("updateTransientNodes", () => {
    it("updates each entry and filters out undefined results", () => {
      const a = createFakeAppNode("run")
      const b = createFakeAppNode("run")
      const c = createFakeAppNode("run")

      const map = [
        ["a", a, 0],
        ["b", b, 1],
        ["c", c, 2],
      ] as TransientNodeMap

      const node = new TransientNode("run", undefined, map)

      const updater = vi.fn(
        (element: AppNode, id: string): AppNode | undefined => {
          if (id === "a") return createFakeAppNode("updated")
          if (id === "c") return undefined
          return element
        }
      )

      const newMap = node.updateTransientNodes(updater)

      expect(updater).toHaveBeenCalledTimes(3)
      expect(newMap.length).toBe(2)
      expect(newMap.map(([id]) => id).sort()).toEqual(["a", "b"])
      expect(newMap.find(([id]) => id === "a")?.[1]?.scriptRunId).toBe(
        "updated"
      )
      expect(newMap.find(([id]) => id === "b")?.[1]).toBe(b)
      expect(newMap.find(([id]) => id === "c")).toBeUndefined()

      // Original map remains unchanged
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
