import { VerticalBlock, SessionInfo, ComponentRegistry, AppRoot, BlockPropsWithoutWidth, StreamlitEndpoints, FileUploadClient, ScriptRunState, WidgetStateManager, FormsData } from "@streamlit/lib"
import { IAppPage, WidgetStates, Delta as DeltaProto, ForwardMsgMetadata as ForwardMsgMetadataProto } from "@streamlit/lib/dist/proto"
import { CancelToken } from "axios"
import { PureComponent, ReactElement } from "react"

/**
 * This file is only used as a ToyApp to see if we have exported the minimal
 * exports for VerticalBlock to work
 */
class Endpoints implements StreamlitEndpoints {
 public buildComponentURL(componentName: string, path: string): string {
   throw new Error("Unimplemented")
 }

 public buildMediaURL(url: string): string {
   return url
 }

 public buildAppPageURL(
   pageLinkBaseURL: string | undefined,
   page: IAppPage,
   pageIndex: number
 ): string {
   throw new Error("Unimplemented")
 }

 public uploadFileUploaderFile(
   file: File,
   widgetId: string,
   sessionId: string,
   onUploadProgress?: (progressEvent: any) => void,
   cancelToken?: CancelToken
 ): Promise<number> {
   return Promise.reject(new Error("Unimplemented"))
 }

 public fetchCachedForwardMsg(hash: string): Promise<Uint8Array> {
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

/** Create an empty FormsData instance. */
export function createFormsData(): FormsData {
    return {
      formsWithPendingChanges: new Set(),
      formsWithUploads: new Set(),
      submitButtonCount: new Map(),
    }
  }

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

 private sendRerunBackMsg = (widgetStates: WidgetStates): void => {
   console.log(`rerun requested (widgetStates=${widgetStates.toJSON()})`)
 }
}