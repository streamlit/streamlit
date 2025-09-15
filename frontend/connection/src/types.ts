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

/**
 * Attempts to connect to the URIs in uriList (in round-robin fashion) and
 * retries forever until one of the URIs responds with 'ok'.
 * Returns a promise with the index of the URI that worked.
 */

import { IAppPage } from "@streamlit/protobuf"
import type { StreamlitWindowObject } from "@streamlit/utils"

import { ConnectionState } from "./ConnectionState"

declare global {
  interface Window {
    __streamlit?: StreamlitWindowObject
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
export type OnMessage = (ForwardMsg: any) => void

export type OnConnectionStateChange = (
  connectionState: ConnectionState,
  errMsg?: string
) => void

export type OnRetry = (
  totalTries: number,
  errorMarkdown: string,
  retryTimeout: number
) => void

export type Event =
  | "INITIALIZED"
  | "CONNECTION_CLOSED"
  | "CONNECTION_ERROR"
  | "CONNECTION_SUCCEEDED"
  | "CONNECTION_TIMED_OUT"
  | "SERVER_PING_SUCCEEDED"
  | "FATAL_ERROR" // Unrecoverable error. This should never happen!

export type FileUploadClientConfig = {
  prefix: string
  headers: Record<string, string>
}

/** Exposes non-websocket endpoints used by the frontend. */
export interface StreamlitEndpoints {
  /**
   * Set the static config url for static connection media assets.
   *
   * @param url The URL to set.
   */
  setStaticConfigUrl(url: string): void

  /**
   * Send postMessage to host with client errors
   * @param component component causing the error
   * @param error error status code or message
   * @param message additional error info
   * @param source component src (url)
   * @param customComponentName If custom component, the component's name causing the error.
   */
  sendClientErrorToHost(
    component: string,
    error: string | number,
    message: string,
    source: string,
    customComponentName?: string
  ): void

  /**
   * Checks if the component src has successful response.
   * If not, sends CLIENT_ERROR message with error info.
   * @param sourceUrl The source to check.
   * @param componentName The component for which the source is being checked.
   * @param customComponentName If custom component, the component's name for which the source is being checked.
   */
  checkSourceUrlResponse(
    sourceUrl: string,
    componentName: string,
    customComponentName?: string
  ): Promise<void>

  /**
   * Return a URL to fetch data for the given custom component.
   * @param componentName The registered name of the component.
   * @param path The path of the component resource to fetch, e.g. "index.html".
   */
  buildComponentURL(componentName: string, path: string): string

  /**
   * Construct a URL for a media file.
   * @param url a relative or absolute URL. If `url` is absolute, it will be
   * returned unchanged. Otherwise, the return value will be a URL for fetching
   * the media file from the connected Streamlit instance.
   */
  buildMediaURL(url: string): string

  /**
   * Construct a URL for a download file.
   * @param url a relative or absolute URL. If `url` is absolute, it will be
   * returned unchanged. Otherwise, the return value will be a URL for fetching
   * the media file from the connected Streamlit instance.
   */
  buildDownloadUrl(url: string): string

  /**
   * Construct a URL for uploading a file.
   * @param url a relative or absolute URL. If `url` is absolute, it will be
   * returned unchanged. Otherwise, the return value will be a URL for fetching
   * the media file from the connected Streamlit instance.
   */
  buildFileUploadURL?(url: string): string

  /**
   * Construct a URL for an app page in a multi-page app.
   * @param pageLinkBaseURL the optional pageLinkBaseURL set by the host communication layer.
   * @param page the page's AppPage protobuf properties
   * @param pageIndex the page's zero-based index
   */
  buildAppPageURL(pageLinkBaseURL: string | undefined, page: IAppPage): string

  /**
   * Upload a file to the FileUploader endpoint.
   *
   * @param fileUploadUrl The URL to upload the file to.
   * @param file The file to upload.
   * @param sessionId the current sessionID. The file will be associated with this ID.
   * @param onUploadProgress optional function that will be called repeatedly with progress events during the upload.
   * @param signal optional AbortSignal that can be used to cancel the in-progress upload.
   *
   * @return a Promise<number> that resolves with the file's unique ID, as assigned by the server.
   */
  uploadFileUploaderFile(
    fileUploadUrl: string,
    file: File,
    sessionId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    onUploadProgress?: (progressEvent: any) => void,
    signal?: AbortSignal
  ): Promise<void>

  /**
   * Request that the file at the given URL be deleted.
   *
   * @param fileUrl: The URL of the file to delete.
   * @param sessionId the current sessionID.
   */
  deleteFileAtURL?(fileUrl: string, sessionId: string): Promise<void>

  /**
   * setFileUploadClientConfig.
   * @param config the object that contains prefix and headers object
   */
  setFileUploadClientConfig?(config: FileUploadClientConfig): void
}

/**
 * The lib config contains various configurations that the host platform can
 * use to configure streamlit-lib frontend behavior. This should to be treated as part of the public
 * API, and changes need to be backwards-compatible meaning that an old host configuration
 * should still work with a new frontend versions.
 */
export type LibConfig = {
  /**
   * The mapbox token that can be configured by a platform.
   */
  mapboxToken?: string

  /**
   * Whether to disable the full screen mode all elements / widgets.
   */
  disableFullscreenMode?: boolean

  enforceDownloadInNewTab?: boolean

  /**
   * Whether and which value to set the `crossOrigin` property on media elements (img, video, audio).
   * If it is set to undefined, the `crossOrigin` property will not be set on media elements at all.
   * For img elements, see https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/crossOrigin
   */
  resourceCrossOriginMode?: undefined | "anonymous" | "use-credentials"

  /** Deprecated. Use resourceCrossOriginMode instead. If set to true, the value of resourceCrossOriginMode will be "anonymous". */
  setAnonymousCrossOriginPropertyOnMediaElements?: boolean
}

/**
 * The app config contains various configurations that the host platform can
 * use to configure streamlit-app frontend behavior. This should to be treated as part of the public
 * API, and changes need to be backwards-compatible meaning that an old host configuration
 * should still work with a new frontend versions.
 *
 * TODO(lukasmasuch): Potentially refactor HostCommunicationManager and move this type
 * to AppContext.tsx.
 */
export type AppConfig = {
  /**
   * A list of origins that we're allowed to receive cross-iframe messages
   * from via the browser's window.postMessage API.
   */
  allowedOrigins?: string[]
  /**
   * Whether to wait until we've received a SET_AUTH_TOKEN message before
   * resolving deferredAuthToken.promise. The WebsocketConnection class waits
   * for this promise to resolve before attempting to establish a connection
   * with the Streamlit server.
   */
  useExternalAuthToken?: boolean
  /**
   * Enables custom string messages to be sent to the host
   */
  enableCustomParentMessages?: boolean
  /**
   * Whether host wants to block error dialogs. If true, blocks error dialogs
   * from being shown to the user, sends error info to host via postMessage
   */
  blockErrorDialogs?: boolean
}

export type MetricsConfig = {
  /**
   * URL to send metrics data to via POST request.
   * Setting to "postMessage" sends metrics events via postMessage to host.
   * Setting to "off" disables metrics collection.
   * If undefined, metricsUrl requested from centralized config file.
   */
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  metricsUrl?: string | "postMessage" | "off"
}

/**
 * The response structure of the `_stcore/host-config` endpoint.
 * This combines streamlit-lib specific configuration options with
 * streamlit-app specific options (e.g. allowed message origins).
 */
export type IHostConfigResponse = LibConfig & AppConfig & MetricsConfig
