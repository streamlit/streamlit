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

import { screen, waitFor } from "@testing-library/react"

import {
  Alert as AlertProto,
  Balloons as BalloonsProto,
  Element,
  ForwardMsgMetadata,
  Metric as MetricProto,
  Skeleton as SkeletonProto,
  Snow as SnowProto,
} from "@streamlit/protobuf"

import { ElementNode } from "~lib/AppNode"
import {
  FlexContext,
  IFlexContext,
} from "~lib/components/core/Layout/FlexContext"
import { Direction } from "~lib/components/core/Layout/utils"
import { ComponentRegistry } from "~lib/components/widgets/CustomComponent/ComponentRegistry"
import { FileUploadClient } from "~lib/FileUploadClient"
import { mockEndpoints, mockSessionInfo } from "~lib/mocks/mocks"
import { ScriptRunState } from "~lib/ScriptRunState"
import { render, renderWithContexts } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import { ElementContainer, ElementContainerProps } from "./ElementContainer"
import {
  ElementContainerConfig,
  MinStretchWidth,
} from "./ElementContainerConfig"
import ElementNodeRenderer, {
  ElementNodeRendererProps,
} from "./ElementNodeRenderer"

vi.mock("./ElementContainer", async importOriginal => {
  const mod = await importOriginal<typeof import("./ElementContainer")>()
  const { createElement } = await import("react")
  return {
    ...mod,
    ElementContainer: vi.fn((props: ElementContainerProps) =>
      createElement(mod.ElementContainer, props)
    ),
  }
})

vi.mock("~lib/components/elements/Metric/Metric", () => ({
  default: () => null,
}))

vi.mock("~lib/components/elements/ImageList/ImageList", () => ({
  default: () => null,
}))

const FAKE_SCRIPT_HASH = "fake_script_hash"

function createElementNode(
  scriptRunId: string,
  type: string,
  protoData: Record<string, unknown> = {},
  elementOverrides: Record<string, unknown> = {}
): ElementNode {
  const element = {
    type,
    [type]: protoData,
    ...elementOverrides,
  } as unknown as Element
  return new ElementNode(
    element,
    ForwardMsgMetadata.create({}),
    scriptRunId,
    FAKE_SCRIPT_HASH
  )
}

function createBalloonNode(scriptRunId: string): ElementNode {
  const node = new ElementNode(
    new BalloonsProto({
      show: true,
    }),
    ForwardMsgMetadata.create({}),
    scriptRunId,
    FAKE_SCRIPT_HASH
  )
  node.element.type = "balloons"
  return node
}

function createSnowNode(scriptRunId: string): ElementNode {
  const node = new ElementNode(
    new SnowProto({
      show: true,
    }),
    ForwardMsgMetadata.create({}),
    scriptRunId,
    FAKE_SCRIPT_HASH
  )
  node.element.type = "snow"
  return node
}

function createMetricNode(
  scriptRunId: string,
  metricProps: Partial<MetricProto> = {}
): ElementNode {
  const metric = MetricProto.create({
    body: "100",
    label: "Test Metric",
    ...metricProps,
  })
  const element = { type: "metric", metric } as unknown as Element
  return new ElementNode(
    element,
    ForwardMsgMetadata.create({}),
    scriptRunId,
    FAKE_SCRIPT_HASH
  )
}

function getProps(
  props: Partial<ElementNodeRendererProps> &
    Pick<ElementNodeRendererProps, "node">
): ElementNodeRendererProps {
  const sessionInfo = mockSessionInfo()
  const endpoints = mockEndpoints()
  return {
    endpoints: endpoints,
    widgetMgr: new WidgetStateManager({
      sendRerunBackMsg: vi.fn(),
      formsDataChanged: vi.fn(),
    }),
    widgetsDisabled: false,
    uploadClient: new FileUploadClient({
      sessionInfo: sessionInfo,
      endpoints,
      formsWithPendingRequestsChanged: () => {},
      requestFileURLs: vi.fn(),
    }),
    componentRegistry: new ComponentRegistry(endpoints),
    ...props,
  }
}

