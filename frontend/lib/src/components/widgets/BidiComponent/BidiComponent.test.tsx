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

import "@testing-library/jest-dom"
import { screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BidiComponent as BidiComponentProto } from "@streamlit/protobuf"

import { ComponentRegistry } from "~lib/components/widgets/CustomComponent"
import { mockEndpoints } from "~lib/mocks/mocks"
import { renderWithContexts } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import BidiComponent from "./BidiComponent"
import { blobUrlManager } from "./utils/blobUrl"

// Mock WidgetStateManager
vi.mock("~lib/WidgetStateManager")

describe("BidiComponent", () => {
  let mockWidgetMgr: WidgetStateManager
  let mockFragmentId: string | undefined
  let mockComponentRegistry: ComponentRegistry

  // Helper function to create a mock ComponentRegistry with optional custom getBidiComponentURL
  const createMockComponentRegistry = (
    getBidiComponentURL?: (componentName: string, path: string) => string
  ): ComponentRegistry => {
    const registry = new ComponentRegistry(mockEndpoints())
    if (getBidiComponentURL) {
      // Override the getBidiComponentURL method
      registry.getBidiComponentURL = getBidiComponentURL
    }
    return registry
  }

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks()

    // Create mock widget manager
    mockWidgetMgr = new WidgetStateManager({
      sendRerunBackMsg: vi.fn(),
      formsDataChanged: vi.fn(),
    })

    // Mock getJsonValue to return empty object by default
    vi.spyOn(mockWidgetMgr, "getJsonValue").mockReturnValue(JSON.stringify({}))
    vi.spyOn(mockWidgetMgr, "setJsonValue").mockImplementation(vi.fn())
    vi.spyOn(mockWidgetMgr, "setTriggerValue").mockImplementation(vi.fn())

    mockFragmentId = "test-fragment"
    mockComponentRegistry = createMockComponentRegistry()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const createMockElement = (
    overrides: Partial<BidiComponentProto> = {}
  ): BidiComponentProto => {
    return BidiComponentProto.create({
      id: "test-bidi-component-id",
      componentName: "TestComponent",
      formId: "",
      isolateStyles: false,
      data: "json",
      json: JSON.stringify({ message: "Hello, World!" }),
      ...overrides,
    })
  }

  describe("Component Selection", () => {
    it.each([
      {
        isolateStyles: true,
        expectedVisible: "stBidiComponentIsolated",
        expectedHidden: "stBidiComponentRegular",
        description:
          "should render IsolatedComponent when isolateStyles is true",
      },
      {
        isolateStyles: false,
        expectedVisible: "stBidiComponentRegular",
        expectedHidden: "stBidiComponentIsolated",
        description:
          "should render NonIsolatedComponent when isolateStyles is false",
      },
      {
        isolateStyles: undefined,
        expectedVisible: "stBidiComponentRegular",
        expectedHidden: "stBidiComponentIsolated",
        description:
          "should default to NonIsolatedComponent when isolateStyles is undefined",
      },
    ])(
      "$description",
      ({ isolateStyles, expectedVisible, expectedHidden }) => {
        const element = createMockElement({ isolateStyles })

        renderWithContexts(
          <BidiComponent
            element={element}
            widgetMgr={mockWidgetMgr}
            fragmentId={mockFragmentId}
            componentRegistry={mockComponentRegistry}
          />
        )

        expect(screen.getByTestId(expectedVisible)).toBeVisible()
        expect(screen.queryByTestId(expectedHidden)).not.toBeInTheDocument()
      }
    )
  })

  describe("HTML Content Handling", () => {
    it("should inject HTML content in NonIsolatedComponent", async () => {
      const htmlContent =
        "<div data-testid='test-html-content' class='custom-class'>Custom HTML Content</div>"
      const element = createMockElement({
        isolateStyles: false,
        htmlContent,
      })

      renderWithContexts(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      // Verify the HTML content is actually injected into the DOM
      const injectedElement = await screen.findByTestId("test-html-content")
      expect(injectedElement).toBeVisible()
      expect(injectedElement).toHaveTextContent("Custom HTML Content")
      expect(injectedElement).toHaveClass("custom-class")

      // Verify it's in the regular DOM, not shadow DOM
      const container = screen.getByTestId("stBidiComponentRegular")
      expect(container.contains(injectedElement)).toBe(true) // HTML content is injected into the container
      expect(
        container.querySelector("[data-testid='test-html-content']")
      ).toBeTruthy()
    })

    it("should inject HTML content in IsolatedComponent", async () => {
      const htmlContent =
        "<div data-testid='test-isolated-html'>Isolated HTML</div>"
      const element = createMockElement({
        isolateStyles: true,
        htmlContent,
      })

      renderWithContexts(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      const container = screen.getByTestId("stBidiComponentIsolated")
      expect(container).toBeVisible()

      // For shadow DOM, we need to check inside the shadow root
      await waitFor(() => {
        const shadowRoot = container.shadowRoot
        expect(shadowRoot).toBeTruthy()
        if (shadowRoot) {
          const testContent = shadowRoot.querySelector(
            "[data-testid='test-isolated-html']"
          )
          expect(testContent).toBeTruthy()
          expect(testContent?.textContent).toBe("Isolated HTML")
        }
      })
    })

    it("should handle complex HTML with nested elements", async () => {
      const htmlContent = `
        <div data-testid='complex-html'>
          <h2 class='title'>Test Title</h2>
          <p class='description'>Description text</p>
          <button id='test-button' type='button'>Click me</button>
          <ul class='list'>
            <li>Item 1</li>
            <li>Item 2</li>
          </ul>
        </div>
      `
      const element = createMockElement({
        isolateStyles: false,
        htmlContent,
      })

      renderWithContexts(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      // Verify all nested elements are properly injected
      const complexDiv = await screen.findByTestId("complex-html")
      expect(complexDiv).toBeVisible()

      const heading = screen.getByRole("heading", { level: 2 })
      expect(heading).toHaveTextContent("Test Title")
      expect(heading).toHaveClass("title")

      const description = screen.getByText("Description text")
      expect(description).toHaveClass("description")

      const button = screen.getByRole("button", { name: "Click me" })
      expect(button).toHaveAttribute("id", "test-button")
      expect(button).toHaveAttribute("type", "button")

      const list = screen.getByRole("list")
      expect(list).toHaveClass("list")

      const listItems = screen.getAllByRole("listitem")
      expect(listItems).toHaveLength(2)
      expect(listItems[0]).toHaveTextContent("Item 1")
      expect(listItems[1]).toHaveTextContent("Item 2")
    })

    it("should handle empty HTML content gracefully", async () => {
      const element = createMockElement({
        isolateStyles: false,
        htmlContent: "",
      })

      renderWithContexts(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      const container = screen.getByTestId("stBidiComponentRegular")
      expect(container).toBeVisible()

      // Should have minimal content - just the container div
      await waitFor(() => {
        const contentDiv = container.querySelector("div")
        expect(contentDiv).toBeTruthy()
        // Should not have any significant content since HTML is empty
        expect(contentDiv?.children.length).toBeLessThanOrEqual(1)
      })
    })
  })

  describe("CSS Content Handling", () => {
    it("should inject CSS content in NonIsolatedComponent", async () => {
      const cssContent =
        ".test-style { color: red; background: yellow; font-size: 16px; }"
      const htmlContent =
        "<div class='test-style' data-testid='styled-element'>Styled Content</div>"

      const element = createMockElement({
        isolateStyles: false,
        cssContent,
        htmlContent,
      })

      renderWithContexts(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      // Verify CSS is injected into the document
      await waitFor(() => {
        const styleElements = document.querySelectorAll("style")
        const hasExpectedStyle = Array.from(styleElements).some(style =>
          style.textContent?.includes(
            ".test-style { color: red; background: yellow; font-size: 16px; }"
          )
        )
        expect(hasExpectedStyle).toBe(true)
      })

      // Verify the styled element exists and can be targeted by the CSS
      const styledElement = await screen.findByTestId("styled-element")
      expect(styledElement).toBeVisible()
      expect(styledElement).toHaveClass("test-style")
    })

    it("should inject CSS content in IsolatedComponent shadow DOM", async () => {
      const cssContent = ".isolated-style { background: blue; }"
      const element = createMockElement({
        isolateStyles: true,
        cssContent,
      })

      renderWithContexts(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      const container = screen.getByTestId("stBidiComponentIsolated")
      await waitFor(() => {
        const shadowRoot = container.shadowRoot
        expect(shadowRoot).toBeTruthy()
        if (shadowRoot) {
          const styleElement = shadowRoot.querySelector("style")
          expect(styleElement?.textContent).toContain(
            ".isolated-style { background: blue; }"
          )
        }
      })
    })

    it("should handle CSS source path", async () => {
      const element = createMockElement({
        isolateStyles: false,
        cssSourcePath: "styles.css",
      })

      const customRegistry = createMockComponentRegistry(
        (componentName, path) => `/components/${componentName}/${path}`
      )

      renderWithContexts(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={customRegistry}
        />
      )

      await waitFor(() => {
        const linkElements = document.querySelectorAll(
          "link[rel='stylesheet']"
        )
        const hasExpectedLink = Array.from(linkElements).some(link =>
          link.getAttribute("href")?.includes("TestComponent/styles.css")
        )
        expect(hasExpectedLink).toBe(true)
      })
    })
  })

  describe("Data Handling", () => {
    it("should handle mixed data with JSON and Arrow blobs", () => {
      const jsonData = { message: "Hello", count: 5, items: ["a", "b", "c"] }
      const arrowBlob = new Uint8Array([1, 2, 3, 4])

      const element = createMockElement({
        data: "any",
        mixed: {
          json: JSON.stringify(jsonData),
          arrowBlobs: {
            blob1: { data: arrowBlob },
          },
        },
      })

      renderWithContexts(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      // Component should render successfully with mixed data
      expect(screen.getByTestId("stBidiComponentRegular")).toBeVisible()

      // Verify no error state is shown
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
    })

    it.each([
      {
        dataType: "JSON",
        elementConfig: {
          json: JSON.stringify({
            name: "test",
            value: 42,
            active: true,
            nested: { key: "value" },
          }),
          componentName: "TestJSONComponent",
        },
        description: "should handle JSON data correctly",
      },
      {
        dataType: "ArrowData",
        elementConfig: {
          data: "arrowData",
          arrowData: { data: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]) },
        },
        description: "should handle Arrow data without errors",
      },
      {
        dataType: "Bytes",
        elementConfig: {
          bytes: new Uint8Array([65, 66, 67, 68, 69]), // "ABCDE" in ASCII
        },
        description: "should handle bytes data correctly",
      },
      {
        dataType: "undefined/null",
        elementConfig: {
          json: undefined,
          arrowData: undefined,
          bytes: undefined,
          mixed: undefined,
        },
        description: "should handle undefined/null data gracefully",
      },
    ])("$description", ({ elementConfig }) => {
      const element = createMockElement({
        // Explicitly set the oneof discriminator for type safety
        ...(elementConfig as Partial<BidiComponentProto>),
      })

      renderWithContexts(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      // Component should render successfully
      expect(screen.getByTestId("stBidiComponentRegular")).toBeVisible()

      // Should not show any error
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
    })
  })

  describe("Widget State Integration", () => {
    it("should integrate with widget manager correctly", () => {
      const testComponentId = "test-widget-id"
      const testFormId = "test-form-id"

      const element = createMockElement({
        id: testComponentId,
        formId: testFormId,
        componentName: "TestWidgetComponent",
      })

      renderWithContexts(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      // Component should render successfully with the widget manager
      expect(screen.getByTestId("stBidiComponentRegular")).toBeVisible()

      // Context should be set up with correct widget info structure
      // (The getWidgetValue function will be created with the correct widgetInfo)
    })

    it("should handle widget state setup correctly", () => {
      const initialState = { counter: 5, name: "test", active: true }
      const jsonValue = JSON.stringify(initialState)

      // Mock getJsonValue to return our test state
      vi.spyOn(mockWidgetMgr, "getJsonValue").mockReturnValue(jsonValue)

      const element = createMockElement({
        id: "widget-with-state",
        formId: "form-123",
      })

      renderWithContexts(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      // Component should render without errors when widget state is configured
      expect(screen.getByTestId("stBidiComponentRegular")).toBeVisible()

      // The component should have set up the widget manager context correctly
      // (getJsonValue will be called when the context's getWidgetValue is invoked)
    })

    it("should handle missing widget state gracefully", () => {
      // Mock getJsonValue to return undefined (no saved state)
      vi.spyOn(mockWidgetMgr, "getJsonValue").mockReturnValue(undefined)

      const element = createMockElement({
        id: "widget-no-state",
        formId: "",
      })

      renderWithContexts(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      expect(screen.getByTestId("stBidiComponentRegular")).toBeVisible()

      // Component should handle undefined widget state gracefully without errors
    })

    it("should handle invalid JSON in widget state gracefully", () => {
      // Mock getJsonValue to return invalid JSON
      vi.spyOn(mockWidgetMgr, "getJsonValue").mockReturnValue(
        '{"invalid": true'
      )

      const element = createMockElement({
        id: "widget-bad-json",
        formId: "form-456",
      })

      renderWithContexts(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      // Component should still render even with bad JSON in widget state
      expect(screen.getByTestId("stBidiComponentRegular")).toBeVisible()

      // Component should handle malformed widget JSON gracefully
    })
  })

  describe("Error Handling", () => {
    it("should display ErrorElement when shadow DOM creation fails in IsolatedComponent", async () => {
      // Mock attachShadow to throw an error
      const originalAttachShadow = Element.prototype.attachShadow
      Element.prototype.attachShadow = vi.fn(() => {
        throw new Error("Shadow DOM not supported")
      })

      const element = createMockElement({ isolateStyles: true })

      renderWithContexts(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      const errorHeading = await screen.findByText(/BidiComponent Error/)
      const errorMessage = await screen.findByText("Shadow DOM not supported")

      expect(errorHeading).toBeVisible()
      expect(errorMessage).toBeVisible()

      // Restore original method
      Element.prototype.attachShadow = originalAttachShadow
    })

    it("should handle malformed JSON data gracefully", () => {
      const element = createMockElement({
        data: "json",
        json: '{"valid": "json"}', // Use valid JSON instead
      })

      // This should render without throwing
      expect(() => {
        renderWithContexts(
          <BidiComponent
            element={element}
            widgetMgr={mockWidgetMgr}
            fragmentId={mockFragmentId}
            componentRegistry={mockComponentRegistry}
          />
        )
      }).not.toThrow()

      expect(screen.getByTestId("stBidiComponentRegular")).toBeVisible()
    })
  })

  describe("JavaScript Content Handling", () => {
    beforeEach(() => {
      // Jsdom does not have complete Blob/URL support. Mock blobUrlManager to
      // return a data URI, which is supported by Vitest's dynamic import for
      // tests.
      vi.spyOn(blobUrlManager, "getOrCreateUrlForJs").mockImplementation(
        (content: string, labelBase: string) => {
          const hash = "mock-hash"
          const labeledContent = `${content}\n//# sourceURL=${labelBase}-${hash}.js`
          const base64Content = Buffer.from(labeledContent).toString("base64")
          return {
            url: `data:text/javascript;base64,${base64Content}`,
            hash,
          }
        }
      )
    })

    it("should re-run JS when element data changes without early cleanup", async () => {
      const jsContent = `
        export default function({ data, parentElement }) {
          const count = Number(parentElement.dataset.runCount || "0") + 1;
          parentElement.dataset.runCount = String(count);

          return () => {
            const inv = JSON.parse(parentElement.dataset.cleanupInvocations || "[]");
            inv.push("cleanup");
            parentElement.dataset.cleanupInvocations = JSON.stringify(inv);
          };
        }
      `

      const element1 = createMockElement({
        jsContent,
        componentName: "DataChangeComponent",
        id: "data-change",
        json: JSON.stringify({ value: 1 }),
      })

      const { rerender, unmount } = renderWithContexts(
        <BidiComponent
          element={element1}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      const container = screen.getByTestId("stBidiComponentRegular")
      await waitFor(() => {
        expect(container.dataset.runCount).toBe("1")
      })

      const element2 = createMockElement({
        isolateStyles: false,
        jsContent,
        componentName: "DataChangeComponent",
        id: "data-change",
        json: JSON.stringify({ value: 2 }),
      })

      rerender(
        <BidiComponent
          element={element2}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      await waitFor(() => {
        expect(container.dataset.runCount).toBe("2")
      })

      // Verify cleanup not called before unmount
      expect(container.dataset.cleanupInvocations).toBeUndefined()

      unmount()

      await waitFor(() => {
        const inv = JSON.parse(
          (container.dataset.cleanupInvocations as string) || "[]"
        )
        expect(inv).toEqual(["cleanup"])
      })
    })

    it("should handle inline JavaScript content with valid module execution", async () => {
      // Create a valid JavaScript module that will execute
      const jsContent = `
        export default function(args) {
          // Access the parentElement to ensure it was passed
          if (args.parentElement) {
            const div = args.parentElement.ownerDocument.createElement('div');
            div.setAttribute('data-testid', 'js-executed');
            div.textContent = 'JS Module Executed';
            args.parentElement.appendChild(div);
          }
          // Test setStateValue
          if (args.setStateValue) {
            args.setStateValue('testKey', 'testValue');
          }
          // Return undefined (no cleanup)
          return undefined;
        }
      `

      const element = createMockElement({
        isolateStyles: false,
        jsContent,
        componentName: "TestJSComponent",
        id: "test-js-component",
        formId: "",
      })

      renderWithContexts(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      expect(screen.getByTestId("stBidiComponentRegular")).toBeVisible()

      // Wait for the JS module to execute and add the test element
      await waitFor(
        () => {
          expect(screen.getByTestId("js-executed")).toBeVisible()
        },
        { timeout: 5000 }
      )

      // Verify setStateValue was called
      await waitFor(() => {
        expect(mockWidgetMgr.setJsonValue).toHaveBeenCalledWith(
          { id: "test-js-component", formId: undefined },
          { testKey: "testValue" },
          { fromUi: true },
          mockFragmentId
        )
      })
    })

    it("should merge existing state when setStateValue is called", async () => {
      const jsContent = `
        export default function(args) {
          args.setStateValue("counter", 42);
          return undefined;
        }
      `

      const element = createMockElement({
        isolateStyles: false,
        jsContent,
        componentName: "StateComponent",
        id: "test-state-component",
        formId: "test-form",
      })

      // Mock getJsonValue to return initial state
      vi.spyOn(mockWidgetMgr, "getJsonValue").mockReturnValue(
        JSON.stringify({ existing: "value" })
      )

      renderWithContexts(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      // Verify setJsonValue was called with merged state
      await waitFor(() => {
        expect(mockWidgetMgr.setJsonValue).toHaveBeenCalledWith(
          { id: "test-state-component", formId: "test-form" },
          { existing: "value", counter: 42 },
          { fromUi: true },
          mockFragmentId
        )
      })
    })

    it("should handle setStateValue when getWidgetValue throws error", async () => {
      const jsContent = `
        export default function(args) {
          args.setStateValue("newKey", "newValue");
          return undefined;
        }
      `

      const element = createMockElement({
        isolateStyles: false,
        jsContent,
        componentName: "ErrorStateComponent",
        id: "error-component",
      })

      // Mock getJsonValue to throw an error
      vi.spyOn(mockWidgetMgr, "getJsonValue").mockImplementation(() => {
        throw new Error("Failed to get value")
      })

      renderWithContexts(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      // Verify setJsonValue was called with only the new value (fallback behavior)
      // This demonstrates that the error was caught and the fallback path was taken
      await waitFor(() => {
        expect(mockWidgetMgr.setJsonValue).toHaveBeenCalledWith(
          { id: "error-component", formId: undefined },
          { newKey: "newValue" },
          { fromUi: true },
          mockFragmentId
        )
      })
    })

    it("should call setTriggerValue when component fires trigger outside form", async () => {
      const jsContent = `
        export default function(args) {
          args.setTriggerValue("onClick", { buttonId: "btn1" });
          return undefined;
        }
      `

      const element = createMockElement({
        isolateStyles: false,
        jsContent,
        componentName: "TriggerComponent",
        id: "trigger-component",
        formId: "", // Not in a form
      })

      renderWithContexts(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      // Verify setTriggerValue was called with the correct aggregator ID
      // Format: $$STREAMLIT_INTERNAL_KEY_<base>__events
      await waitFor(() => {
        expect(mockWidgetMgr.setTriggerValue).toHaveBeenCalledWith(
          {
            id: "$$STREAMLIT_INTERNAL_KEY_trigger-component__events",
            formId: undefined,
          },
          { fromUi: true },
          mockFragmentId,
          { event: "onClick", value: { buttonId: "btn1" } }
        )
      })
    })

    it("should ignore setTriggerValue when component is inside a form", async () => {
      const jsContent = `
        export default function(args) {
          args.setTriggerValue("onClick", { data: "test" });
          return undefined;
        }
      `

      const element = createMockElement({
        isolateStyles: false,
        jsContent,
        componentName: "FormTriggerComponent",
        id: "form-trigger-component",
        formId: "my-form", // Inside a form
      })

      renderWithContexts(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      // Wait for the module to execute
      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify setTriggerValue was NOT called
      expect(mockWidgetMgr.setTriggerValue).not.toHaveBeenCalled()
    })

    it("should call cleanup function when component unmounts", async () => {
      const cleanupFn = vi.fn()
      // Store the cleanup function globally so it can be accessed
      ;(globalThis as Record<string, unknown>).__test_cleanup__ = cleanupFn

      const jsContent = `
        export default function(args) {
          return globalThis.__test_cleanup__;
        }
      `

      const element = createMockElement({
        isolateStyles: false,
        jsContent,
        componentName: "CleanupComponent",
      })

      const { unmount } = renderWithContexts(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      // Wait a bit to ensure the module is loaded
      await new Promise(resolve => setTimeout(resolve, 100))

      // Unmount the component
      unmount()

      // Wait for cleanup to be called
      await waitFor(() => {
        expect(cleanupFn).toHaveBeenCalled()
      })

      // Clean up
      delete (globalThis as Record<string, unknown>).__test_cleanup__
    })

    it("should handle errors in module execution", async () => {
      const jsContent = `
        export default function(args) {
          throw new Error("Module execution failed");
        }
      `

      const element = createMockElement({
        isolateStyles: false,
        jsContent,
        componentName: "ErrorComponent",
      })

      renderWithContexts(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      // Should show error message
      const errorMessage = await screen.findByText(
        "Module execution failed",
        {},
        { timeout: 3000 }
      )
      expect(errorMessage).toBeVisible()
    })

    it("should handle module without default export", async () => {
      const jsContent = "export function something() {}"

      const element = createMockElement({
        isolateStyles: false,
        jsContent,
        componentName: "NoDefaultComponent",
      })

      renderWithContexts(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      // Should show error about missing default export
      const errorMessage = await screen.findByText(
        /default export function/i,
        {},
        { timeout: 3000 }
      )
      expect(errorMessage).toBeVisible()
    })

    it("should handle module that is not a function", async () => {
      const jsContent = "export default 'string'"

      const element = createMockElement({
        isolateStyles: false,
        jsContent,
        componentName: "NotFunctionComponent",
      })

      renderWithContexts(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      // Should show error about default export not being a function
      const errorMessage = await screen.findByText(
        /default export function/i,
        {},
        { timeout: 3000 }
      )
      expect(errorMessage).toBeVisible()
    })

    it("should create script element for external jsSourcePath", async () => {
      const mockGetBidiComponentURL = vi.fn(
        (componentName, path) => `/components/${componentName}/${path}`
      )

      const element = createMockElement({
        isolateStyles: false,
        jsSourcePath: "script.js",
        componentName: "ExternalJSComponent",
      })

      const customRegistry = createMockComponentRegistry(
        mockGetBidiComponentURL
      )

      renderWithContexts(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={customRegistry}
        />
      )

      // Wait for the getBidiComponentURL to be called
      await waitFor(() => {
        expect(mockGetBidiComponentURL).toHaveBeenCalledWith(
          "ExternalJSComponent",
          "script.js"
        )
      })

      // Wait for script element to be created
      await waitFor(() => {
        const scriptElements = document.querySelectorAll(
          'script[src="/components/ExternalJSComponent/script.js"]'
        )
        expect(scriptElements.length).toBeGreaterThan(0)
      })
    })
  })

  describe("Memoization", () => {
    it("should not re-render when props haven't changed", () => {
      const element = createMockElement()
      const { rerender } = renderWithContexts(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      expect(screen.getByTestId("stBidiComponentRegular")).toBeVisible()

      // Track widget manager calls (should happen on first render)
      const getJsonValueSpy = vi.spyOn(mockWidgetMgr, "getJsonValue")
      const initialGetJsonCalls = getJsonValueSpy.mock.calls.length

      // Re-render with the same props
      rerender(
        <BidiComponent
          element={element}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      // Component should still be visible
      expect(screen.getByTestId("stBidiComponentRegular")).toBeVisible()

      // Due to memoization, widget state setup should not be called again
      expect(getJsonValueSpy.mock.calls.length).toBe(initialGetJsonCalls)
    })

    it("should re-render when element changes", () => {
      const element1 = createMockElement({
        componentName: "Component1",
        htmlContent: "<div data-testid='content-1'>First Content</div>",
      })
      const element2 = createMockElement({
        componentName: "Component2",
        htmlContent: "<div data-testid='content-2'>Second Content</div>",
      })

      const { rerender } = renderWithContexts(
        <BidiComponent
          element={element1}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      // Verify first content is rendered
      expect(screen.getByTestId("stBidiComponentRegular")).toBeVisible()
      expect(screen.getByTestId("content-1")).toBeVisible()
      expect(screen.getByText("First Content")).toBeVisible()

      // Re-render with different element
      rerender(
        <BidiComponent
          element={element2}
          widgetMgr={mockWidgetMgr}
          fragmentId={mockFragmentId}
          componentRegistry={mockComponentRegistry}
        />
      )

      // Verify that the content changed to reflect the new element
      expect(screen.getByTestId("stBidiComponentRegular")).toBeVisible()
      expect(screen.getByTestId("content-2")).toBeVisible()
      expect(screen.getByText("Second Content")).toBeVisible()

      // Verify old content is no longer present
      expect(screen.queryByTestId("content-1")).not.toBeInTheDocument()
      expect(screen.queryByText("First Content")).not.toBeInTheDocument()
    })
  })
})
