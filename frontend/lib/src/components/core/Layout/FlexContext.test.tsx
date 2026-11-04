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

import { type FC, type ReactNode, useContext } from "react"

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import {
  FlexContext,
  FlexContextProvider,
  hasStretchHeightFallback,
  type IFlexContext,
} from "./FlexContext"
import { Direction } from "./utils"

/** Helper component to consume and display context values. */
const ContextConsumer: FC = () => {
  const context = useContext(FlexContext)
  return (
    <div data-testid="context-consumer">
      <div data-testid="direction">{context?.direction}</div>
      <div data-testid="isInHorizontalLayout">
        {String(context?.isInHorizontalLayout)}
      </div>
      <div data-testid="isDirectlyInColumn">
        {String(context?.isDirectlyInColumn)}
      </div>
      <div data-testid="isInRoot">{String(context?.isInRoot)}</div>
      <div data-testid="wrap">{String(context?.wrap)}</div>
      <div data-testid="parentWidth">
        {context?.parentWidth ?? "undefined"}
      </div>
      <div data-testid="isInContentWidthContainer">
        {String(context?.isInContentWidthContainer)}
      </div>
      <div data-testid="hasDefiniteHeight">
        {String(context?.hasDefiniteHeight)}
      </div>
      <div data-testid="hasStretchHeightFallback">
        {String(hasStretchHeightFallback(context))}
      </div>
    </div>
  )
}

/** Helper component that reads parent context and passes it to a nested provider. */
const NestedProvider: FC<{
  direction: Direction
  hasContentWidth?: boolean
  hasFixedWidth?: boolean
  hasFixedHeight?: boolean
  hasStretchHeight?: boolean
  children: ReactNode
}> = ({
  direction,
  hasContentWidth,
  hasFixedWidth,
  hasFixedHeight,
  hasStretchHeight,
  children,
}) => {
  const parentContext = useContext(FlexContext)
  return (
    <FlexContextProvider
      direction={direction}
      hasContentWidth={hasContentWidth}
      hasFixedWidth={hasFixedWidth}
      hasFixedHeight={hasFixedHeight}
      hasStretchHeight={hasStretchHeight}
      parentContext={parentContext}
    >
      {children}
    </FlexContextProvider>
  )
}

describe("FlexContextProvider", () => {
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
      expect(screen.getByTestId("isDirectlyInColumn").textContent).toBe(
        "false"
      )
      expect(screen.getByTestId("wrap").textContent).toBe("true")
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
      expect(screen.getByTestId("wrap").textContent).toBe("true")
    })

    it("should set wrap when provided", () => {
      render(
        <FlexContextProvider direction={Direction.HORIZONTAL} wrap={false}>
          <ContextConsumer />
        </FlexContextProvider>
      )

      expect(screen.getByTestId("wrap").textContent).toBe("false")
    })

    it("should set isInRoot when provided", () => {
      render(
        <FlexContextProvider direction={Direction.VERTICAL} isRoot={true}>
          <ContextConsumer />
        </FlexContextProvider>
      )

      expect(screen.getByTestId("isInRoot").textContent).toBe("true")
    })

    it("should set isDirectlyInColumn when provided", () => {
      render(
        <FlexContextProvider
          direction={Direction.VERTICAL}
          isDirectlyInColumn={true}
        >
          <ContextConsumer />
        </FlexContextProvider>
      )

      expect(screen.getByTestId("isDirectlyInColumn").textContent).toBe("true")
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
        isDirectlyInColumn: false,
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
        isDirectlyInColumn: false,
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
        isDirectlyInColumn: false,
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
        isDirectlyInColumn: false,
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
    it("should reset direct column placement in a nested provider", () => {
      render(
        <FlexContextProvider
          direction={Direction.VERTICAL}
          isDirectlyInColumn={true}
        >
          <NestedProvider direction={Direction.VERTICAL}>
            <ContextConsumer />
          </NestedProvider>
        </FlexContextProvider>
      )

      expect(screen.getByTestId("isDirectlyInColumn").textContent).toBe(
        "false"
      )
    })

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

  describe("hasDefiniteHeight", () => {
    it.each([
      ["a pixel-height container", { hasFixedHeight: true }, "true", "false"],
      ["a content-height container", {}, "false", "true"],
      [
        "a stretch-height container without a definite parent",
        { hasStretchHeight: true },
        "false",
        "true",
      ],
    ])(
      "is computed for %s",
      (_label, heightProps, expectedDefinite, expectedFallback) => {
        render(
          <NestedProvider direction={Direction.VERTICAL} {...heightProps}>
            <ContextConsumer />
          </NestedProvider>
        )

        expect(screen.getByTestId("hasDefiniteHeight").textContent).toBe(
          expectedDefinite
        )
        expect(
          screen.getByTestId("hasStretchHeightFallback").textContent
        ).toBe(expectedFallback)
      }
    )

    it("propagates through stretch-height containers inside a pixel-height container", () => {
      render(
        <NestedProvider direction={Direction.VERTICAL} hasFixedHeight={true}>
          <NestedProvider
            direction={Direction.HORIZONTAL}
            hasStretchHeight={true}
          >
            <ContextConsumer />
          </NestedProvider>
        </NestedProvider>
      )

      expect(screen.getByTestId("hasDefiniteHeight").textContent).toBe("true")
      expect(screen.getByTestId("hasStretchHeightFallback").textContent).toBe(
        "false"
      )
    })

    it("stops propagating at a content-height container", () => {
      render(
        <NestedProvider direction={Direction.VERTICAL} hasFixedHeight={true}>
          <NestedProvider direction={Direction.VERTICAL}>
            <NestedProvider
              direction={Direction.VERTICAL}
              hasStretchHeight={true}
            >
              <ContextConsumer />
            </NestedProvider>
          </NestedProvider>
        </NestedProvider>
      )

      expect(screen.getByTestId("hasDefiniteHeight").textContent).toBe("false")
      expect(screen.getByTestId("hasStretchHeightFallback").textContent).toBe(
        "true"
      )
    })

    it("keeps the fallback height without a provider", () => {
      expect(hasStretchHeightFallback(null)).toBe(true)
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
