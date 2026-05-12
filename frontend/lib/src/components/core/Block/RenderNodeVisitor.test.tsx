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

import { isValidElement } from "react"

import { BlockNode, TransientNode } from "~lib/AppNode"
import { ComponentRegistry } from "~lib/components/widgets/CustomComponent/ComponentRegistry"
import { FileUploadClient } from "~lib/FileUploadClient"
import { mockEndpoints, mockSessionInfo } from "~lib/mocks/mocks"
import {
  block,
  blockWithId,
  text,
  textInput,
} from "~lib/render-tree/test-utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { BlockPropsWithoutWidth } from "./Block"
import { RenderNodeVisitor } from "./RenderNodeVisitor"

// Mock props for testing
const sessionInfo = mockSessionInfo()
const createMockProps = (node: BlockNode): BlockPropsWithoutWidth => ({
  node,
  endpoints: mockEndpoints(),
  widgetMgr: new WidgetStateManager({
    sendRerunBackMsg: () => {},
    formsDataChanged: () => {},
  }),
  uploadClient: new FileUploadClient({
    sessionInfo,
    endpoints: mockEndpoints(),
    formsWithPendingRequestsChanged: () => {},
  }),
  widgetsDisabled: false,
  componentRegistry: new ComponentRegistry(mockEndpoints()),
})

