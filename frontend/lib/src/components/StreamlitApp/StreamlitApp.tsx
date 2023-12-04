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

import React, { useEffect, useMemo, useState } from "react"
import type { Context, ReactElement, ReactNode } from "react"
import { BackMsg, type WidgetStates } from "../../proto"
import { useConnectionManager } from "./hooks/useConnectionManager"
import { useMessageQueue } from "./hooks/useMessageQueue"
import {
  ConnectionContext,
  type ConnectionContextValue,
} from "./stores/ConnectionContext"
import { GitContext, type GitInfo } from "./stores/GitContext"
import {
  extractPageNameFromPathName,
  useAppUrlManager,
} from "./hooks/useAppUrlManager"
import type { BaseUriParts } from "@streamlit/lib"
import { useStreamlitScriptRunState } from "./hooks/useStreamlitScriptRunState"
import { useStreamlitAppSettingsState } from "./hooks/useStreamlitAppSettingsState"
import { useGitState } from "./hooks/useGitState"
import { useStreamlitInstallationState } from "./hooks/useStreamlitInstallationState"
import {
  type StreamlitInstallation,
  StreamlitInstallationContext,
} from "./stores/StreamlitInstallationContext"
import {
  type AppSettings,
  AppSettingsContext,
} from "./stores/AppSettingsContext"
import {
  ScriptRunContext,
  type ScriptRunInfo,
  ScriptRunState,
} from "./stores/ScriptRunContext"
import { type PageConfig, PageConfigContext } from "./stores/PageConfigContext"
import { useStatelessPageConfig } from "./hooks/useStatelessPageConfig"
import { useStreamlitElementTree } from "./hooks/useStreamlitElementTree"
import { useWidgetStateManagerState } from "./hooks/useWidgetStateManagerState"
import {
  WidgetStateManagerContext,
  type WidgetStateManagerContextValue,
} from "./stores/WidgetStateManagerContext"
import {
  type StreamlitAppCommands,
  StreamlitAppCommandsContext,
} from "./stores/AppCommandsContext"
import { type AppUrl, AppUrlContext } from "./stores/AppUrlContext"

export interface StreamlitAppProps {
  children: ReactNode
  endpoint: string
  pageConfig?: PageConfig
  onPageConfigChange?: (pageConfig: PageConfig) => void
}

type ContextPair<T> = [Context<T>, T]

// Host Communication
// Metrics Manager
// Upload Client
// Component Registry
// embeddingId -- UI Specific
// Theming
// Performance Metrics
// File Uploader

