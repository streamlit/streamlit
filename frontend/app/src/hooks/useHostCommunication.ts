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

import {
    DeployedAppMetadata,
    HostCommunicationManager,
    HostCommunicationProps,
    ICustomThemeConfig,
    IMenuItem,
    IToolbarItem,
    PresetThemeName,
    WidgetStates,
} from "@streamlit/lib"
import { useCallback, useRef, useState } from "react"

export interface HostCommunicationState {
  isOwner: boolean
  hostMenuItems: IMenuItem[]
  hostToolbarItems: IToolbarItem[]
  hostHideSidebarNav: boolean
  sidebarChevronDownshift: number
  pageLinkBaseUrl: string
  queryParams: string
  deployedAppMetadata: DeployedAppMetadata
  inputsDisabled: boolean
}

export type HostCommunicationActions = Omit<
  HostCommunicationProps,
  | "isOwnerChanged"
  | "hostMenuItemsChanged"
  | "hostToolbarItemsChanged"
  | "hostHideSidebarNavChanged"
  | "sidebarChevronDownshiftChanged"
  | "pageLinkBaseUrlChanged"
  | "queryParamsChanged"
  | "deployedAppMetadataChanged"
  | "setInputsDisabled"
  // kept in props
  | "streamlitExecutionStartedAt"
>

export interface UseHostCommunicationResult {
  currentState: HostCommunicationState
  hostCommunicationMgr: HostCommunicationManager
  registerActions: (actions: HostCommunicationActions) => void
  setQueryParams: (queryParams: string) => void
}

export function useHostCommunication(
  streamlitExecutionStartedAt: number
): UseHostCommunicationResult {
  const [currentState, setCurrentState] = useState<HostCommunicationState>({
    isOwner: false,
    hostMenuItems: [],
    hostToolbarItems: [],
    hostHideSidebarNav: false,
    sidebarChevronDownshift: 0,
    pageLinkBaseUrl: "",
    queryParams: "",
    deployedAppMetadata: {},
    inputsDisabled: false,
  })

  // We use a ref to hold the user-registered actions (callbacks from App.tsx)
  // because we need to pass a stable set of callbacks to HostCommunicationManager constructor,
  // but the actual implementations won't be available until App mounts and calls registerActions.
  const actionsRef = useRef<HostCommunicationActions | null>(null)

  const registerActions = useCallback(
    (actions: HostCommunicationActions) => {
      actionsRef.current = actions
    },
    []
  )

  // Lazy initialization of the Manager
  const [hostCommunicationMgr] = useState(() => {
    // Proxy functions that delegate to the mutable actionsRef
    const proxyActions: HostCommunicationProps = {
      streamlitExecutionStartedAt,
      // State updaters - explicitly update the local hook state
      isOwnerChanged: (isOwner: boolean) =>
        setCurrentState(s => ({ ...s, isOwner })),
      hostMenuItemsChanged: (hostMenuItems: IMenuItem[]) =>
        setCurrentState(s => ({ ...s, hostMenuItems })),
      hostToolbarItemsChanged: (hostToolbarItems: IToolbarItem[]) =>
        setCurrentState(s => ({ ...s, hostToolbarItems })),
      hostHideSidebarNavChanged: (hostHideSidebarNav: boolean) =>
        setCurrentState(s => ({ ...s, hostHideSidebarNav })),
      sidebarChevronDownshiftChanged: (sidebarChevronDownshift: number) =>
        setCurrentState(s => ({ ...s, sidebarChevronDownshift })),
      pageLinkBaseUrlChanged: (pageLinkBaseUrl: string) =>
        setCurrentState(s => ({ ...s, pageLinkBaseUrl })),
      queryParamsChanged: (queryParams: string) =>
        setCurrentState(s => ({ ...s, queryParams })),
      deployedAppMetadataChanged: (deployedAppMetadata: DeployedAppMetadata) =>
        setCurrentState(s => ({ ...s, deployedAppMetadata })),
      setInputsDisabled: (inputsDisabled: boolean) =>
        setCurrentState(s => ({ ...s, inputsDisabled })),

      // Actions delegated to the registered callback
      sendRerunBackMsg: (
        widgetStates?: WidgetStates,
        pageScriptHash?: string
      ) => actionsRef.current?.sendRerunBackMsg(widgetStates, pageScriptHash),
      closeModal: () => actionsRef.current?.closeModal(),
      stopScript: () => actionsRef.current?.stopScript(),
      rerunScript: () => actionsRef.current?.rerunScript(),
      clearCache: () => actionsRef.current?.clearCache(),
      sendAppHeartbeat: () => actionsRef.current?.sendAppHeartbeat(),
      themeChanged: (
        themeName?: PresetThemeName,
        themeInfo?: ICustomThemeConfig
      ) => actionsRef.current?.themeChanged(themeName, themeInfo),
      pageChanged: (pageScriptHash: string) =>
        actionsRef.current?.pageChanged(pageScriptHash),
      fileUploadClientConfigChanged: (payload: {
        prefix: string
        headers: Record<string, string>
      }) => actionsRef.current?.fileUploadClientConfigChanged(payload),
      restartWebsocketConnection: () =>
        actionsRef.current?.restartWebsocketConnection(),
      terminateWebsocketConnection: () =>
        actionsRef.current?.terminateWebsocketConnection(),
    }
    return new HostCommunicationManager(proxyActions)
  })

  return {
    currentState,
    hostCommunicationMgr,
    registerActions,
    setQueryParams: (queryParams: string) =>
      setCurrentState(s => ({ ...s, queryParams })),
  }
}