describe("RenderNodeVisitor", () => {
  describe("constructor", () => {
    it("creates visitor with initial state", () => {
      const mockBlock = block([])
      const mockProps = createMockProps(mockBlock)
      const visitor = new RenderNodeVisitor(mockProps)

      expect(visitor.reactElements).toEqual([])
      expect(visitor.reactElements).toHaveLength(0)
    })
  })

  describe("visitElementNode", () => {
    it("returns React element for ElementNode", () => {
      const elementNode = text("test element")
      const mockBlock = block([])
      const mockProps = createMockProps(mockBlock)
      const visitor = new RenderNodeVisitor(mockProps)

      const result = visitor.visitElementNode(elementNode)

      expect(result).not.toBeNull()
      expect(isValidElement(result)).toBe(true)
      expect(visitor.reactElements).toHaveLength(1)
      expect(visitor.reactElements[0]).toBe(result)
    })

    it("increments index after visiting ElementNode", () => {
      const elementNode1 = text("element 1")
      const elementNode2 = text("element 2")
      const mockBlock = block([])
      const mockProps = createMockProps(mockBlock)
      const visitor = new RenderNodeVisitor(mockProps)

      const result1 = visitor.visitElementNode(elementNode1)
      const result2 = visitor.visitElementNode(elementNode2)

      expect(result1).not.toBe(result2)
      expect(visitor.reactElements).toHaveLength(2)
      expect(visitor.reactElements[0]).toBe(result1)
      expect(visitor.reactElements[1]).toBe(result2)
    })

    it("handles duplicate element keys by filtering out duplicates", () => {
      // Create two identical text elements - they should have the same internal structure
      const element1 = textInput("same text", "same_id")
      const element2 = textInput("same text", "same_id")

      const mockBlock = block([])
      const mockProps = createMockProps(mockBlock)
      const visitor = new RenderNodeVisitor(mockProps)

      const result1 = visitor.visitElementNode(element1)
      const result2 = visitor.visitElementNode(element2)

      // Only one widget should be rendered
      expect(visitor.reactElements).toHaveLength(1)
      expect(result1).not.toBeNull()
      expect(isValidElement(result1)).toBe(true)
      expect(visitor.reactElements[0]).toBe(result1)
      expect(result2).toBeNull()
    })

    it("uses the widget id as the key", () => {
      const element = textInput("same text", "same_id")

      const mockBlock = block([])
      const mockProps = createMockProps(mockBlock)
      const visitor = new RenderNodeVisitor(mockProps)

      const result = visitor.visitElementNode(element)

      expect(visitor.reactElements).toHaveLength(1)
      expect(result).not.toBeNull()
      expect(isValidElement(result)).toBe(true)
      expect(visitor.reactElements[0]).toBe(result)
      expect((result as React.ReactElement).key).toBe(
        element.element?.textInput?.id
      )
    })
  })

  describe("visitBlockNode", () => {
    it("returns React element for BlockNode", () => {
      const blockNode = block([text("child")])
      const mockBlock = block([])
      const mockProps = createMockProps(mockBlock)
      const visitor = new RenderNodeVisitor(mockProps)

      const result = visitor.visitBlockNode(blockNode)

      expect(result).not.toBeNull()
      expect(isValidElement(result)).toBe(true)
      expect(visitor.reactElements).toHaveLength(1)
      expect(visitor.reactElements[0]).toBe(result)
    })

    it("increments index after visiting BlockNode", () => {
      const blockNode1 = block([text("child1")])
      const blockNode2 = block([text("child2")])
      const mockBlock = block([])
      const mockProps = createMockProps(mockBlock)
      const visitor = new RenderNodeVisitor(mockProps)

      const result1 = visitor.visitBlockNode(blockNode1)
      const result2 = visitor.visitBlockNode(blockNode2)

      expect(result1).not.toBe(result2)
      expect(visitor.reactElements).toHaveLength(2)
      expect(visitor.reactElements[0]).toBe(result1)
      expect(visitor.reactElements[1]).toBe(result2)
    })

    it("uses index as key for BlockNode without id", () => {
      const blockNode = block([])
      const mockBlock = block([])
      const mockProps = createMockProps(mockBlock)
      const visitor = new RenderNodeVisitor(mockProps)

      const result = visitor.visitBlockNode(blockNode)

      expect(result).not.toBeNull()
      expect(isValidElement(result)).toBe(true)
      expect((result as React.ReactElement).key).toBe("0")
    })

    it("uses blockId as key for BlockNode with id", () => {
      const blockNode = blockWithId("$$ID-abc123-my_key")
      const mockBlock = block([])
      const mockProps = createMockProps(mockBlock)
      const visitor = new RenderNodeVisitor(mockProps)

      const result = visitor.visitBlockNode(blockNode)

      expect(result).not.toBeNull()
      expect(isValidElement(result)).toBe(true)
      expect((result as React.ReactElement).key).toBe("$$ID-abc123-my_key")
    })

    it("passes disableFullscreenMode prop from props correctly", () => {
      const blockNode = block([])
      const mockBlock = block([])
      const mockProps = {
        ...createMockProps(mockBlock),
        disableFullscreenMode: true,
      }
      const visitor = new RenderNodeVisitor(mockProps)

      const result = visitor.visitBlockNode(blockNode)

      expect(result).not.toBeNull()
      expect(isValidElement(result)).toBe(true)
      // Check that the props contain disableFullscreenMode: true
      const props = (result as React.ReactElement).props
      expect(props.disableFullscreenMode).toBe(true)
    })
  })

  describe("mixed node types", () => {
    it("handles visiting multiple different node types", () => {
      const elementNode = text("element")
      const blockNode = block([text("block child")])

      const mockBlock = block([])
      const mockProps = createMockProps(mockBlock)
      const visitor = new RenderNodeVisitor(mockProps)

      const elementResult = visitor.visitElementNode(elementNode)
      const blockResult = visitor.visitBlockNode(blockNode)

      expect(elementResult).not.toBeNull()
      expect(isValidElement(elementResult)).toBe(true)
      expect(blockResult).not.toBeNull()
      expect(isValidElement(blockResult)).toBe(true)

      expect(visitor.reactElements).toHaveLength(2)
      expect(visitor.reactElements[0]).toBe(elementResult)
      expect(visitor.reactElements[1]).toBe(blockResult)
    })
  })

  describe("static collectReactElements", () => {
    it("returns empty array for block with no children", () => {
      const emptyBlock = block([])
      const mockProps = createMockProps(emptyBlock)

      const result = RenderNodeVisitor.collectReactElements(mockProps)

      expect(result).toEqual([])
    })

    it("collects React elements from block children", () => {
      const childBlock = block([text("child element")])
      const parentBlock = block([
        text("element 1"),
        childBlock,
        text("element 2"),
      ])
      const mockProps = createMockProps(parentBlock)

      const result = RenderNodeVisitor.collectReactElements(mockProps)

      expect(result).toHaveLength(3)
      result.forEach(element => {
        expect(element).not.toBeNull()
        expect(isValidElement(element)).toBe(true)
      })
    })

    it("passes disableFullscreenMode from props", () => {
      const parentBlock = block([text("element")])
      const mockProps = {
        ...createMockProps(parentBlock),
        disableFullscreenMode: true,
      }

      const result = RenderNodeVisitor.collectReactElements(mockProps)

      expect(result).toHaveLength(1)
      expect(result[0]).not.toBeNull()
      expect(isValidElement(result[0])).toBe(true)
      // Check that the props contain disableFullscreenMode: true
      const props = result[0].props
      expect(props.disableFullscreenMode).toBe(true)
    })

    it("creates new visitor instance for each call", () => {
      const parentBlock = block([text("element")])
      const mockProps = createMockProps(parentBlock)

      const result1 = RenderNodeVisitor.collectReactElements(mockProps)
      const result2 = RenderNodeVisitor.collectReactElements(mockProps)

      expect(result1).toHaveLength(1)
      expect(result2).toHaveLength(1)
      // Results should be different instances (new React elements created)
      expect(result1[0]).not.toBe(result2[0])
    })

    it("handles complex nested structure", () => {
      const deepElement = text("deep element")
      const nestedBlock = block([deepElement])
      const parentBlock = block([
        text("element 1"),
        nestedBlock,
        text("element 2"),
        block([text("another nested element")]),
      ])
      const mockProps = createMockProps(parentBlock)

      const result = RenderNodeVisitor.collectReactElements(mockProps)

      // Should have 4 elements: 2 text elements + 2 block elements
      expect(result).toHaveLength(4)
      result.forEach(element => {
        expect(element).not.toBeNull()
        expect(isValidElement(element)).toBe(true)
      })
    })
  })

  describe("integration with render tree", () => {
    it("works with render tree test utilities", () => {
      const testBlock = block([
        text("first"),
        block([text("nested")]),
        text("last"),
      ])
      const mockProps = createMockProps(testBlock)

      const result = RenderNodeVisitor.collectReactElements(mockProps)

      expect(result).toHaveLength(3)
      result.forEach(element => {
        expect(element).not.toBeNull()
        expect(isValidElement(element)).toBe(true)
      })
    })
  })

  describe("visitTransientNode", () => {
    it("renders transient elements and anchor with expected keys and order", () => {
      const transient1 = text("t1")
      const transient2 = text("t2")
      const anchorEl = text("anchor")
      const transientNode = new TransientNode("run-1", anchorEl, [
        transient1,
        transient2,
      ])

      const rootBlock = block([])
      const mockProps = createMockProps(rootBlock)
      const visitor = new RenderNodeVisitor(mockProps)

      const result = visitor.visitTransientNode(transientNode)

      if (!Array.isArray(result)) {
        throw new Error("Expected visitTransientNode to return an array")
      }
      expect(result).toHaveLength(3)

      // Transient children get deterministic keys transient-0, transient-1
      expect((result[0] as React.ReactElement).key).toBe("transient-0")
      expect((result[1] as React.ReactElement).key).toBe("transient-1")
      // Anchor is visited by the same visitor and thus uses the current index as key ("0")
      expect((result[2] as React.ReactElement).key).toBe("0")

      // Visitor collects transient elements first, then the anchor
      expect(visitor.reactElements).toHaveLength(3)
      expect(visitor.reactElements[0]).toBe(result[0])
      expect(visitor.reactElements[1]).toBe(result[1])
      expect(visitor.reactElements[2]).toBe(result[2])
    })

    it("returns only transients when there is no anchor", () => {
      const transient1 = text("t1")
      const transientNode = new TransientNode("run-2", undefined, [transient1])

      const rootBlock = block([])
      const mockProps = createMockProps(rootBlock)
      const visitor = new RenderNodeVisitor(mockProps)

      const result = visitor.visitTransientNode(transientNode)

      if (!Array.isArray(result)) {
        throw new Error("Expected visitTransientNode to return an array")
      }
      expect(result).toHaveLength(1)
      expect((result[0] as React.ReactElement).key).toBe("transient-0")
      // Only one element collected in visitor as well
      expect(visitor.reactElements).toHaveLength(1)
      expect(visitor.reactElements[0]).toBe(result[0])
    })

    it("increments transient keys across multiple calls", () => {
      const t1 = text("t1")
      const t2 = text("t2")

      const node1 = new TransientNode("run-a", undefined, [t1])
      const node2 = new TransientNode("run-a", undefined, [t2])

      const rootBlock = block([])
      const mockProps = createMockProps(rootBlock)
      const visitor = new RenderNodeVisitor(mockProps)

      const r1 = visitor.visitTransientNode(node1)
      const r2 = visitor.visitTransientNode(node2)

      if (!Array.isArray(r1) || !Array.isArray(r2)) {
        throw new Error("Expected visitTransientNode to return arrays")
      }
      expect((r1[0] as React.ReactElement).key).toBe("transient-0")
      expect((r2[0] as React.ReactElement).key).toBe("transient-1")
    })

    it("supports a BlockNode anchor", () => {
      const transient1 = text("t1")
      const anchorBlock = block([text("child-of-anchor")])
      const transientNode = new TransientNode("run-3", anchorBlock, [
        transient1,
      ])

      const rootBlock = block([])
      const mockProps = createMockProps(rootBlock)
      const visitor = new RenderNodeVisitor(mockProps)

      const result = visitor.visitTransientNode(transientNode)

      if (!Array.isArray(result)) {
        throw new Error("Expected visitTransientNode to return an array")
      }
      expect(result).toHaveLength(2)
      expect((result[0] as React.ReactElement).key).toBe("transient-0")
      // Anchor BlockNode will be the first visited element in this visitor; key should be "0"
      expect((result[1] as React.ReactElement).key).toBe("0")
    })
  })
})