export function StreamlitApp({
  children,
  endpoint,
  pageConfig,
  onPageConfigChange,
}: StreamlitAppProps): ReactElement {
  const connectionContextValue = useConnectionManager(endpoint)

  // There's an unfortunate situation where we do not know the "official" url
  // So we let the connectionManager figure it out and let us know.
  const [workingEndpoint, setWorkingEndpoint] = useState<BaseUriParts | null>(
    null
  )
  const { connectionManager } = connectionContextValue

  useEffect(() => {
    connectionManager.on(
      "connectionEndpointIdentified",
      (uri: BaseUriParts) => {
        setWorkingEndpoint(uri)
      }
    )
  }, [connectionManager])

  const messageQueue = useMessageQueue(connectionManager)
  const streamlitInstallation = useStreamlitInstallationState(messageQueue)
  const appSettings = useStreamlitAppSettingsState(messageQueue)
  const scriptRun = useStreamlitScriptRunState(
    messageQueue,
    streamlitInstallation
  )
  const pageConfigContextValue = useStatelessPageConfig(
    messageQueue,
    pageConfig,
    onPageConfigChange
  )
  const appUrlManager = useAppUrlManager(messageQueue, workingEndpoint)
  const elements = useStreamlitElementTree(
    messageQueue,
    streamlitInstallation,
    scriptRun,
    appUrlManager.currentPageScriptHash
  )
  const widgetStateContextValue = useWidgetStateManagerState(
    connectionManager,
    messageQueue,
    streamlitInstallation,
    appUrlManager.currentPageScriptHash,
    elements
  )
  const gitInfo = useGitState(messageQueue)

  const { widgetManager } = widgetStateContextValue

  const commands = useMemo(() => {
    const sendRerunBackMessage = (
      widgetStates?: WidgetStates,
      requestedPageScriptHash?: string
    ): void => {
      const { requestScriptRerun, scriptRunState } = scriptRun
      if (
        scriptRunState === ScriptRunState.RUNNING ||
        scriptRunState === ScriptRunState.RERUN_REQUESTED ||
        workingEndpoint === null
      ) {
        // Don't queue up multiple rerunScript requests
        return
      }

      requestScriptRerun()

      // Note: `rerunScript` is incorrectly called in some places.
      // We can remove `=== true` after adding type information
      // if (alwaysRunOnSave === true) {
      //   // Update our run-on-save setting *before* calling rerunScript.
      //   // The rerunScript message currently blocks all BackMsgs from
      //   // being processed until the script has completed executing.
      //   this.saveSettings({ ...this.state.userSettings, runOnSave: true })
      // }

      let pageName = ""
      let pageScriptHash = ""

      if (requestedPageScriptHash) {
        // The user specified exactly which page to run. We can simply use this
        // value in the BackMsg we send to the server.
        pageScriptHash = requestedPageScriptHash
      } else if (appUrlManager.currentPageScriptHash) {
        // The user didn't specify which page to run, which happens when they
        // click the "Rerun" button in the main menu. In this case, we
        // rerun the current page.
        pageScriptHash = appUrlManager.currentPageScriptHash
      } else {
        // We must be in the case where the user is navigating directly to a
        // non-main page of this app. Since we haven't received the list of the
        // app's pages from the server at this point, we fall back to requesting
        // the page to run via pageName, which we extract from
        // document.location.pathname.
        pageName = extractPageNameFromPathName(
          document.location.pathname,
          workingEndpoint.basePath
        )
        pageScriptHash = ""
      }

      const backMsg = new BackMsg({
        rerunScript: {
          queryString: appUrlManager.queryParams.toString(),
          widgetStates,
          pageScriptHash,
          pageName,
        },
      })
      connectionManager.sendBackMessage(backMsg)
    }
    return {
      rerunScript: () => {
        sendRerunBackMessage(widgetManager.createWidgetStatesMsg())
      },
      clearCache: () => {
        const backMsg = new BackMsg({ clearCache: true })
        backMsg.type = "clearCache"
        connectionManager.sendBackMessage(backMsg)
      },
      stopScript: () => {
        const { requestScriptStop, scriptRunState } = scriptRun
        if (
          scriptRunState === ScriptRunState.NOT_RUNNING ||
          scriptRunState === ScriptRunState.STOP_REQUESTED
        ) {
          // Don't queue up multiple stopScript requests
          return
        }

        const backMsg = new BackMsg({ stopScript: true })
        backMsg.type = "stopScript"
        connectionManager.sendBackMessage(backMsg)
        requestScriptStop()
      },
      setRunOnSave: (runOnSave: boolean) => {
        if (appSettings.allowRunOnSave !== runOnSave) {
          const backMsg = new BackMsg({ setRunOnSave: runOnSave })
          backMsg.type = "setRunOnSave"
          connectionManager.sendBackMessage(backMsg)
        }
      },
      loadGitInfo: () => {
        connectionManager.sendBackMessage(new BackMsg({ loadGitInfo: true }))
      },
      debugDisconnectWebSocket: () => {
        const backMsg = new BackMsg({ debugDisconnectWebsocket: true })
        backMsg.type = "debugDisconnectWebsocket"
        connectionManager.sendBackMessage(backMsg)
      },
      debugShutdownRuntime: () => {
        const backMsg = new BackMsg({ debugShutdownRuntime: true })
        backMsg.type = "debugShutdownRuntime"
        connectionManager.sendBackMessage(backMsg)
      },
      fileUrlsRequest: (requestId: string, files: File[]) => {
        const backMsg = new BackMsg({
          fileUrlsRequest: {
            requestId,
            fileNames: files.map(f => f.name),
            sessionId: streamlitInstallation?.sessionId,
          },
        })
        backMsg.type = "fileUrlsRequest"
        connectionManager.sendBackMessage(backMsg)
      },
      changePage: (pageScriptHash: string) => {
        sendRerunBackMessage(undefined, pageScriptHash)
      },
    }
  }, [
    appSettings,
    connectionManager,
    scriptRun,
    streamlitInstallation,
    widgetManager,
    appUrlManager.currentPageScriptHash,
    appUrlManager.queryParams,
    workingEndpoint,
  ])

  // We essentially have a bunch of contexts that we want to nest
  // We it's a bit of a pain to do this manually, so we use a reduce
  // to do this for us.
  const contexts = [
    [
      ConnectionContext,
      connectionContextValue,
    ] as ContextPair<ConnectionContextValue>,
    [
      StreamlitInstallationContext,
      streamlitInstallation,
    ] as ContextPair<StreamlitInstallation>,
    [AppSettingsContext, appSettings] as ContextPair<AppSettings>,
    [ScriptRunContext, scriptRun] as ContextPair<ScriptRunInfo>,
    [AppUrlContext, appUrlManager] as ContextPair<AppUrl>,
    [
      WidgetStateManagerContext,
      widgetStateContextValue,
    ] as ContextPair<WidgetStateManagerContextValue>,
    [GitContext, gitInfo] as ContextPair<GitInfo>,
    [PageConfigContext, pageConfigContextValue] as ContextPair<PageConfig>,
    [
      StreamlitAppCommandsContext,
      commands,
    ] as ContextPair<StreamlitAppCommands>,
  ]

  return contexts.reduce(
    (node, [Context, value]) => (
      // @ts-expect-error We hit difficulty typing this
      <Context.Provider value={value}>{node}</Context.Provider>
    ),
    children
  ) as ReactElement
}
