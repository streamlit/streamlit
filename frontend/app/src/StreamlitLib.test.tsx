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

/* eslint-disable @typescript-eslint/no-unused-vars */

import React, { PureComponent, ReactElement } from "react"
import "@testing-library/jest-dom"
import { screen } from "@testing-library/react"
import {
  AppRoot,
  VerticalBlock,
  ComponentRegistry,
  FileUploadClient,
  ScriptRunState,
  SessionInfo,
  StreamlitEndpoints,
  createFormsData,
  FormsData,
  WidgetStateManager,
  Delta as DeltaProto,
  Element as ElementProto,
  ForwardMsgMetadata as ForwardMsgMetadataProto,
  Text as TextProto,
  render,
} from "@streamlit/lib"

/**
 * Example StreamlitEndpoints implementation.
 */
class Endpoints implements StreamlitEndpoints {
  public buildComponentURL(): string {
    throw new Error("Unimplemented")
  }

  public buildMediaURL(url: string): string {
    return url
  }

  public buildFileUploadURL(url: string): string {
    return url
  }

  public buildAppPageURL(): string {
    throw new Error("Unimplemented")
  }

  public uploadFileUploaderFile(): Promise<void> {
    return Promise.reject(new Error("Unimplemented"))
  }

  public deleteFileAtURL(): Promise<void> {
    return Promise.reject(new Error("Unimplemented"))
  }

  public fetchCachedForwardMsg(): Promise<Uint8Array> {
    return Promise.reject(new Error("Unimplemented"))
  }
}

interface Props {}

interface State {
  elements: AppRoot
  formsData: FormsData
  scriptRunState: ScriptRunState
  scriptRunId: string
}

// Mock needed for Block.tsx
class ResizeObserver {
  observe(): void {}

  unobserve(): void {}

  disconnect(): void {}
}
window.ResizeObserver = ResizeObserver

/** An example root component for an app that uses StreamlitLib. */
class StreamlitLibExample extends PureComponent<Props, State> {
  private readonly sessionInfo = new SessionInfo()

  private readonly endpoints = new Endpoints()

  private readonly componentRegistry = new ComponentRegistry(this.endpoints)

  private readonly widgetMgr: WidgetStateManager

  private readonly uploadClient: FileUploadClient

  public constructor(props: Props) {
    super(props)

    // Initialize managers
    this.widgetMgr = new WidgetStateManager({
      sendRerunBackMsg: this.sendRerunBackMsg,
      formsDataChanged: formsData => this.setState({ formsData }),
    })

    this.uploadClient = new FileUploadClient({
      sessionInfo: this.sessionInfo,
      endpoints: this.endpoints,
      // A form cannot be submitted if it contains a FileUploader widget
      // that's currently uploading. We write that state here, in response
      // to a FileUploadClient callback. The FormSubmitButton element
      // reads the state.
      formsWithPendingRequestsChanged: formIds =>
        this.widgetMgr.setFormsWithUploads(formIds),
      requestFileURLs: jest.fn(),
    })

    this.sessionInfo.setCurrent({
      // Disable ForwardMessageCaching:
      maxCachedMessageAge: 0,

      // Used by FileUploadClient to associate file uploads with
      // sessions.
      sessionId: "mockSessionId",

      // Unused by StreamlitLib:
      appId: "",
      streamlitVersion: "",
      pythonVersion: "",
      installationId: "",
      installationIdV3: "",
      commandLine: "",
      userMapboxToken: "",
    })

    // Initialize React state
    this.state = {
      elements: AppRoot.empty("Please wait..."),
      formsData: createFormsData(),
      scriptRunState: ScriptRunState.NOT_RUNNING,
      // ScriptRunID should get a new unique ID every time the
      // Streamlit view is being "rebuilt".
      scriptRunId: `${0}`,
    }
  }

  /**
   * Should be called before the first Delta from a "script run" is handled.
   * Stores this script run's unique ID, and sets our ScriptRunState to RUNNING.
   */
  public beginScriptRun = (scriptRunId: string): void => {
    this.setState({
      scriptRunState: ScriptRunState.RUNNING,
      scriptRunId: scriptRunId,
    })
  }

  /**
   * Should be called after all Deltas from a "script run" have been handled.
   * Sets ScriptRunState to NOT_RUNNING, and clears "stale nodes" (nodes that
   * belonged to a previous script run).
   */
  public endScriptRun = (): void => {
    this.setState(prevState => ({
      scriptRunState: ScriptRunState.NOT_RUNNING,
      elements: prevState.elements.clearStaleNodes(prevState.scriptRunId),
    }))
  }

  /** Process a DeltaMsg and its associated ForwardMsgMetadata. */
  public handleDeltaMsg = (
    deltaMsg: DeltaProto,
    metadataMsg: ForwardMsgMetadataProto
  ): void => {
    // Apply the Delta to our root AppNode to produce a new root and
    // trigger a re-render.
    this.setState(prevState => ({
      elements: prevState.elements.applyDelta(
        prevState.scriptRunId,
        deltaMsg,
        metadataMsg
      ),
    }))
  }

  public render = (): ReactElement => {
    // This example doesn't involve a sidebar, so our only root blockNode
    // is `elements.main`.
    const blockNode = this.state.elements.main

    return (
      <VerticalBlock
        node={blockNode}
        endpoints={this.endpoints}
        sessionInfo={this.sessionInfo}
        scriptRunId={this.state.scriptRunId}
        scriptRunState={this.state.scriptRunState}
        widgetMgr={this.widgetMgr}
        uploadClient={this.uploadClient}
        widgetsDisabled={false}
        componentRegistry={this.componentRegistry}
        formsData={this.state.formsData}
      />
    )
  }

  private sendRerunBackMsg = (): void => {}
}

describe("StreamlitLibExample", () => {
  it("can be rendered without crashing", () => {
    render(<StreamlitLibExample />)

    // Before any Elements are explicitly added, our example class
    // will show a placeholder "Please wait..." info message
    expect(screen.getByText("Please wait...")).toBeInTheDocument()
  })

  it("handles Delta messages", () => {
    // there's nothing within the app ui to cycle through script run messages so we need a reference
    let streamlitLibInstance: any
    render(
      <StreamlitLibExample
        ref={ref => {
          streamlitLibInstance = ref
        }}
      />
    )

    // construct a delta
    const delta = DeltaProto.create({
      newElement: ElementProto.create({
        text: TextProto.create({ body: "Hello, world!" }),
      }),
    })

    // construct its metadata
    const metadata = ForwardMsgMetadataProto.create({
      deltaPath: [0, 0], // main container, first element
    })

    // Send the delta to our app
    streamlitLibInstance.beginScriptRun("newScriptRun")
    streamlitLibInstance.handleDeltaMsg(delta, metadata)
    streamlitLibInstance.endScriptRun()

    // our "Please wait..." alert should be gone, because it
    // belonged to a previous "script run"
    expect(screen.queryByText("Please wait...")).not.toBeInTheDocument()

    // And we should have the single Text element we created
    expect(screen.getByText("Hello, world!")).toBeInTheDocument()
  })
})
