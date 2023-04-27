/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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
import {
  Text as TextProto,
  Block as BlockProto,
  Element as ElementProto,
  ForwardMsgMetadata as ForwardMsgMetadataProto,
} from "src/lib/proto"
import { BlockNode, ElementNode } from "./AppNode"
import VerticalBlock from "./components/core/Block"
import Text from "src/lib/components/elements/Text"
import { ComponentRegistry } from "./components/widgets/CustomComponent"
import { FileUploadClient } from "./FileUploadClient"
import { mockEndpoints, mockSessionInfo } from "./mocks/mocks"
import { ScriptRunState } from "./ScriptRunState"
import { mount } from "./test_util"
import { createFormsData, WidgetStateManager } from "./WidgetStateManager"

function createMockBlockNode(scriptRunID: string, text: string): BlockNode {
  const textElement = new ElementNode(
    ElementProto.create({
      text: TextProto.create({ body: text }),
    }),
    ForwardMsgMetadataProto.create(), // This doesn't actually matter
    scriptRunID
  )

  return new BlockNode(
    [textElement],
    BlockProto.create({
      vertical: BlockProto.Vertical.create({}),
    }),
    scriptRunID
  )
}

describe("StreamlitLib", () => {
  it("can be mounted", () => {
    // Construct required managers
    const scriptRunID = "mockScriptRunID"
    const sessionInfo = mockSessionInfo()
    const endpoints = mockEndpoints()
    let formsData = createFormsData()
    const widgetMgr = new WidgetStateManager({
      sendRerunBackMsg: () => {
        console.log("rerun requested!")
      },
      formsDataChanged: newFormsData => {
        formsData = newFormsData
      },
    })
    const uploadClient = new FileUploadClient({
      sessionInfo,
      endpoints,
      // A form cannot be submitted if it contains a FileUploader widget
      // that's currently uploading. We write that state here, in response
      // to a FileUploadClient callback. The FormSubmitButton element
      // reads the state.
      formsWithPendingRequestsChanged: formIds =>
        widgetMgr.setFormsWithUploads(formIds),
    })
    const componentRegistry = new ComponentRegistry(endpoints)

    // Build a mock BlockNode
    const node = createMockBlockNode(scriptRunID, "hello, StreamlitLib!")

    const wrapper = mount(
      <VerticalBlock
        node={node}
        endpoints={endpoints}
        sessionInfo={sessionInfo}
        scriptRunId={scriptRunID}
        scriptRunState={ScriptRunState.NOT_RUNNING}
        widgetMgr={widgetMgr}
        uploadClient={uploadClient}
        widgetsDisabled={false}
        componentRegistry={componentRegistry}
        formsData={formsData}
      />
    )

    const text = wrapper.find(Text)
    expect(text.text()).toBe("hello, StreamlitLib!")
  })
})
