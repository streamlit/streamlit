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

import { screen, waitFor } from "@testing-library/react"

import {
  Balloons as BalloonsProto,
  ForwardMsgMetadata,
  Snow as SnowProto,
} from "@streamlit/protobuf"

import { ElementNode } from "~lib/AppNode"
import { FileUploadClient } from "~lib/FileUploadClient"
import { mockEndpoints, mockSessionInfo } from "~lib/mocks/mocks"
import { ScriptRunState } from "~lib/ScriptRunState"
import { renderWithContexts } from "~lib/test_util"
import { WidgetStateManager } from "~lib/WidgetStateManager"

import ElementNodeRenderer, {
  ElementNodeRendererProps,
} from "./ElementNodeRenderer"

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
    ...props,
  }
}

describe("ElementNodeRenderer Block Component", () => {
  describe("render Balloons", () => {
    it("should NOT render a stale component", async () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const props = getProps({
        node: createBalloonNode(scriptRunId),
      })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunState: ScriptRunState.RUNNING,
        scriptRunId: "NEW_SCRIPT_ID",
      })

      await waitFor(() =>
        expect(screen.queryByTestId("stSkeleton")).toBeNull()
      )
      const elementNodeRenderer = screen.getByTestId("stElementContainer")
      expect(elementNodeRenderer).toBeInTheDocument()
      expect(elementNodeRenderer).toHaveClass("stElementContainer")
      expect(elementNodeRenderer.children).toHaveLength(0)
    })

    it("should render a fresh component", async () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const props = getProps({
        node: createBalloonNode(scriptRunId),
      })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunId,
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
        scriptRunState: ScriptRunState.RUNNING,
        scriptRunId: "NEW_SCRIPT_ID",
      })

      await waitFor(() =>
        expect(screen.queryByTestId("stSkeleton")).toBeNull()
      )
      const elementNodeRenderer = screen.getByTestId("stElementContainer")
      expect(elementNodeRenderer).toBeInTheDocument()
      expect(elementNodeRenderer.children).toHaveLength(0)
    })

    it("should render a fresh component", async () => {
      const scriptRunId = "SCRIPT_RUN_ID"
      const props = getProps({
        node: createSnowNode(scriptRunId),
      })
      renderWithContexts(<ElementNodeRenderer {...props} />, {
        scriptRunId,
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
})
