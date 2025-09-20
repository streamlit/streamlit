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

import React from "react"

import { Logo } from "@streamlit/protobuf"

import { FileUploadClient } from "~lib/FileUploadClient"
import { mockEndpoints, mockSessionInfo } from "~lib/mocks/mocks"
import { BlockNode, StandaloneNode } from "~lib/render-tree"
import { block, text } from "~lib/render-tree/test-utils"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { RenderNodeVisitor } from "./RenderNodeVisitor"

import { BlockPropsWithoutWidth } from "./index"

const FAKE_SCRIPT_HASH = "fake_script_hash"
const FAKE_SCRIPT_RUN_ID = "fake_script_run_id"

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
})

describe("RenderNodeVisitor", () => {
  describe("constructor", () => {
    it("creates visitor with initial state", () => {
      const mockBlock = block([])
      const mockProps = createMockProps(mockBlock)
      const visitor = new RenderNodeVisitor(mockProps, false)

      expect(visitor.reactElements).toEqual([])
      expect(visitor.reactElements).toHaveLength(0)
    })

    it("creates visitor with disableFullscreenMode flag", () => {
      const mockBlock = block([])
      const mockProps = createMockProps(mockBlock)
      const visitor = new RenderNodeVisitor(mockProps, true)

      expect(visitor.reactElements).toEqual([])
    })
  })

  describe("visitElementNode", () => {
    it("returns React element for ElementNode", () => {
      const elementNode = text("test element")
      const mockBlock = block([])
      const mockProps = createMockProps(mockBlock)
      const visitor = new RenderNodeVisitor(mockProps, false)

      const result = visitor.visitElementNode(elementNode)

      expect(result).not.toBeNull()
      expect(React.isValidElement(result)).toBe(true)
      expect(visitor.reactElements).toHaveLength(1)
      expect(visitor.reactElements[0]).toBe(result)
    })

    it("increments index after visiting ElementNode", () => {
      const elementNode1 = text("element 1")
      const elementNode2 = text("element 2")
      const mockBlock = block([])
      const mockProps = createMockProps(mockBlock)
      const visitor = new RenderNodeVisitor(mockProps, false)

      const result1 = visitor.visitElementNode(elementNode1)
      const result2 = visitor.visitElementNode(elementNode2)

      expect(result1).not.toBe(result2)
      expect(visitor.reactElements).toHaveLength(2)
      expect(visitor.reactElements[0]).toBe(result1)
      expect(visitor.reactElements[1]).toBe(result2)
    })

    it("handles duplicate element keys by filtering out duplicates", () => {
      // Create two identical text elements - they should have the same internal structure
      const element1 = text("same text")
      const element2 = text("same text")

      const mockBlock = block([])
      const mockProps = createMockProps(mockBlock)
      const visitor = new RenderNodeVisitor(mockProps, false)

      const result1 = visitor.visitElementNode(element1)
      const result2 = visitor.visitElementNode(element2)

      // Both should be valid React elements (they don't have duplicate IDs from getElementId)
      expect(result1).not.toBeNull()
      expect(React.isValidElement(result1)).toBe(true)
      expect(result2).not.toBeNull()
      expect(React.isValidElement(result2)).toBe(true)
      expect(visitor.reactElements).toHaveLength(2)
    })

    it("handles elements without IDs using index as key", () => {
      const elementNode = text("test element")

      const mockBlock = block([])
      const mockProps = createMockProps(mockBlock)
      const visitor = new RenderNodeVisitor(mockProps, false)

      const result = visitor.visitElementNode(elementNode)

      expect(result).not.toBeNull()
      expect(React.isValidElement(result)).toBe(true)
      expect(visitor.reactElements).toHaveLength(1)
    })
  })

  describe("visitBlockNode", () => {
    it("returns React element for BlockNode", () => {
      const blockNode = block([text("child")])
      const mockBlock = block([])
      const mockProps = createMockProps(mockBlock)
      const visitor = new RenderNodeVisitor(mockProps, false)

      const result = visitor.visitBlockNode(blockNode)

      expect(result).not.toBeNull()
      expect(React.isValidElement(result)).toBe(true)
      expect(visitor.reactElements).toHaveLength(1)
      expect(visitor.reactElements[0]).toBe(result)
    })

    it("increments index after visiting BlockNode", () => {
      const blockNode1 = block([text("child1")])
      const blockNode2 = block([text("child2")])
      const mockBlock = block([])
      const mockProps = createMockProps(mockBlock)
      const visitor = new RenderNodeVisitor(mockProps, false)

      const result1 = visitor.visitBlockNode(blockNode1)
      const result2 = visitor.visitBlockNode(blockNode2)

      expect(result1).not.toBe(result2)
      expect(visitor.reactElements).toHaveLength(2)
      expect(visitor.reactElements[0]).toBe(result1)
      expect(visitor.reactElements[1]).toBe(result2)
    })

    it("uses index as key for BlockNode", () => {
      const blockNode = block([])
      const mockBlock = block([])
      const mockProps = createMockProps(mockBlock)
      const visitor = new RenderNodeVisitor(mockProps, false)

      const result = visitor.visitBlockNode(blockNode)

      expect(result).not.toBeNull()
      expect(React.isValidElement(result)).toBe(true)
      // The key should be "0" for the first block
      expect((result as React.ReactElement).key).toBe("0")
    })

    it("passes disableFullscreenMode prop correctly", () => {
      const blockNode = block([])
      const mockBlock = block([])
      const mockProps = createMockProps(mockBlock)
      const visitor = new RenderNodeVisitor(mockProps, true)

      const result = visitor.visitBlockNode(blockNode)

      expect(result).not.toBeNull()
      expect(React.isValidElement(result)).toBe(true)
      // Check that the props contain disableFullscreenMode: true
      const props = (result as React.ReactElement).props
      expect(props.disableFullscreenMode).toBe(true)
    })
  })

  describe("visitStandaloneNode", () => {
    it("returns null for StandaloneNode with Logo", () => {
      const logo = Logo.create({ image: "https://example.com/logo.png" })
      const standaloneNode = new StandaloneNode<Logo>(
        logo,
        FAKE_SCRIPT_RUN_ID,
        FAKE_SCRIPT_HASH
      )

      const mockBlock = block([])
      const mockProps = createMockProps(mockBlock)
      const visitor = new RenderNodeVisitor(mockProps, false)

      const result = visitor.visitStandaloneNode(standaloneNode)

      expect(result).toBeNull()
      expect(visitor.reactElements).toHaveLength(0)
    })

    it("returns null for StandaloneNode with null element", () => {
      const standaloneNode = new StandaloneNode<Logo>(
        null,
        FAKE_SCRIPT_RUN_ID,
        FAKE_SCRIPT_HASH
      )

      const mockBlock = block([])
      const mockProps = createMockProps(mockBlock)
      const visitor = new RenderNodeVisitor(mockProps, false)

      const result = visitor.visitStandaloneNode(standaloneNode)

      expect(result).toBeNull()
      expect(visitor.reactElements).toHaveLength(0)
    })

    it("returns null for StandaloneNode with custom generic type", () => {
      interface CustomElement {
        id: string
        value: number
      }

      const customElement: CustomElement = { id: "test", value: 42 }
      const standaloneNode = new StandaloneNode<CustomElement>(
        customElement,
        FAKE_SCRIPT_RUN_ID,
        FAKE_SCRIPT_HASH
      )

      const mockBlock = block([])
      const mockProps = createMockProps(mockBlock)
      const visitor = new RenderNodeVisitor(mockProps, false)

      const result = visitor.visitStandaloneNode(standaloneNode)

      expect(result).toBeNull()
      expect(visitor.reactElements).toHaveLength(0)
    })
  })

  describe("mixed node types", () => {
    it("handles visiting multiple different node types", () => {
      const elementNode = text("element")
      const blockNode = block([text("block child")])
      const standaloneNode = new StandaloneNode<Logo>(
        Logo.create({ image: "https://example.com/logo.png" }),
        FAKE_SCRIPT_RUN_ID,
        FAKE_SCRIPT_HASH
      )

      const mockBlock = block([])
      const mockProps = createMockProps(mockBlock)
      const visitor = new RenderNodeVisitor(mockProps, false)

      const elementResult = visitor.visitElementNode(elementNode)
      const blockResult = visitor.visitBlockNode(blockNode)
      const standaloneResult = visitor.visitStandaloneNode(standaloneNode)

      expect(elementResult).not.toBeNull()
      expect(React.isValidElement(elementResult)).toBe(true)
      expect(blockResult).not.toBeNull()
      expect(React.isValidElement(blockResult)).toBe(true)
      expect(standaloneResult).toBeNull()

      expect(visitor.reactElements).toHaveLength(2)
      expect(visitor.reactElements[0]).toBe(elementResult)
      expect(visitor.reactElements[1]).toBe(blockResult)
    })
  })

  describe("static collectReactElements", () => {
    it("returns empty array for block with no children", () => {
      const emptyBlock = block([])
      const mockProps = createMockProps(emptyBlock)

      const result = RenderNodeVisitor.collectReactElements(mockProps, false)

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

      const result = RenderNodeVisitor.collectReactElements(mockProps, false)

      expect(result).toHaveLength(3)
      result.forEach(element => {
        expect(element).not.toBeNull()
        expect(React.isValidElement(element)).toBe(true)
      })
    })

    it("filters out null elements from StandaloneNodes", () => {
      const elementNode = text("element")
      const standaloneNode = new StandaloneNode<Logo>(
        Logo.create({ image: "https://example.com/logo.png" }),
        FAKE_SCRIPT_RUN_ID,
        FAKE_SCRIPT_HASH
      )
      const parentBlock = block([elementNode, standaloneNode])
      const mockProps = createMockProps(parentBlock)

      const result = RenderNodeVisitor.collectReactElements(mockProps, false)

      // Should only have the element, not the standalone node
      expect(result).toHaveLength(1)
      expect(result[0]).not.toBeNull()
      expect(React.isValidElement(result[0])).toBe(true)
    })

    it("handles disableFullscreenMode flag", () => {
      const parentBlock = block([text("element")])
      const mockProps = createMockProps(parentBlock)

      const result = RenderNodeVisitor.collectReactElements(mockProps, true)

      expect(result).toHaveLength(1)
      expect(result[0]).not.toBeNull()
      expect(React.isValidElement(result[0])).toBe(true)
      // Check that the props contain disableFullscreenMode: true
      const props = (result[0] as React.ReactElement).props
      expect(props.disableFullscreenMode).toBe(true)
    })

    it("creates new visitor instance for each call", () => {
      const parentBlock = block([text("element")])
      const mockProps = createMockProps(parentBlock)

      const result1 = RenderNodeVisitor.collectReactElements(mockProps, false)
      const result2 = RenderNodeVisitor.collectReactElements(mockProps, false)

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

      const result = RenderNodeVisitor.collectReactElements(mockProps, false)

      // Should have 4 elements: 2 text elements + 2 block elements
      expect(result).toHaveLength(4)
      result.forEach(element => {
        expect(element).not.toBeNull()
        expect(React.isValidElement(element)).toBe(true)
      })
    })
  })

  describe("element key management", () => {
    it("maintains unique keys for different elements", () => {
      const element1 = text("element 1")
      const element2 = text("element 2")
      const parentBlock = block([element1, element2])
      const mockProps = createMockProps(parentBlock)

      const result = RenderNodeVisitor.collectReactElements(mockProps, false)

      expect(result).toHaveLength(2)
      const keys = result.map(element => (element as React.ReactElement).key)
      expect(keys[0]).not.toBe(keys[1])
    })

    it("handles elements with same content correctly", () => {
      const element1 = text("same content")
      const element2 = text("same content")
      const parentBlock = block([element1, element2])
      const mockProps = createMockProps(parentBlock)

      const result = RenderNodeVisitor.collectReactElements(mockProps, false)

      // Should render both elements since they don't have duplicate element IDs
      expect(result).toHaveLength(2)
      expect(result[0]).not.toBeNull()
      expect(React.isValidElement(result[0])).toBe(true)
      expect(result[1]).not.toBeNull()
      expect(React.isValidElement(result[1])).toBe(true)
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

      const result = RenderNodeVisitor.collectReactElements(mockProps, false)

      expect(result).toHaveLength(3)
      result.forEach(element => {
        expect(element).not.toBeNull()
        expect(React.isValidElement(element)).toBe(true)
      })
    })
  })
})
