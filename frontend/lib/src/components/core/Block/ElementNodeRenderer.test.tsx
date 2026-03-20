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
  Balloons as BalloonsProto,
  Element,
  ForwardMsgMetadata,
  Metric as MetricProto,
  Snow as SnowProto,
} from "@streamlit/protobuf"

import { ElementNode } from "~lib/AppNode"
import { ComponentRegistry } from "~lib/components/widgets/CustomComponent/ComponentRegistry"
import { FileUploadClient } from "~lib/FileUploadClient"
import { mockEndpoints, mockSessionInfo } from "~lib/mocks/mocks"
import { ScriptRunState } from "~lib/ScriptRunState"
import { renderWithContexts } from "~lib/test_util"
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
  return {
    ...mod,
    ElementContainer: vi.fn((props: ElementContainerProps) =>
      mod.ElementContainer(props)
    ),
  }
})

const FAKE_SCRIPT_HASH = "fake_script_hash"

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
})
