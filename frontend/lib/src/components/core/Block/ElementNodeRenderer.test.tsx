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

// These tests only assert the ElementContainer config that ElementNodeRenderer
// picks per element type, so the lazily-loaded element components are stubbed
// out to keep rendering cheap and independent of their internals. Button and
// FormSubmitContent render markers because a test distinguishes between them.
const mockNullDefault = vi.hoisted(() => () => ({ default: () => null }))

vi.mock("~lib/components/elements/Table/Table", mockNullDefault)
vi.mock(
  "~lib/components/elements/ArrowVegaLiteChart/ArrowVegaLiteChart",
  mockNullDefault
)
vi.mock("~lib/components/elements/Audio/Audio", mockNullDefault)
vi.mock(
  "~lib/components/elements/DeckGlJsonChart/DeckGlJsonChart",
  mockNullDefault
)
vi.mock(
  "~lib/components/elements/GraphVizChart/GraphVizChart",
  mockNullDefault
)
vi.mock("~lib/components/elements/IFrame/IFrame", mockNullDefault)
vi.mock("~lib/components/elements/LinkButton/LinkButton", mockNullDefault)
vi.mock("~lib/components/elements/PlotlyChart/PlotlyChart", mockNullDefault)
vi.mock(
  "~lib/components/elements/CodeBlock/StreamlitSyntaxHighlighter",
  mockNullDefault
)
vi.mock("~lib/components/elements/Toast/Toast", mockNullDefault)
vi.mock("~lib/components/elements/Video/Video", mockNullDefault)
vi.mock("~lib/components/widgets/AudioInput/AudioInput", mockNullDefault)
vi.mock("~lib/components/widgets/DataFrame/DataFrame", mockNullDefault)
vi.mock("~lib/components/widgets/Button/Button", () => ({
  default: () => <div data-testid="stMockButton" />,
}))
vi.mock("~lib/components/widgets/ButtonGroup/ButtonGroup", mockNullDefault)
vi.mock(
  "~lib/components/widgets/CustomComponent/ComponentInstance",
  mockNullDefault
)
vi.mock("~lib/components/widgets/CameraInput/CameraInput", mockNullDefault)
vi.mock("~lib/components/widgets/ChatInput/ChatInput", mockNullDefault)
vi.mock("~lib/components/widgets/Checkbox/Checkbox", mockNullDefault)
vi.mock("~lib/components/widgets/ColorPicker/ColorPicker", mockNullDefault)
vi.mock("~lib/components/widgets/DateInput/DateInput", mockNullDefault)
vi.mock("~lib/components/widgets/DateTimeInput/DateTimeInput", mockNullDefault)
vi.mock(
  "~lib/components/widgets/DownloadButton/DownloadButton",
  mockNullDefault
)
vi.mock("~lib/components/widgets/Feedback/Feedback", mockNullDefault)
vi.mock("~lib/components/widgets/FileUploader/FileUploader", mockNullDefault)
vi.mock("~lib/components/widgets/Form/FormSubmitContent", () => ({
  FormSubmitContent: () => <div data-testid="stMockFormSubmitContent" />,
}))
vi.mock("~lib/components/widgets/Multiselect/Multiselect", mockNullDefault)
vi.mock("~lib/components/widgets/MenuButton/MenuButton", mockNullDefault)
vi.mock("~lib/components/widgets/NumberInput/NumberInput", mockNullDefault)
vi.mock("~lib/components/widgets/Pagination/Pagination", mockNullDefault)
vi.mock("~lib/components/widgets/Radio/Radio", mockNullDefault)
vi.mock("~lib/components/widgets/Selectbox/Selectbox", mockNullDefault)
vi.mock("~lib/components/widgets/Slider/Slider", mockNullDefault)
vi.mock("~lib/components/widgets/TextArea/TextArea", mockNullDefault)
vi.mock("~lib/components/widgets/TextInput/TextInput", mockNullDefault)
vi.mock("~lib/components/widgets/TimeInput/TimeInput", mockNullDefault)
vi.mock("~lib/components/widgets/BidiComponent/BidiComponent", mockNullDefault)

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
      isDirectlyInColumn: false,
      isInRoot: false,
      isInContentWidthContainer: false,
    }

    const horizontalFlexContext: IFlexContext = {
      direction: Direction.HORIZONTAL,
      isInHorizontalLayout: true,
      isDirectlyInColumn: false,
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

  async function renderAndGetContainerConfig(
    type: string,
    protoData: Record<string, unknown> = {},
    elementOverrides: Record<string, unknown> = {},
    flexContext?: IFlexContext
  ): Promise<ElementContainerProps["config"]> {
    const scriptRunId = "SCRIPT_RUN_ID"
    const node = createElementNode(
      scriptRunId,
      type,
      protoData,
      elementOverrides
    )
    const props = getProps({ node })
    const renderer = <ElementNodeRenderer {...props} />
    renderWithContexts(
      flexContext ? (
        <FlexContext.Provider value={flexContext}>
          {renderer}
        </FlexContext.Provider>
      ) : (
        renderer
      ),
      {
        scriptRunContext: { scriptRunId },
      }
    )

    await waitFor(() => expect(screen.queryByTestId("stSkeleton")).toBeNull())
    expect(screen.getByTestId("stElementContainer")).toBeVisible()

    const lastCall = mockElementContainer.mock.calls.at(-1)
    if (!lastCall) {
      throw new Error("Expected ElementContainer to be called")
    }
    return lastCall[0].config
  }

  describe("render additional element types", () => {
    const widgetProto = { id: "widget-1", disabled: true }
    const rootFlexContext: IFlexContext = {
      direction: Direction.VERTICAL,
      isInHorizontalLayout: false,
      isDirectlyInColumn: false,
      isInRoot: true,
      isInContentWidthContainer: false,
    }
    const horizontalFlexContext: IFlexContext = {
      direction: Direction.HORIZONTAL,
      isInHorizontalLayout: true,
      isDirectlyInColumn: false,
      isInRoot: false,
      isInContentWidthContainer: false,
    }

    it.each([
      ["table", {}, ElementContainerConfig.LARGE_ELEMENT],
      ["audio", {}, ElementContainerConfig.LARGE_ELEMENT],
      [
        "code",
        { codeText: "print('hi')", language: "python" },
        ElementContainerConfig.LARGE_ELEMENT,
      ],
      ["deckGlJsonChart", {}, ElementContainerConfig.LARGE_OVERFLOW_VISIBLE],
      ["graphvizChart", {}, ElementContainerConfig.LARGE_OVERFLOW_VISIBLE],
      ["iframe", {}, ElementContainerConfig.LARGE_OVERFLOW_VISIBLE],
      ["video", {}, ElementContainerConfig.LARGE_ELEMENT],
      ["toast", { body: "Hello" }, ElementContainerConfig.DEFAULT],
      ["audioInput", widgetProto, ElementContainerConfig.LARGE_ELEMENT],
      [
        "button",
        { id: "btn-1", label: "Click", disabled: true },
        ElementContainerConfig.DEFAULT,
      ],
      ["buttonGroup", widgetProto, ElementContainerConfig.LARGE_ELEMENT],
      ["downloadButton", widgetProto, ElementContainerConfig.DEFAULT],
      ["feedback", widgetProto, ElementContainerConfig.FIT_CONTENT_ELEMENT],
      ["pagination", widgetProto, ElementContainerConfig.FULL_WIDTH],
      ["cameraInput", widgetProto, ElementContainerConfig.LARGE_ELEMENT],
      ["checkbox", widgetProto, ElementContainerConfig.DEFAULT],
      ["colorPicker", widgetProto, ElementContainerConfig.DEFAULT],
      ["componentInstance", {}, ElementContainerConfig.FULL_WIDTH],
      ["dateInput", widgetProto, ElementContainerConfig.MEDIUM_ELEMENT],
      ["fileUploader", widgetProto, ElementContainerConfig.LARGE_ELEMENT],
      [
        "linkButton",
        { label: "Go", url: "https://example.com" },
        ElementContainerConfig.DEFAULT,
      ],
      ["multiselect", widgetProto, ElementContainerConfig.MEDIUM_ELEMENT],
      ["menuButton", widgetProto, ElementContainerConfig.DEFAULT],
      ["numberInput", widgetProto, ElementContainerConfig.MEDIUM_ELEMENT],
      [
        "plotlyChart",
        { id: "plotly-1" },
        ElementContainerConfig.LARGE_ELEMENT,
      ],
      ["radio", widgetProto, ElementContainerConfig.MEDIUM_ELEMENT],
      ["selectbox", widgetProto, ElementContainerConfig.MEDIUM_ELEMENT],
      ["slider", widgetProto, ElementContainerConfig.MEDIUM_ELEMENT],
      ["textInput", widgetProto, ElementContainerConfig.MEDIUM_ELEMENT],
      ["dateTimeInput", widgetProto, ElementContainerConfig.DEFAULT],
      ["timeInput", widgetProto, ElementContainerConfig.MEDIUM_ELEMENT],
      ["bidiComponent", { id: "bidi-1" }, ElementContainerConfig.DEFAULT],
      [
        "dataframe",
        { id: "df-1", disabled: true },
        ElementContainerConfig.LARGE_OVERFLOW_VISIBLE,
      ],
      [
        "vegaLiteChart",
        { id: "vega-1" },
        ElementContainerConfig.LARGE_OVERFLOW_VISIBLE,
      ],
    ])(
      "renders %s with the expected container config",
      async (type, proto, config) => {
        expect(await renderAndGetContainerConfig(type, proto)).toBe(config)
      }
    )

    it("renders a form submitter button instead of a regular button", async () => {
      const config = await renderAndGetContainerConfig("button", {
        id: "submit-1",
        label: "Submit",
        isFormSubmitter: true,
        disabled: true,
      })
      expect(config).toBe(ElementContainerConfig.DEFAULT)
      expect(screen.getByTestId("stMockFormSubmitContent")).toBeVisible()
      expect(screen.queryByTestId("stMockButton")).not.toBeInTheDocument()
    })

    it("gives content-width dataframes full width in the root layout", async () => {
      const config = await renderAndGetContainerConfig(
        "dataframe",
        { id: "df-1" },
        { widthConfig: { useContent: true } },
        rootFlexContext
      )
      expect(config.minStretchWidth).toBe(MinStretchWidth.LARGE)
      expect(config.styleOverrides).toEqual({
        overflow: "visible",
        width: "100%",
      })
    })

    it("gives vegaLiteChart flex basis in a horizontal layout without widthConfig", async () => {
      const config = await renderAndGetContainerConfig(
        "vegaLiteChart",
        {},
        {},
        horizontalFlexContext
      )
      expect(config.minStretchWidth).toBe(MinStretchWidth.LARGE)
      expect(config.styleOverrides).toEqual({
        overflow: "visible",
        flex: "1 1 14rem",
      })
    })

    it("renders chatInput with medium stretch width by default", async () => {
      const config = await renderAndGetContainerConfig(
        "chatInput",
        widgetProto
      )
      expect(config.minStretchWidth).toBe(MinStretchWidth.MEDIUM)
      expect(config.styleOverrides).toBeUndefined()
    })

    it.each(["chatInput", "textArea"])(
      "stretches %s to fill parent height when useStretch is set",
      async type => {
        const config = await renderAndGetContainerConfig(type, widgetProto, {
          heightConfig: { useStretch: true },
        })
        expect(config.minStretchWidth).toBe(MinStretchWidth.MEDIUM)
        expect(config.styleOverrides).toEqual({
          height: "100%",
          flex: "1 1 8rem",
        })
      }
    )

    it("allows pixel-height chatInput containers to expand", async () => {
      const config = await renderAndGetContainerConfig(
        "chatInput",
        widgetProto,
        { heightConfig: { pixelHeight: 200 } }
      )
      expect(config.minStretchWidth).toBe(MinStretchWidth.MEDIUM)
      expect(config.styleOverrides).toEqual({
        height: "auto",
        overflow: "visible",
        flex: "",
      })
    })

    it("clears flex on content-height textArea in vertical layout", async () => {
      const config = await renderAndGetContainerConfig("textArea", widgetProto)
      expect(config.minStretchWidth).toBe(MinStretchWidth.MEDIUM)
      expect(config.styleOverrides).toEqual({ height: "auto", flex: "" })
    })
  })
})
