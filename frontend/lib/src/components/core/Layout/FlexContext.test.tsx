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

import React, { FC, useContext } from "react"

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { FlexContext, FlexContextProvider, IFlexContext } from "./FlexContext"
import { Direction } from "./utils"

describe("FlexContextProvider", () => {
  // Helper component to consume and display context values
  const ContextConsumer: FC = () => {
    const context = useContext(FlexContext)
    return (
      <div data-testid="context-consumer">
        <div data-testid="direction">{context?.direction}</div>
        <div data-testid="isInHorizontalLayout">
          {String(context?.isInHorizontalLayout)}
        </div>
        <div data-testid="isInRoot">{String(context?.isInRoot)}</div>
        <div data-testid="parentWidth">
          {context?.parentWidth ?? "undefined"}
        </div>
        <div data-testid="isInContentWidthContainer">
          {String(context?.isInContentWidthContainer)}
        </div>
      </div>
    )
  }

  describe("basic context values", () => {
    it("should provide correct values for horizontal layout", () => {
      render(
        <FlexContextProvider direction={Direction.HORIZONTAL}>
          <ContextConsumer />
        </FlexContextProvider>
      )

      expect(screen.getByTestId("direction").textContent).toBe(
        Direction.HORIZONTAL
      )
      expect(screen.getByTestId("isInHorizontalLayout").textContent).toBe(
        "true"
      )
      expect(screen.getByTestId("isInRoot").textContent).toBe("false")
      expect(screen.getByTestId("parentWidth").textContent).toBe("undefined")
    })

    it("should provide correct values for vertical layout", () => {
      render(
        <FlexContextProvider direction={Direction.VERTICAL}>
          <ContextConsumer />
        </FlexContextProvider>
      )

      expect(screen.getByTestId("direction").textContent).toBe(
        Direction.VERTICAL
      )
      expect(screen.getByTestId("isInHorizontalLayout").textContent).toBe(
        "false"
      )
    })

    it("should set isInRoot when provided", () => {
      render(
        <FlexContextProvider direction={Direction.VERTICAL} isRoot={true}>
          <ContextConsumer />
        </FlexContextProvider>
      )

      expect(screen.getByTestId("isInRoot").textContent).toBe("true")
    })

    it("should provide parentWidth when specified", () => {
      const testWidth = 500
      render(
        <FlexContextProvider
          direction={Direction.HORIZONTAL}
          parentWidth={testWidth}
        >
          <ContextConsumer />
        </FlexContextProvider>
      )

      expect(screen.getByTestId("parentWidth").textContent).toBe(
        String(testWidth)
      )
    })
  })

  describe("isInContentWidthContainer", () => {
    it("should be true when hasContentWidth is true", () => {
      render(
        <FlexContextProvider
          direction={Direction.VERTICAL}
          hasContentWidth={true}
        >
          <ContextConsumer />
        </FlexContextProvider>
      )

      expect(screen.getByTestId("isInContentWidthContainer").textContent).toBe(
        "true"
      )
    })

    it("should be false when hasFixedWidth is true", () => {
      render(
        <FlexContextProvider
          direction={Direction.VERTICAL}
          hasFixedWidth={true}
        >
          <ContextConsumer />
        </FlexContextProvider>
      )

      expect(screen.getByTestId("isInContentWidthContainer").textContent).toBe(
        "false"
      )
    })

    it("should be false by default when no width flags are set", () => {
      render(
        <FlexContextProvider direction={Direction.VERTICAL}>
          <ContextConsumer />
        </FlexContextProvider>
      )

      expect(screen.getByTestId("isInContentWidthContainer").textContent).toBe(
        "false"
      )
    })

    it("should inherit true from parent context", () => {
      const parentContext: IFlexContext = {
        direction: Direction.VERTICAL,
        isInHorizontalLayout: false,
        isInRoot: false,
        isInContentWidthContainer: true,
      }

      render(
        <FlexContextProvider
          direction={Direction.HORIZONTAL}
          parentContext={parentContext}
        >
          <ContextConsumer />
        </FlexContextProvider>
      )

      expect(screen.getByTestId("isInContentWidthContainer").textContent).toBe(
        "true"
      )
    })

    it("should inherit false from parent context", () => {
      const parentContext: IFlexContext = {
        direction: Direction.VERTICAL,
        isInHorizontalLayout: false,
        isInRoot: false,
        isInContentWidthContainer: false,
      }

      render(
        <FlexContextProvider
          direction={Direction.HORIZONTAL}
          parentContext={parentContext}
        >
          <ContextConsumer />
        </FlexContextProvider>
      )

      expect(screen.getByTestId("isInContentWidthContainer").textContent).toBe(
        "false"
      )
    })

    it("should override parent's true value when hasFixedWidth is true", () => {
      const parentContext: IFlexContext = {
        direction: Direction.VERTICAL,
        isInHorizontalLayout: false,
        isInRoot: false,
        isInContentWidthContainer: true,
      }

      render(
        <FlexContextProvider
          direction={Direction.HORIZONTAL}
          hasFixedWidth={true}
          parentContext={parentContext}
        >
          <ContextConsumer />
        </FlexContextProvider>
      )

      expect(screen.getByTestId("isInContentWidthContainer").textContent).toBe(
        "false"
      )
    })

    it("should set true when hasContentWidth is true, even if parent is false", () => {
      const parentContext: IFlexContext = {
        direction: Direction.VERTICAL,
        isInHorizontalLayout: false,
        isInRoot: false,
        isInContentWidthContainer: false,
      }

      render(
        <FlexContextProvider
          direction={Direction.HORIZONTAL}
          hasContentWidth={true}
          parentContext={parentContext}
        >
          <ContextConsumer />
        </FlexContextProvider>
      )

      expect(screen.getByTestId("isInContentWidthContainer").textContent).toBe(
        "true"
      )
    })
  })

  describe("nested contexts", () => {
    // Helper component that reads parent context and passes it to a nested provider
    const NestedProvider: FC<{
      direction: Direction
      hasContentWidth?: boolean
      hasFixedWidth?: boolean
      children: React.ReactNode
    }> = ({ direction, hasContentWidth, hasFixedWidth, children }) => {
      const parentContext = useContext(FlexContext)
      return (
        <FlexContextProvider
          direction={direction}
          hasContentWidth={hasContentWidth}
          hasFixedWidth={hasFixedWidth}
          parentContext={parentContext}
        >
          {children}
        </FlexContextProvider>
      )
    }

    it("should handle multiple levels of nesting with content-width propagation", () => {
      render(
        <FlexContextProvider
          direction={Direction.VERTICAL}
          hasContentWidth={true}
        >
          <NestedProvider direction={Direction.HORIZONTAL}>
            <NestedProvider direction={Direction.VERTICAL}>
              <ContextConsumer />
            </NestedProvider>
          </NestedProvider>
        </FlexContextProvider>
      )

      // The innermost context should inherit content-width from the root
      expect(screen.getByTestId("isInContentWidthContainer").textContent).toBe(
        "true"
      )
    })

    it("should stop propagating content-width when fixed-width is encountered", () => {
      render(
        <FlexContextProvider
          direction={Direction.VERTICAL}
          hasContentWidth={true}
        >
          <NestedProvider
            direction={Direction.HORIZONTAL}
            hasFixedWidth={true}
          >
            <NestedProvider direction={Direction.VERTICAL}>
              <ContextConsumer />
            </NestedProvider>
          </NestedProvider>
        </FlexContextProvider>
      )

      // The innermost context should not inherit content-width because of the fixed-width in the middle
      expect(screen.getByTestId("isInContentWidthContainer").textContent).toBe(
        "false"
      )
    })
  })

  describe("useMemo optimization", () => {
    it("should memoize context value", () => {
      const { rerender } = render(
        <FlexContextProvider
          direction={Direction.VERTICAL}
          hasContentWidth={true}
          parentWidth={100}
        >
          <ContextConsumer />
        </FlexContextProvider>
      )

      const firstValue = screen.getByTestId(
        "isInContentWidthContainer"
      ).textContent

      // Rerender with the same props
      rerender(
        <FlexContextProvider
          direction={Direction.VERTICAL}
          hasContentWidth={true}
          parentWidth={100}
        >
          <ContextConsumer />
        </FlexContextProvider>
      )

      // Value should remain the same
      expect(screen.getByTestId("isInContentWidthContainer").textContent).toBe(
        firstValue
      )
    })
  })
})
