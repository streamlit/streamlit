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

import { type ComponentType, lazy, type ReactElement, useContext } from "react"

import { act, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { ElementNode } from "~lib/AppNode"
import {
  FlexContext,
  type IFlexContext,
} from "~lib/components/core/Layout/FlexContext"
import { Direction } from "~lib/components/core/Layout/utils"
import {
  ElementTimingContext,
  RenderTimingContext,
} from "~lib/components/core/RenderTimingContext"
import { useElementLoadState } from "~lib/hooks/useElementLoadState"
import { render } from "~lib/test_util"
import {
  type RenderTimingReport,
  RenderTimingTracker,
} from "~lib/util/performance/RenderTimingTracker"

import { ElementContainer } from "./ElementContainer"
import { ElementContainerConfig, PrintLayout } from "./ElementContainerConfig"
import { RetainedElementContext } from "./RetainedElementContext"

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
    expect(container).not.toHaveClass(PrintLayout.FIXED_WIDTH)
    expect(container).not.toHaveClass(PrintLayout.GRAPHIC)
  })

  it.each([PrintLayout.FIXED_WIDTH, PrintLayout.GRAPHIC])(
    "adds the %s class from the config's print layout",
    printLayout => {
      render(
        <ElementContainer
          node={mockNode}
          config={new ElementContainerConfig({ printLayout })}
          isStale={false}
        >
          <div>Content</div>
        </ElementContainer>
      )

      expect(screen.getByTestId("stElementContainer")).toHaveClass(printLayout)
    }
  )

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

  describe("retained state", () => {
    it("marks the container as retained inside a retained element", () => {
      render(
        <RetainedElementContext.Provider value={true}>
          <ElementContainer
            node={mockNode}
            config={ElementContainerConfig.DEFAULT}
            isStale={true}
          >
            <div>Content</div>
          </ElementContainer>
        </RetainedElementContext.Provider>
      )

      expect(screen.getByTestId("stElementContainer")).toHaveAttribute(
        "data-retained",
        "true"
      )
    })

    it("does not mark the container as retained by default", () => {
      render(
        <ElementContainer
          node={mockNode}
          config={ElementContainerConfig.DEFAULT}
          isStale={false}
        >
          <div>Content</div>
        </ElementContainer>
      )

      expect(screen.getByTestId("stElementContainer")).not.toHaveAttribute(
        "data-retained"
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

  describe("render timing", () => {
    /** A tracker with a manual clock and paint queue, counting every element as visible. */
    const createTimedTracker = (): {
      tracker: RenderTimingTracker
      reports: RenderTimingReport[]
      setTime: (time: number) => void
      paintUntilIdle: () => void
    } => {
      let time = 0
      let paintQueue: (() => void)[] = []
      const reports: RenderTimingReport[] = []
      const tracker = new RenderTimingTracker({
        onReport: report => reports.push(report),
        environment: {
          now: () => time,
          afterNextPaint: callback => {
            paintQueue.push(callback)
          },
          createIntersectionObserver: () => undefined,
          isPageHidden: () => false,
        },
      })
      return {
        tracker,
        reports,
        setTime: (newTime: number) => {
          time = newTime
        },
        paintUntilIdle: () => {
          for (let i = 0; i < 20 && paintQueue.length > 0; i++) {
            const callbacks = paintQueue
            paintQueue = []
            callbacks.forEach(callback => callback())
          }
        },
      }
    }

    const renderTimed = (
      tracker: RenderTimingTracker,
      child: ReactElement
    ): ReturnType<typeof render> =>
      render(
        <RenderTimingContext.Provider value={tracker}>
          <ElementContainer
            node={mockNode}
            config={ElementContainerConfig.DEFAULT}
            isStale={false}
          >
            {child}
          </ElementContainer>
        </RenderTimingContext.Provider>
      )

    const finishScript = async (
      tracker: RenderTimingTracker
    ): Promise<void> => {
      tracker.scriptFinished()
      await act(async () => {
        await Promise.resolve()
      })
    }

    function DrawingChart({ isDrawn }: { isDrawn: boolean }): ReactElement {
      useElementLoadState("draw", isDrawn)
      return <div>chart</div>
    }

    it("doesn't provide an element timing handle without a tracker", () => {
      let handle: unknown
      function Probe(): null {
        handle = useContext(ElementTimingContext)
        return null
      }

      render(
        <ElementContainer
          node={mockNode}
          config={ElementContainerConfig.DEFAULT}
          isStale={false}
        >
          <Probe />
        </ElementContainer>
      )

      expect(handle).toBeNull()
    })

    it("reports an element as loaded once it's painted", async () => {
      const { tracker, reports, setTime, paintUntilIdle } =
        createTimedTracker()
      tracker.runStarted(mockNode.scriptRunId)
      setTime(100)
      renderTimed(tracker, <div>Content</div>)
      await finishScript(tracker)
      setTime(150)
      paintUntilIdle()

      expect(reports).toHaveLength(1)
      expect(reports[0].renderTiming).toMatchObject({
        firstContentMs: 150,
        scriptFinishedMs: 100,
        fullyLoadedMs: 150,
        visibleElements: 1,
        codeLoadingMs: 0,
      })
      tracker.dispose()
    })

    it("measures the time to load the element's code", async () => {
      const { tracker, reports, setTime, paintUntilIdle } =
        createTimedTracker()
      let resolveModule: (module: {
        default: ComponentType
      }) => void = () => {}
      const LazyElement = lazy(
        () =>
          new Promise<{ default: ComponentType }>(resolve => {
            resolveModule = resolve
          })
      )
      tracker.runStarted(mockNode.scriptRunId)
      setTime(100)
      renderTimed(tracker, <LazyElement />)
      await finishScript(tracker)
      paintUntilIdle()

      expect(screen.getByTestId("stSkeleton")).toBeVisible()
      expect(reports).toHaveLength(0)

      setTime(400)
      await act(async () => {
        resolveModule({ default: () => <div>Loaded</div> })
        await Promise.resolve()
      })
      expect(screen.getByText("Loaded")).toBeVisible()
      setTime(450)
      paintUntilIdle()

      expect(reports[0].renderTiming).toMatchObject({
        codeLoadingMs: 300,
        fullyLoadedMs: 450,
      })
      tracker.dispose()
    })

    it("waits for work reported with useElementLoadState", async () => {
      const { tracker, reports, setTime, paintUntilIdle } =
        createTimedTracker()
      tracker.runStarted(mockNode.scriptRunId)
      setTime(100)
      const { rerender } = renderTimed(
        tracker,
        <DrawingChart isDrawn={false} />
      )
      await finishScript(tracker)
      paintUntilIdle()

      expect(reports).toHaveLength(0)

      setTime(300)
      rerender(
        <RenderTimingContext.Provider value={tracker}>
          <ElementContainer
            node={mockNode}
            config={ElementContainerConfig.DEFAULT}
            isStale={false}
          >
            <DrawingChart isDrawn />
          </ElementContainer>
        </RenderTimingContext.Provider>
      )
      paintUntilIdle()

      expect(reports[0].renderTiming).toMatchObject({
        drawingMs: 200,
        fullyLoadedMs: 300,
      })
      tracker.dispose()
    })
  })

  describe("stretch size containment", () => {
    const definiteHeightContext: IFlexContext = {
      direction: Direction.VERTICAL,
      isInHorizontalLayout: false,
      isDirectlyInColumn: false,
      isInRoot: false,
      isInContentWidthContainer: false,
      hasDefiniteHeight: true,
    }

    const stretchNode = (widthConfig: {
      useStretch?: boolean
      useContent?: boolean
    }): ElementNode =>
      ({
        ...createMockElementNode("code"),
        element: {
          type: "code",
          code: {},
          heightConfig: { useStretch: true },
          widthConfig,
        },
      }) as unknown as ElementNode

    it("size-contains a stretch element in a definite-height container", () => {
      render(
        <FlexContext.Provider value={definiteHeightContext}>
          <ElementContainer
            node={stretchNode({ useStretch: true })}
            config={ElementContainerConfig.DEFAULT}
            isStale={false}
          >
            <div>Content</div>
          </ElementContainer>
        </FlexContext.Provider>
      )

      expect(screen.getByTestId("stElementContainer")).toHaveStyle({
        contain: "size",
      })
    })

    it("does not size-contain a stretch element without a definite parent height", () => {
      render(
        <ElementContainer
          node={stretchNode({ useStretch: true })}
          config={ElementContainerConfig.DEFAULT}
          isStale={false}
        >
          <div>Content</div>
        </ElementContainer>
      )

      expect(screen.getByTestId("stElementContainer")).not.toHaveStyle(
        "contain: size"
      )
    })

    it("does not size-contain a content-width stretch element", () => {
      render(
        <FlexContext.Provider value={definiteHeightContext}>
          <ElementContainer
            node={stretchNode({ useContent: true })}
            config={ElementContainerConfig.DEFAULT}
            isStale={false}
          >
            <div>Content</div>
          </ElementContainer>
        </FlexContext.Provider>
      )

      expect(screen.getByTestId("stElementContainer")).not.toHaveStyle(
        "contain: size"
      )
    })
  })
})
