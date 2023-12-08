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

import React, { ReactElement, useMemo } from "react"

import VerticalBlock from "../core/Block"
import { useStreamlitScriptRun } from "../StreamlitApp/stores/ScriptRunContext"
import { useStreamlitInstallation } from "../StreamlitApp/stores/StreamlitInstallationContext"
import { useWidgetStateManager } from "../StreamlitApp/stores/WidgetStateManagerContext"
import { SessionInfo } from "@streamlit/lib/src/SessionInfo"
import {
  ConnectionState,
  useStreamlitConnection,
} from "../StreamlitApp/stores/ConnectionContext"
import { FileUploadClient } from "@streamlit/lib/src/FileUploadClient"
import { ComponentRegistry } from "../widgets/CustomComponent"
import { StreamlitEndpoints } from "@streamlit/lib/src/StreamlitEndpoints"
import { useStreamlitElementTree } from "../StreamlitApp/stores/StreamlitElementTreeContext"

class DummyEndpoints implements StreamlitEndpoints {
  public buildComponentURL(): string {
    throw new Error("Unimplemented")
  }

  public buildMediaURL(url: string): string {
    return url
  }

  public buildAppPageURL(): string {
    throw new Error("Unimplemented")
  }

  public uploadFileUploaderFile(): Promise<void> {
    return Promise.reject(new Error("Unimplemented"))
  }

  public fetchCachedForwardMsg(): Promise<Uint8Array> {
    return Promise.reject(new Error("Unimplemented"))
  }
}

export interface StreamlitViewProps {
  namespace: string
}

export function StreamlitView({
  namespace,
}: StreamlitViewProps): ReactElement {
  const { connectionState } = useStreamlitConnection()
  const { widgetManager, formsData } = useWidgetStateManager()
  const { scriptRunState, scriptRunId } = useStreamlitScriptRun()
  const {} = useStreamlitInstallation()
  const elementTree = useStreamlitElementTree()

  const endpoints = useMemo(() => new DummyEndpoints(), [])
  const sessionInfo = useMemo(() => new SessionInfo(), [])
  const uploadClient = useMemo(
    () =>
      new FileUploadClient({
        sessionInfo: sessionInfo,
        endpoints,
        // A form cannot be submitted if it contains a FileUploader widget
        // that's currently uploading. We write that state here, in response
        // to a FileUploadClient callback. The FormSubmitButton element
        // reads the state.
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        formsWithPendingRequestsChanged: formIds =>
          widgetManager.setFormsWithUploads(formIds),
        requestFileURLs: () => {},
      }),
    []
  )
  const componentRegistry = useMemo(
    () => new ComponentRegistry(endpoints),
    [endpoints]
  )
  // TODO More advance logic
  const node = elementTree.get_by_namespace(namespace)

  return (
    <VerticalBlock
      node={node}
      endpoints={endpoints}
      sessionInfo={sessionInfo}
      scriptRunId={scriptRunId}
      scriptRunState={scriptRunState}
      widgetMgr={widgetManager}
      widgetsDisabled={connectionState !== ConnectionState.CONNECTED}
      uploadClient={uploadClient}
      componentRegistry={componentRegistry}
      formsData={formsData}
    />
  )
}