describe("ElementNodeRenderer Block Component", () => {
  const mockElementContainer = vi.mocked(ElementContainer)

  beforeEach(() => {
    mockElementContainer.mockClear()
  })

  describe("render Balloons", () => {
    it("should NOT render a stale component", async () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const props = getProps({
        node: createBalloonNode(scriptRunId),
      })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: {
          scriptRunState: ScriptRunState.RUNNING,
          scriptRunId: "NEW_SCRIPT_ID",
        },
      })

      await waitFor(() =>
        expect(screen.queryByTestId("stSkeleton")).toBeNull()
      )
      // Stale balloons are hidden completely (no container rendered)
      expect(
        screen.queryByTestId("stElementContainer")
      ).not.toBeInTheDocument()
    })

    it("should render a fresh component", async () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const props = getProps({
        node: createBalloonNode(scriptRunId),
      })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: { scriptRunId },
      })

      await waitFor(() =>
        expect(screen.queryByTestId("stSkeleton")).toBeNull()
      )
      const elementNodeRenderer = screen.getByTestId("stElementContainer")
      expect(elementNodeRenderer).toBeInTheDocument()
      const elementRendererChildren = elementNodeRenderer.children
      expect(elementRendererChildren).toHaveLength(1)
      expect(elementRendererChildren[0]).toHaveClass("stBalloons")
    })
  })

  describe("render Snow", () => {
    it("should NOT render a stale component", async () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const props = getProps({
        node: createSnowNode(scriptRunId),
      })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: {
          scriptRunState: ScriptRunState.RUNNING,
          scriptRunId: "NEW_SCRIPT_ID",
        },
      })

      await waitFor(() =>
        expect(screen.queryByTestId("stSkeleton")).toBeNull()
      )
      // Stale snow is hidden completely (no container rendered)
      expect(
        screen.queryByTestId("stElementContainer")
      ).not.toBeInTheDocument()
    })

    it("should render a fresh component", async () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const props = getProps({
        node: createSnowNode(scriptRunId),
      })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: { scriptRunId },
      })

      await waitFor(() =>
        expect(screen.queryByTestId("stSkeleton")).toBeNull()
      )
      const elementNodeRenderer = screen.getByTestId("stElementContainer")
      expect(elementNodeRenderer).toBeInTheDocument()
      const elementRendererChildren = elementNodeRenderer.children
      expect(elementRendererChildren).toHaveLength(1)
      expect(elementRendererChildren[0]).toHaveClass("stSnow")
    })
  })

  describe("render Metric", () => {
    it("should use LARGE_ELEMENT config when chartData is present", async () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const node = createMetricNode(scriptRunId, {
        chartData: [1, 2, 3, 4, 5],
        chartType: MetricProto.ChartType.LINE,
      })
      const props = getProps({ node })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: { scriptRunId },
      })

      await waitFor(() =>
        expect(screen.queryByTestId("stSkeleton")).toBeNull()
      )
      expect(screen.getByTestId("stElementContainer")).toBeInTheDocument()

      const lastCall = mockElementContainer.mock.calls.at(-1)
      if (!lastCall) throw new Error("Expected ElementContainer to be called")
      const config = lastCall[0].config
      expect(config).toBe(ElementContainerConfig.LARGE_ELEMENT)
      expect(config.minStretchWidth).toBe(MinStretchWidth.LARGE)
    })

    it("should use DEFAULT config when chartData is empty", async () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const node = createMetricNode(scriptRunId, { chartData: [] })
      const props = getProps({ node })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: { scriptRunId },
      })

      await waitFor(() =>
        expect(screen.queryByTestId("stSkeleton")).toBeNull()
      )
      expect(screen.getByTestId("stElementContainer")).toBeInTheDocument()

      const lastCall = mockElementContainer.mock.calls.at(-1)
      if (!lastCall) throw new Error("Expected ElementContainer to be called")
      const config = lastCall[0].config
      expect(config).toBe(ElementContainerConfig.DEFAULT)
      expect(config.minStretchWidth).toBe(MinStretchWidth.NONE)
    })

    it("should use DEFAULT config when chartData is not provided", async () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const node = createMetricNode(scriptRunId)
      const props = getProps({ node })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: { scriptRunId },
      })

      await waitFor(() =>
        expect(screen.queryByTestId("stSkeleton")).toBeNull()
      )
      expect(screen.getByTestId("stElementContainer")).toBeInTheDocument()

      const lastCall = mockElementContainer.mock.calls.at(-1)
      if (!lastCall) throw new Error("Expected ElementContainer to be called")
      const config = lastCall[0].config
      expect(config).toBe(ElementContainerConfig.DEFAULT)
      expect(config.minStretchWidth).toBe(MinStretchWidth.NONE)
    })
  })

  describe("render Alert", () => {
    it("should render with DEFAULT config", () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const node = createElementNode(scriptRunId, "alert", {
        body: "Test alert",
        format: AlertProto.Format.ERROR,
      })
      const props = getProps({ node })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: { scriptRunId },
      })

      expect(screen.getByTestId("stElementContainer")).toBeVisible()
      const lastCall = mockElementContainer.mock.calls.at(-1)
      expect(lastCall?.[0].config).toBe(ElementContainerConfig.DEFAULT)
    })
  })

  describe("render Text", () => {
    it("should render with DEFAULT config", () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const node = createElementNode(scriptRunId, "text", { body: "Hello" })
      const props = getProps({ node })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: { scriptRunId },
      })

      expect(screen.getByTestId("stElementContainer")).toBeVisible()
      const lastCall = mockElementContainer.mock.calls.at(-1)
      expect(lastCall?.[0].config).toBe(ElementContainerConfig.DEFAULT)
    })
  })

  describe("render Empty", () => {
    it("should render an empty div with DEFAULT config", () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const node = createElementNode(scriptRunId, "empty")
      const props = getProps({ node })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: { scriptRunId },
      })

      expect(screen.getByTestId("stEmpty")).toBeInTheDocument()
      const lastCall = mockElementContainer.mock.calls.at(-1)
      expect(lastCall?.[0].config).toBe(ElementContainerConfig.DEFAULT)
    })
  })

  describe("render Space", () => {
    it("should render with DEFAULT config", () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const node = createElementNode(scriptRunId, "space")
      const props = getProps({ node })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: { scriptRunId },
      })

      expect(screen.getByTestId("stSpace")).toBeVisible()
      const lastCall = mockElementContainer.mock.calls.at(-1)
      expect(lastCall?.[0].config).toBe(ElementContainerConfig.DEFAULT)
    })
  })

  describe("render Heading", () => {
    it("should render with DEFAULT config", () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const node = createElementNode(scriptRunId, "heading", {
        body: "Test Heading",
        tag: "h1",
      })
      const props = getProps({ node })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: { scriptRunId },
      })

      expect(screen.getByTestId("stElementContainer")).toBeVisible()
      const lastCall = mockElementContainer.mock.calls.at(-1)
      expect(lastCall?.[0].config).toBe(ElementContainerConfig.DEFAULT)
    })
  })

  describe("render Exception", () => {
    it("should render with DEFAULT config", () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const node = createElementNode(scriptRunId, "exception", {
        type: "ValueError",
        message: "test error",
        stackTrace: [],
      })
      const props = getProps({ node })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: { scriptRunId },
      })

      expect(screen.getByTestId("stElementContainer")).toBeVisible()
      const lastCall = mockElementContainer.mock.calls.at(-1)
      expect(lastCall?.[0].config).toBe(ElementContainerConfig.DEFAULT)
    })
  })

  describe("render Skeleton", () => {
    it("should render with LARGE_ELEMENT config for regular skeleton", () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const node = createElementNode(scriptRunId, "skeleton", {
        style: SkeletonProto.SkeletonStyle.ELEMENT,
      })
      const props = getProps({ node })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: { scriptRunId },
      })

      expect(screen.getByTestId("stElementContainer")).toBeVisible()
      const lastCall = mockElementContainer.mock.calls.at(-1)
      expect(lastCall?.[0].config).toBe(ElementContainerConfig.LARGE_ELEMENT)
    })

    it("should render with FULL_WIDTH config for AppSkeleton", () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const node = createElementNode(scriptRunId, "skeleton", {
        style: SkeletonProto.SkeletonStyle.APP,
      })
      const props = getProps({ node })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: { scriptRunId },
      })

      expect(screen.getByTestId("stElementContainer")).toBeVisible()
      const lastCall = mockElementContainer.mock.calls.at(-1)
      expect(lastCall?.[0].config).toBe(ElementContainerConfig.FULL_WIDTH)
    })
  })

  describe("render Markdown", () => {
    const verticalFlexContext: IFlexContext = {
      direction: Direction.VERTICAL,
      isInHorizontalLayout: false,
      isInRoot: false,
      isInContentWidthContainer: false,
    }

    const horizontalFlexContext: IFlexContext = {
      direction: Direction.HORIZONTAL,
      isInHorizontalLayout: true,
      isInRoot: false,
      isInContentWidthContainer: false,
    }

    it("should use FULL_WIDTH config when no widthConfig is set (vertical layout)", () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const node = createElementNode(scriptRunId, "markdown", {
        body: "**bold text**",
      })
      const props = getProps({ node })
      render(
        <FlexContext.Provider value={verticalFlexContext}>
          <ElementNodeRenderer {...props} />
        </FlexContext.Provider>
      )

      expect(screen.getByTestId("stElementContainer")).toBeVisible()
      const lastCall = mockElementContainer.mock.calls.at(-1)
      expect(lastCall?.[0].config).toBe(ElementContainerConfig.FULL_WIDTH)
    })

    it("should use fit-content config when no widthConfig is set (horizontal layout)", () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const node = createElementNode(scriptRunId, "markdown", {
        body: "**bold text**",
      })
      const props = getProps({ node })
      render(
        <FlexContext.Provider value={horizontalFlexContext}>
          <ElementNodeRenderer {...props} />
        </FlexContext.Provider>
      )

      expect(screen.getByTestId("stElementContainer")).toBeVisible()
      const lastCall = mockElementContainer.mock.calls.at(-1)
      expect(lastCall?.[0].config?.styleOverrides).toEqual({
        width: "fit-content",
      })
    })

    it("should use DEFAULT config when widthConfig is set", () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const node = createElementNode(
        scriptRunId,
        "markdown",
        { body: "text" },
        { widthConfig: { useStretch: true } }
      )
      const props = getProps({ node })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: { scriptRunId },
      })

      expect(screen.getByTestId("stElementContainer")).toBeVisible()
      const lastCall = mockElementContainer.mock.calls.at(-1)
      expect(lastCall?.[0].config).toBe(ElementContainerConfig.DEFAULT)
    })

    it("should use DEFAULT config when widthConfig has useContent", () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const node = createElementNode(
        scriptRunId,
        "markdown",
        { body: "text" },
        { widthConfig: { useContent: true } }
      )
      const props = getProps({ node })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: { scriptRunId },
      })

      expect(screen.getByTestId("stElementContainer")).toBeVisible()
      const lastCall = mockElementContainer.mock.calls.at(-1)
      expect(lastCall?.[0].config).toBe(ElementContainerConfig.DEFAULT)
    })
  })

  describe("render Html", () => {
    it("should render with DEFAULT config", () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const node = createElementNode(scriptRunId, "html", {
        body: "<div>test</div>",
      })
      const props = getProps({ node })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: { scriptRunId },
      })

      expect(screen.getByTestId("stElementContainer")).toBeVisible()
      const lastCall = mockElementContainer.mock.calls.at(-1)
      expect(lastCall?.[0].config).toBe(ElementContainerConfig.DEFAULT)
    })
  })

  describe("render PageLink", () => {
    it("should render with DEFAULT config", () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const node = createElementNode(scriptRunId, "pageLink", {
        label: "Go to page",
        page: "/page1",
        disabled: false,
      })
      const props = getProps({ node })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: { scriptRunId },
      })

      expect(screen.getByTestId("stElementContainer")).toBeVisible()
      const lastCall = mockElementContainer.mock.calls.at(-1)
      expect(lastCall?.[0].config).toBe(ElementContainerConfig.DEFAULT)
    })
  })

  describe("render Progress", () => {
    it("should render the progress element", async () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const node = createElementNode(scriptRunId, "progress", {
        value: 50,
        text: "",
      })
      const props = getProps({ node })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: { scriptRunId },
      })

      await waitFor(() =>
        expect(screen.queryByTestId("stSkeleton")).toBeNull()
      )
      expect(screen.getByTestId("stProgress")).toBeVisible()
    })
  })

  describe("render Spinner", () => {
    it("should render with DEFAULT config", async () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const node = createElementNode(scriptRunId, "spinner", {
        text: "Loading...",
      })
      const props = getProps({ node })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: { scriptRunId },
      })

      await waitFor(() =>
        expect(screen.queryByTestId("stSkeleton")).toBeNull()
      )
      expect(screen.getByTestId("stElementContainer")).toBeVisible()
      const lastCall = mockElementContainer.mock.calls.at(-1)
      expect(lastCall?.[0].config).toBe(ElementContainerConfig.DEFAULT)
    })
  })

  describe("render Json", () => {
    it("should render with LARGE_ELEMENT config", async () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const node = createElementNode(scriptRunId, "json", {
        body: '{"key": "value"}',
      })
      const props = getProps({ node })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: { scriptRunId },
      })

      await waitFor(() =>
        expect(screen.queryByTestId("stSkeleton")).toBeNull()
      )
      expect(screen.getByTestId("stElementContainer")).toBeVisible()
      const lastCall = mockElementContainer.mock.calls.at(-1)
      expect(lastCall?.[0].config).toBe(ElementContainerConfig.LARGE_ELEMENT)
    })
  })

  describe("render HelpInfo", () => {
    it("should render with LARGE_ELEMENT config", () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const node = createElementNode(scriptRunId, "helpInfo", {
        name: "st.write",
        docString: "Write arguments to the app.",
      })
      const props = getProps({ node })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: { scriptRunId },
      })

      expect(screen.getByTestId("stElementContainer")).toBeVisible()
      const lastCall = mockElementContainer.mock.calls.at(-1)
      expect(lastCall?.[0].config).toBe(ElementContainerConfig.LARGE_ELEMENT)
    })
  })

  describe("render Images", () => {
    it("should use FULL_WIDTH config when widthConfig is not set", async () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const node = createElementNode(scriptRunId, "imgs", {
        imgs: [],
      })
      const props = getProps({ node })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: { scriptRunId },
      })

      await waitFor(() =>
        expect(screen.queryByTestId("stSkeleton")).toBeNull()
      )
      expect(screen.getByTestId("stElementContainer")).toBeVisible()
      const lastCall = mockElementContainer.mock.calls.at(-1)
      const config = lastCall?.[0].config
      expect(config?.styleOverrides).toEqual({ width: "100%" })
    })

    it("should use auto width config when widthConfig has non-stretch sizing", async () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const node = createElementNode(
        scriptRunId,
        "imgs",
        { imgs: [] },
        { widthConfig: { useContent: true } }
      )
      const props = getProps({ node })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: { scriptRunId },
      })

      await waitFor(() =>
        expect(screen.queryByTestId("stSkeleton")).toBeNull()
      )
      expect(screen.getByTestId("stElementContainer")).toBeVisible()
      const lastCall = mockElementContainer.mock.calls.at(-1)
      const config = lastCall?.[0].config
      expect(config?.styleOverrides).toEqual({ width: "auto" })
    })
  })

  it("should throw for unrecognized element type", () => {
    const scriptRunId = "SCRIPT_RUN_ID"
    const node = createElementNode(scriptRunId, "unknownType")
    const props = getProps({ node })

    expect(() =>
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunContext: { scriptRunId },
      })
    ).toThrow("Unrecognized Element type unknownType")
  })
})
