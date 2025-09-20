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

import { Element, Logo } from "@streamlit/protobuf"

import { StandaloneNode } from "src/render-tree/StandaloneNode"
import { block, text } from "src/render-tree/test-utils"

import { ElementsSetVisitor } from "./ElementsSetVisitor"

describe("ElementsSetVisitor", () => {
  describe("constructor", () => {
    it("creates visitor with empty set", () => {
      const visitor = new ElementsSetVisitor()
      expect(visitor.elements).toEqual(new Set<Element>())
      expect(visitor.elements.size).toBe(0)
    })
  })

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
      const outerElement = text("outer")
      const innerBlock = block([innerElement])
      const outerBlock = block([outerElement, innerBlock])
      const visitor = new ElementsSetVisitor()

      visitor.visitBlockNode(outerBlock)

      expect(visitor.elements.size).toBe(2)
      expect(visitor.elements.has(innerElement.element)).toBe(true)
      expect(visitor.elements.has(outerElement.element)).toBe(true)
    })

    it("accumulates elements with existing elements", () => {
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

  describe("visitStandaloneNode", () => {
    const MOCK_LOGO = Logo.create({
      image: "https://example.com/logo.png",
    })

    it("does not add standalone element to the visitor's set - StandaloneNodes don't contain elements", () => {
      const node = new StandaloneNode<Logo>(
        MOCK_LOGO,
        "test_run_id",
        "test_script_hash"
      )
      const visitor = new ElementsSetVisitor()

      const result = visitor.visitStandaloneNode(node)

      expect(result).toBe(visitor.elements) // Returns the same set reference
      expect(visitor.elements.size).toBe(0) // No elements added since StandaloneNode isn't an Element
    })

    it("does not add null element to the visitor's set", () => {
      const node = new StandaloneNode<Logo>(
        null,
        "test_run_id",
        "test_script_hash"
      )
      const visitor = new ElementsSetVisitor()

      const result = visitor.visitStandaloneNode(node)

      expect(result).toBe(visitor.elements)
      expect(visitor.elements.size).toBe(0)
    })

    it("works with different generic types", () => {
      interface CustomElement {
        id: string
        value: number
      }

      const customElement: CustomElement = { id: "test", value: 42 }
      const node = new StandaloneNode<CustomElement>(
        customElement,
        "test_run_id",
        "test_script_hash"
      )
      const visitor = new ElementsSetVisitor()

      const result = visitor.visitStandaloneNode(node)

      expect(result).toBe(visitor.elements)
      expect(visitor.elements.size).toBe(0) // Still no elements since custom elements aren't protobuf Elements
    })

    it("does not interfere with existing elements in the set", () => {
      const element = text("existing")
      const node = new StandaloneNode<Logo>(
        MOCK_LOGO,
        "test_run_id",
        "test_script_hash"
      )
      const visitor = new ElementsSetVisitor()

      // First add an existing element
      visitor.visitElementNode(element)
      // Then visit the standalone node
      visitor.visitStandaloneNode(node)

      expect(visitor.elements.size).toBe(1) // Only the original element
      expect(visitor.elements.has(element.element)).toBe(true)
    })

    it("can be called multiple times without side effects", () => {
      const node1 = new StandaloneNode<Logo>(
        MOCK_LOGO,
        "test_run_id_1",
        "test_script_hash"
      )
      const node2 = new StandaloneNode<Logo>(
        null,
        "test_run_id_2",
        "test_script_hash"
      )
      const visitor = new ElementsSetVisitor()

      visitor.visitStandaloneNode(node1)
      visitor.visitStandaloneNode(node2)
      visitor.visitStandaloneNode(node1) // Visit first node again

      expect(visitor.elements.size).toBe(0)
    })

    it("maintains set reference consistency", () => {
      const node = new StandaloneNode<Logo>(
        MOCK_LOGO,
        "test_run_id",
        "test_script_hash"
      )
      const visitor = new ElementsSetVisitor()
      const originalSet = visitor.elements

      const result = visitor.visitStandaloneNode(node)

      expect(result).toBe(originalSet) // Same reference maintained
      expect(visitor.elements).toBe(originalSet)
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
      const outerElement = text("outer")
      const innerBlock = block([innerElement])
      const outerBlock = block([outerElement, innerBlock])

      const elements = ElementsSetVisitor.collectElements(outerBlock)

      expect(elements.size).toBe(2)
      expect(elements.has(innerElement.element)).toBe(true)
      expect(elements.has(outerElement.element)).toBe(true)
    })

    it("returns empty set for empty block", () => {
      const emptyBlock = block([])

      const elements = ElementsSetVisitor.collectElements(emptyBlock)

      expect(elements.size).toBe(0)
    })

    it("collects elements from StandaloneNode (no elements collected)", () => {
      const MOCK_LOGO = Logo.create({
        image: "https://example.com/logo.png",
      })

      const node = new StandaloneNode<Logo>(
        MOCK_LOGO,
        "test_run_id",
        "test_script_hash"
      )

      const elements = ElementsSetVisitor.collectElements(node)

      expect(elements.size).toBe(0) // StandaloneNodes don't contain protobuf Elements
    })

    it("collects elements from null StandaloneNode", () => {
      const node = new StandaloneNode<Logo>(
        null,
        "test_run_id",
        "test_script_hash"
      )

      const elements = ElementsSetVisitor.collectElements(node)

      expect(elements.size).toBe(0)
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
