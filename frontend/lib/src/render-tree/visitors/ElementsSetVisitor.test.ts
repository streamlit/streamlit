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

import { block, blockWithId, text } from "~lib/render-tree/test-utils"
import { TransientNode } from "~lib/render-tree/TransientNode"

import { ElementsSetVisitor } from "./ElementsSetVisitor"

describe("ElementsSetVisitor", () => {
  describe("visitElementNode", () => {
    it("adds element to the visitor's set", () => {
      const element = text("test")
      const visitor = new ElementsSetVisitor()

      const result = visitor.visitElementNode(element)

      expect(result).toBe(visitor.elements) // Returns the same set reference
      expect(visitor.elements.size).toBe(1)
      expect(visitor.elements.has(element.element)).toBe(true)
    })

    it("accumulates multiple elements", () => {
      const element1 = text("first")
      const element2 = text("second")
      const visitor = new ElementsSetVisitor()

      visitor.visitElementNode(element1)
      visitor.visitElementNode(element2)

      expect(visitor.elements.size).toBe(2)
      expect(visitor.elements.has(element1.element)).toBe(true)
      expect(visitor.elements.has(element2.element)).toBe(true)
    })

    it("handles duplicate elements correctly", () => {
      const element = text("duplicate")
      const visitor = new ElementsSetVisitor()

      visitor.visitElementNode(element)
      visitor.visitElementNode(element)

      // Set should still have only one element since sets prevent duplicates
      expect(visitor.elements.size).toBe(1)
      expect(visitor.elements.has(element.element)).toBe(true)
    })
  })

  describe("visitBlockNode", () => {
    it("returns the visitor's set for empty block", () => {
      const emptyBlock = block([])
      const visitor = new ElementsSetVisitor()

      const result = visitor.visitBlockNode(emptyBlock)

      expect(result).toBe(visitor.elements)
      expect(visitor.elements.size).toBe(0)
    })

    it("collects elements from all children", () => {
      const child1 = text("child1")
      const child2 = text("child2")
      const blockNode = block([child1, child2])
      const visitor = new ElementsSetVisitor()

      visitor.visitBlockNode(blockNode)

      expect(visitor.elements.size).toBe(2)
      expect(visitor.elements.has(child1.element)).toBe(true)
      expect(visitor.elements.has(child2.element)).toBe(true)
    })

    it("handles nested block structures", () => {
      const innerElement = text("inner")
      const dupeElement = innerElement
      const outerElement = text("outer")
      const innerBlock = block([innerElement])
      const outerBlock = block([outerElement, innerBlock, dupeElement])
      const visitor = new ElementsSetVisitor()

      visitor.visitBlockNode(outerBlock)

      // Ensure the dupe element is removed
      expect(visitor.elements.size).toBe(2)
      expect(visitor.elements.has(innerElement.element)).toBe(true)
      expect(visitor.elements.has(outerElement.element)).toBe(true)
    })

    it("accumulates multiple elements when inside block nodes", () => {
      const existingElement = text("existing")
      const blockElement = text("from_block")
      const blockNode = block([blockElement])
      const visitor = new ElementsSetVisitor()

      // First add an existing element
      visitor.visitElementNode(existingElement)
      // Then visit the block
      visitor.visitBlockNode(blockNode)

      expect(visitor.elements.size).toBe(2)
      expect(visitor.elements.has(existingElement.element)).toBe(true)
      expect(visitor.elements.has(blockElement.element)).toBe(true)
    })
  })

  describe("visitTransientNode", () => {
    it("collects elements from transient list and anchor", () => {
      const t1 = text("t1")
      const t2 = text("t2")
      const anchor = text("anchor")
      const transient = new TransientNode("run", anchor, [t1, t2], 1)

      const visitor = new ElementsSetVisitor()
      const result = visitor.visitTransientNode(transient)

      expect(result).toBe(visitor.elements)
      expect(visitor.elements.has(t1.element)).toBe(true)
      expect(visitor.elements.has(t2.element)).toBe(true)
      expect(visitor.elements.has(anchor.element)).toBe(true)
    })

    it("handles missing anchor and empty transient list", () => {
      const transient = new TransientNode("run", undefined, [], 1)
      const visitor = new ElementsSetVisitor()

      visitor.visitTransientNode(transient)
      expect(visitor.elements.size).toBe(0)
    })
  })

  describe("collectElements static method", () => {
    it("collects elements from ElementNode", () => {
      const element = text("test")
      const elements = ElementsSetVisitor.collectElements(element)

      expect(elements.size).toBe(1)
      expect(elements.has(element.element)).toBe(true)
    })

    it("collects elements from BlockNode", () => {
      const child1 = text("child1")
      const child2 = text("child2")
      const blockNode = block([child1, child2])

      const elements = ElementsSetVisitor.collectElements(blockNode)

      expect(elements.size).toBe(2)
      expect(elements.has(child1.element)).toBe(true)
      expect(elements.has(child2.element)).toBe(true)
    })

    it("handles nested structures", () => {
      const innerElement = text("inner")
      const dupeElement = innerElement
      const outerElement = text("outer")
      const innerBlock = block([innerElement])
      const outerBlock = block([outerElement, innerBlock, dupeElement])

      const elements = ElementsSetVisitor.collectElements(outerBlock)

      // Ensure the dupe element is removed
      expect(elements.size).toBe(2)
      expect(elements.has(innerElement.element)).toBe(true)
      expect(elements.has(outerElement.element)).toBe(true)
    })

    it("returns empty set for empty block", () => {
      const emptyBlock = block([])

      const elements = ElementsSetVisitor.collectElements(emptyBlock)

      expect(elements.size).toBe(0)
    })
  })

  describe("blockIds collection", () => {
    it("collects block ids from blocks with id set", () => {
      const idBlock = blockWithId("$$ID-abc123-my_key")
      const visitor = new ElementsSetVisitor()

      visitor.visitBlockNode(idBlock)

      expect(visitor.blockIds.size).toBe(1)
      expect(visitor.blockIds.has("$$ID-abc123-my_key")).toBe(true)
    })

    it("does not collect ids from blocks without id", () => {
      const noIdBlock = block([text("child")])
      const visitor = new ElementsSetVisitor()

      visitor.visitBlockNode(noIdBlock)

      expect(visitor.blockIds.size).toBe(0)
    })

    it("collects ids from nested blocks", () => {
      const innerBlock = blockWithId("$$ID-inner-key1", [text("inner")])
      const outerBlock = blockWithId("$$ID-outer-key2", [innerBlock])
      const visitor = new ElementsSetVisitor()

      visitor.visitBlockNode(outerBlock)

      expect(visitor.blockIds.size).toBe(2)
      expect(visitor.blockIds.has("$$ID-inner-key1")).toBe(true)
      expect(visitor.blockIds.has("$$ID-outer-key2")).toBe(true)
      expect(visitor.elements.size).toBe(1)
    })

    it("collects elements and block ids simultaneously", () => {
      const child = text("child")
      const idBlock = blockWithId("$$ID-abc-mykey", [child])
      const visitor = new ElementsSetVisitor()

      visitor.visitBlockNode(idBlock)

      expect(visitor.elements.size).toBe(1)
      expect(visitor.elements.has(child.element)).toBe(true)
      expect(visitor.blockIds.size).toBe(1)
      expect(visitor.blockIds.has("$$ID-abc-mykey")).toBe(true)
    })
  })

  describe("performance and mutability", () => {
    it("uses the same set instance throughout", () => {
      const element1 = text("first")
      const element2 = text("second")
      const visitor = new ElementsSetVisitor()
      const originalSet = visitor.elements

      visitor.visitElementNode(element1)
      visitor.visitElementNode(element2)

      expect(visitor.elements).toBe(originalSet) // Same reference
      expect(visitor.elements.size).toBe(2)
    })

    it("efficiently handles large trees", () => {
      // Create a tree with many elements
      const elements = Array.from({ length: 100 }, (_, i) =>
        text(`element${i}`)
      )
      const blockNode = block(elements)
      const visitor = new ElementsSetVisitor()

      visitor.visitBlockNode(blockNode)

      expect(visitor.elements.size).toBe(100)
      elements.forEach(element => {
        expect(visitor.elements.has(element.element)).toBe(true)
      })
    })
  })
})
