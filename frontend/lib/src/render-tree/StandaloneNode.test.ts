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

import { Logo } from "@streamlit/protobuf"

import { StandaloneNode } from "./StandaloneNode"
import { AppNodeVisitor } from "./visitors/AppNodeVisitor.interface"

const MOCK_LOGO = Logo.create({
  image: "https://example.com/logo.png",
})

const SCRIPT_RUN_ID = "test_script_run_id"
const ACTIVE_SCRIPT_HASH = "test_active_script_hash"

describe("StandaloneNode", () => {
  describe("constructor", () => {
    it("creates a StandaloneNode with a non-null element", () => {
      const node = new StandaloneNode<Logo>(
        MOCK_LOGO,
        SCRIPT_RUN_ID,
        ACTIVE_SCRIPT_HASH
      )

      expect(node.element).toBe(MOCK_LOGO)
      expect(node.scriptRunId).toBe(SCRIPT_RUN_ID)
      expect(node.activeScriptHash).toBe(ACTIVE_SCRIPT_HASH)
    })

    it("creates a StandaloneNode with a null element", () => {
      const node = new StandaloneNode<Logo>(
        null,
        SCRIPT_RUN_ID,
        ACTIVE_SCRIPT_HASH
      )

      expect(node.element).toBeNull()
      expect(node.scriptRunId).toBe(SCRIPT_RUN_ID)
      expect(node.activeScriptHash).toBe(ACTIVE_SCRIPT_HASH)
    })

    it("works with different generic types", () => {
      interface CustomElement {
        id: string
        value: number
      }

      const customElement: CustomElement = { id: "test", value: 42 }
      const node = new StandaloneNode<CustomElement>(
        customElement,
        SCRIPT_RUN_ID,
        ACTIVE_SCRIPT_HASH
      )

      expect(node.element).toBe(customElement)
      expect(node.element?.id).toBe("test")
      expect(node.element?.value).toBe(42)
      expect(node.scriptRunId).toBe(SCRIPT_RUN_ID)
      expect(node.activeScriptHash).toBe(ACTIVE_SCRIPT_HASH)
    })
  })

  describe("accept method", () => {
    it("calls visitor.visitStandaloneNode with non-null element", () => {
      const node = new StandaloneNode<Logo>(
        MOCK_LOGO,
        SCRIPT_RUN_ID,
        ACTIVE_SCRIPT_HASH
      )

      const mockVisitor: AppNodeVisitor<string> = {
        visitElementNode: vi.fn(),
        visitBlockNode: vi.fn(),
        visitStandaloneNode: vi.fn().mockReturnValue("visited"),
      }

      const result = node.accept(mockVisitor)

      expect(mockVisitor.visitStandaloneNode).toHaveBeenCalledWith(node)
      expect(mockVisitor.visitStandaloneNode).toHaveBeenCalledTimes(1)
      expect(mockVisitor.visitElementNode).not.toHaveBeenCalled()
      expect(mockVisitor.visitBlockNode).not.toHaveBeenCalled()
      expect(result).toBe("visited")
    })

    it("calls visitor.visitStandaloneNode with null element", () => {
      const node = new StandaloneNode<Logo>(
        null,
        SCRIPT_RUN_ID,
        ACTIVE_SCRIPT_HASH
      )

      const mockVisitor: AppNodeVisitor<string> = {
        visitElementNode: vi.fn(),
        visitBlockNode: vi.fn(),
        visitStandaloneNode: vi.fn().mockReturnValue("visited null"),
      }

      const result = node.accept(mockVisitor)

      expect(mockVisitor.visitStandaloneNode).toHaveBeenCalledWith(node)
      expect(mockVisitor.visitStandaloneNode).toHaveBeenCalledTimes(1)
      expect(mockVisitor.visitElementNode).not.toHaveBeenCalled()
      expect(mockVisitor.visitBlockNode).not.toHaveBeenCalled()
      expect(result).toBe("visited null")
    })

    it("passes through visitor return value", () => {
      const node = new StandaloneNode(
        MOCK_LOGO,
        SCRIPT_RUN_ID,
        ACTIVE_SCRIPT_HASH
      )

      const complexReturnValue = { processed: true, nodeId: "123" }
      const mockVisitor: AppNodeVisitor<typeof complexReturnValue> = {
        visitElementNode: vi.fn(),
        visitBlockNode: vi.fn(),
        visitStandaloneNode: vi.fn().mockReturnValue(complexReturnValue),
      }

      const result = node.accept(mockVisitor)

      expect(result).toBe(complexReturnValue)
      expect(result.processed).toBe(true)
      expect(result.nodeId).toBe("123")
    })

    it("works with different generic types and return types", () => {
      interface CustomElement {
        id: string
        value: number
      }

      const customElement: CustomElement = { id: "test", value: 42 }
      const node = new StandaloneNode<CustomElement>(
        customElement,
        SCRIPT_RUN_ID,
        ACTIVE_SCRIPT_HASH
      )

      const mockVisitor: AppNodeVisitor<number> = {
        visitElementNode: vi.fn(),
        visitBlockNode: vi.fn(),
        visitStandaloneNode: vi.fn().mockReturnValue(99),
      }

      const result = node.accept(mockVisitor)

      expect(mockVisitor.visitStandaloneNode).toHaveBeenCalledWith(node)
      expect(result).toBe(99)
    })
  })
})
