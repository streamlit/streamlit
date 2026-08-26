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

import { lazy } from "react"

import { screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ElementNode } from "~lib/AppNode"
import { render } from "~lib/test_util"

import { ElementContainer } from "./ElementContainer"
import { ElementContainerConfig } from "./ElementContainerConfig"

// Helper to create a mock element node
const createMockElementNode = (
  type: string,
  options: { id?: string } = {}
): ElementNode =>
  ({
    element: {
      type,
      [type]: options.id ? { id: options.id } : {},
      ...(options.id ? { id: options.id } : {}),
    },
    metadata: {},
    scriptRunId: "test-script-run",
  }) as unknown as ElementNode

describe("ElementContainer", () => {
  const mockNode = createMockElementNode("markdown")

  it("renders children inside the container", () => {
    render(
      <ElementContainer
        node={mockNode}
        config={ElementContainerConfig.DEFAULT}
        isStale={false}
      >
        <div data-testid="test-child">Test Content</div>
      </ElementContainer>
    )

    expect(screen.getByTestId("test-child")).toBeVisible()
    expect(screen.getByText("Test Content")).toBeVisible()
  })

  it("renders the element container with correct test id", () => {
    render(
      <ElementContainer
        node={mockNode}
        config={ElementContainerConfig.DEFAULT}
        isStale={false}
      >
        <div>Content</div>
      </ElementContainer>
    )

    expect(screen.getByTestId("stElementContainer")).toBeVisible()
  })

  it("applies stElementContainer CSS class", () => {
    render(
      <ElementContainer
        node={mockNode}
        config={ElementContainerConfig.DEFAULT}
        isStale={false}
      >
        <div>Content</div>
      </ElementContainer>
    )

    const container = screen.getByTestId("stElementContainer")
    expect(container).toHaveClass("stElementContainer")
    expect(container).toHaveClass("element-container")
  })

  describe("user key handling", () => {
    it("applies user-provided key as CSS class for custom styling", () => {
      // Element ID format: $$ID-<hash>-<userKey>
      const nodeWithKey = createMockElementNode("markdown", {
        id: "$$ID-abc123-my_custom_key",
      })
      render(
        <ElementContainer
          node={nodeWithKey}
          config={ElementContainerConfig.DEFAULT}
          isStale={false}
        >
          <div>Content</div>
        </ElementContainer>
      )

      expect(screen.getByTestId("stElementContainer")).toHaveClass(
        "st-key-my_custom_key"
      )
    })

    it("does not apply key class when no user key is provided", () => {
      render(
        <ElementContainer
          node={mockNode}
          config={ElementContainerConfig.DEFAULT}
          isStale={false}
        >
          <div>Content</div>
        </ElementContainer>
      )

      const container = screen.getByTestId("stElementContainer")
      // Should not have any st-key-* class
      expect(container.className).not.toMatch(/st-key-/)
    })
  })

  describe("stale state", () => {
    it("marks container as stale for styling when isStale is true", () => {
      render(
        <ElementContainer
          node={mockNode}
          config={ElementContainerConfig.DEFAULT}
          isStale={true}
        >
          <div>Content</div>
        </ElementContainer>
      )

      expect(screen.getByTestId("stElementContainer")).toHaveAttribute(
        "data-stale",
        "true"
      )
    })

    it("marks container as not stale when isStale is false", () => {
      render(
        <ElementContainer
          node={mockNode}
          config={ElementContainerConfig.DEFAULT}
          isStale={false}
        >
          <div>Content</div>
        </ElementContainer>
      )

      expect(screen.getByTestId("stElementContainer")).toHaveAttribute(
        "data-stale",
        "false"
      )
    })
  })

  describe("config application", () => {
    it("applies overflow visible style when config specifies it", () => {
      const config = new ElementContainerConfig({
        styleOverrides: { overflow: "visible" },
      })

      render(
        <ElementContainer node={mockNode} config={config} isStale={false}>
          <div>Content</div>
        </ElementContainer>
      )

      const container = screen.getByTestId("stElementContainer")
      expect(container).toHaveStyle({ overflow: "visible" })
    })

    it("applies full width style when config specifies it", () => {
      const config = new ElementContainerConfig({
        styleOverrides: { width: "100%" },
      })

      render(
        <ElementContainer node={mockNode} config={config} isStale={false}>
          <div>Content</div>
        </ElementContainer>
      )

      const container = screen.getByTestId("stElementContainer")
      expect(container).toHaveStyle({ width: "100%" })
    })

    it("applies custom styleOverrides from config", () => {
      const config = new ElementContainerConfig({
        styleOverrides: { height: "50px", flex: "1" },
      })

      render(
        <ElementContainer node={mockNode} config={config} isStale={false}>
          <div>Content</div>
        </ElementContainer>
      )

      const container = screen.getByTestId("stElementContainer")
      expect(container).toHaveStyle({ height: "50px", flex: "1" })
    })
  })

  describe("error handling", () => {
    it("catches errors and displays error UI without crashing", () => {
      // Suppress console.error for this test
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {})

      const ThrowingComponent = (): never => {
        throw new Error("Test component error")
      }

      // Should not throw - error boundary catches it
      expect(() => {
        render(
          <ElementContainer
            node={mockNode}
            config={ElementContainerConfig.DEFAULT}
            isStale={false}
          >
            <ThrowingComponent />
          </ElementContainer>
        )
      }).not.toThrow()

      // Error boundary shows error UI
      expect(screen.getByTestId("stAlertContainer")).toBeVisible()
      expect(screen.getByText("Test component error")).toBeVisible()

      consoleErrorSpy.mockRestore()
    })
  })

  describe("loading state", () => {
    it("shows skeleton placeholder while lazy component loads", () => {
      // Create a lazy component that never resolves (to test Suspense fallback)
      const LazyComponent = lazy(
        () =>
          new Promise<{ default: React.ComponentType }>(() => {
            // Never resolves
          })
      )

      render(
        <ElementContainer
          node={mockNode}
          config={ElementContainerConfig.DEFAULT}
          isStale={false}
        >
          <LazyComponent />
        </ElementContainer>
      )

      expect(screen.getByTestId("stSkeleton")).toBeVisible()
    })
  })
})
