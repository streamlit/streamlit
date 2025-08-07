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

import axios, { AxiosRequestConfig, AxiosResponse } from "axios"
import { getLogger } from "loglevel"

import { IAppPage } from "@streamlit/protobuf"
import {
  buildHttpUri,
  getCookie,
  makePath,
  notNullOrUndefined,
} from "@streamlit/utils"

import { FileUploadClientConfig, StreamlitEndpoints } from "./types"
import { parseUriIntoBaseParts } from "./utils"

const LOG = getLogger("DefaultStreamlitEndpoints")

interface Props {
  getServerUri: () => URL | undefined
  csrfEnabled: boolean
  sendClientError: (
    component: string,
    error: string | number,
    message: string,
    source: string,
    customComponentName?: string
  ) => void
}

// These endpoints need to be kept in sync with the endpoints in
// lib/streamlit/web/server/server.py
const MEDIA_ENDPOINT = "/media"
const UPLOAD_FILE_ENDPOINT = "/_stcore/upload_file"
const COMPONENT_ENDPOINT_BASE = "/component"

/** Default Streamlit server implementation of the StreamlitEndpoints interface. */
export class DefaultStreamlitEndpoints implements StreamlitEndpoints {
  private readonly getServerUri: () => URL | undefined

  private readonly sendClientError: (
    component: string,
    error: string | number,
    message: string,
    source: string,
    customComponentName?: string
  ) => void

  private readonly csrfEnabled: boolean

  private cachedServerUri?: URL

  private fileUploadClientConfig?: FileUploadClientConfig

  private staticConfigUrl: string | null

  public constructor(props: Props) {
    this.getServerUri = props.getServerUri
    this.csrfEnabled = props.csrfEnabled
    this.sendClientError = props.sendClientError
    this.staticConfigUrl = null
  }

  public setStaticConfigUrl(url: string | null): void {
    this.staticConfigUrl = url
  }

  public sendClientErrorToHost(
    component: string,
    error: string | number,
    message: string,
    source: string,
    customComponentName?: string
  ): void {
    this.sendClientError(
      component,
      error,
      message,
      source,
      customComponentName
    )
  }

  /**
   * Check the source of a component for successful response (for those without onerror event)
   * If the response is not ok, or fetch otherwise fails, send an error to the host.
   */
  public async checkSourceUrlResponse(
    sourceUrl: string,
    componentName: string,
    customComponentName?: string
  ): Promise<void> {
    const componentForError = customComponentName
      ? `${componentName} ${customComponentName}`
      : componentName

    try {
      const response = await fetch(sourceUrl)
      if (!response.ok) {
        // Send response info if unsuccessful
        LOG.error(
          `Client Error: ${componentForError} source error - ${response.status}`
        )
        this.sendClientErrorToHost(
          componentName,
          response.status,
          response.statusText,
          sourceUrl,
          customComponentName
        )
      }
      // Don't send error info on success
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown Error"
      // Send fetch error info on failure
      LOG.error(`Client Error: ${componentForError} fetch error - ${message}`)
      this.sendClientErrorToHost(
        componentName,
        "Error fetching source",
        message,
        sourceUrl,
        customComponentName
      )
    }
  }

  public buildComponentURL(componentName: string, path: string): string {
    return buildHttpUri(
      this.requireServerUri(),
      `${COMPONENT_ENDPOINT_BASE}/${componentName}/${path}`
    )
  }

  public setFileUploadClientConfig({
    prefix,
    headers,
  }: FileUploadClientConfig): void {
    this.fileUploadClientConfig = {
      prefix,
      headers,
    }
  }

  /**
   * If we are using a static connection, return S3 URL for that file. Otherwise, return null.
   */
  private buildStaticUrl(file: string): string {
    const queryParams = new URLSearchParams(document.location.search)
    const staticAppId = queryParams.get("staticAppId")
    return `${this.staticConfigUrl}/${staticAppId}${file}`
  }

  /**
   * Construct a URL for a media file. If the `staticConfigUrl` is set, we have a static app
   * and will serve media from S3. If the url is relative and starts with  "/media",
   * assume it's being served from Streamlit and construct it appropriately.
   * Otherwise leave it alone.
   */
  public buildMediaURL(url: string): string {
    if (this.staticConfigUrl && url.startsWith(MEDIA_ENDPOINT)) {
      return this.buildStaticUrl(url)
    }
    if (url.startsWith(MEDIA_ENDPOINT)) {
      return buildHttpUri(this.requireServerUri(), url)
    }
    return url
  }

  /**
   * Construct a URL for a download file.
   * @param url a relative or absolute URL. If `url` is absolute, it will be
   * returned unchanged. Otherwise, the return value will be a URL for fetching
   * the media file from the connected Streamlit instance. The target server can
   * be changed by setting window.__streamlit?.DOWNLOAD_ASSETS_BASE_URL.
   */
  public buildDownloadUrl(url: string): string {
    if (!url.startsWith(MEDIA_ENDPOINT)) {
      return url
    }

    // The url is relative, so we need to build the full URL.
    const downloadAssetBaseUrl = window.__streamlit?.DOWNLOAD_ASSETS_BASE_URL
    return downloadAssetBaseUrl
      ? buildHttpUri(parseUriIntoBaseParts(downloadAssetBaseUrl), url)
      : buildHttpUri(this.requireServerUri(), url)
  }

  /**
   * Construct a URL for uploading a file. If the `fileUploadClientConfig`
   * exists, we build URL by prefixing URL with prefix from the config,
   * otherwise if the `fileUploadClientConfig` is not present, if URL is
   * relative and starts with "/_stcore/upload_file", assume we're uploading
   * the file to the Streamlit Tornado server and construct the URL
   * appropriately. Otherwise, we're probably uploading the file to some
   * external service, so we leave the URL alone.
   */
  public buildFileUploadURL(url: string): string {
    if (this.fileUploadClientConfig) {
      return makePath(this.fileUploadClientConfig.prefix, url)
    }

    return url.startsWith(UPLOAD_FILE_ENDPOINT)
      ? buildHttpUri(this.requireServerUri(), url)
      : url
  }

  /** Construct a URL for an app page in a multi-page app. */
  public buildAppPageURL(
    pageLinkBaseURL: string | undefined,
    page: IAppPage
  ): string {
    const urlPath = page.urlPathname as string
    const navigateTo = page.isDefault ? "" : urlPath

    if (typeof pageLinkBaseURL === "string" && pageLinkBaseURL.length > 0) {
      return `${pageLinkBaseURL}/${navigateTo}`
    }

    // NOTE: We use window.location to get the port instead of
    // getBaseUriParts() because the port may differ in dev mode (since
    // the frontend is served by the react dev server and not the
    // streamlit server).
    const { port, protocol } = window.location
    const { pathname, hostname } = this.requireServerUri()
    const portSection = port ? `:${port}` : ""
    // Empty path names are simply "/" Anything else must have more to it
    const basePathSection = pathname === "/" ? "/" : `${pathname}/`

    return `${protocol}//${hostname}${portSection}${basePathSection}${navigateTo}`
  }

  public async uploadFileUploaderFile(
    fileUploadUrl: string,
    file: File,
    _sessionId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
    onUploadProgress?: (progressEvent: any) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const form = new FormData()
    const { name, webkitRelativePath } = file
    // For directory uploads, use the relative path as fileName to preserve directory structure
    const fileName = webkitRelativePath || name
    form.append(name, file, fileName)

    const headers: Record<string, string> = this.getAdditionalHeaders()

    const uploadUrl = this.buildFileUploadURL(fileUploadUrl)

    try {
      await this.csrfRequest<number>(uploadUrl, {
        signal,
        method: "PUT",
        data: form,
        responseType: "text",
        headers,
        onUploadProgress,
      })
      // If the request succeeds, we don't care about the response body
    } catch (error: unknown) {
      // Send error info on failure
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- TODO: Fix this
      LOG.error(`Client Error: File uploader error on file upload - ${error}`)
      const message = error instanceof Error ? error.message : "Unknown Error"
      this.sendClientErrorToHost(
        "File Uploader",
        "Error uploading file",
        message,
        uploadUrl
      )
      // Reject the promise with the error after sending the error to the host
      throw error
    }
  }

  private getAdditionalHeaders(): Record<string, string> {
    let headers: Record<string, string> = {}

    if (this.fileUploadClientConfig) {
      headers = {
        ...headers,
        ...this.fileUploadClientConfig.headers,
      }
    }
    return headers
  }

  /**
   * Send an HTTP DELETE request to the given URL.
   */
  public async deleteFileAtURL(
    fileUrl: string,
    sessionId: string
  ): Promise<void> {
    const headers: Record<string, string> = this.getAdditionalHeaders()
    const deleteUrl = this.buildFileUploadURL(fileUrl)

    try {
      await this.csrfRequest<number>(deleteUrl, {
        method: "DELETE",
        data: { sessionId },
        headers,
      })
      // If the request succeeds, we don't care about the response body
    } catch (error: unknown) {
      // Send error info on failure
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- TODO: Fix this
      LOG.error(`Client Error: File uploader error on file delete - ${error}`)
      const message = error instanceof Error ? error.message : "Unknown Error"
      this.sendClientErrorToHost(
        "File Uploader",
        "Error deleting file",
        message,
        deleteUrl
      )
      // Reject the promise with the error after sending the error to the host
      throw error
    }
  }

  /**
   * Fetch the server URI. If our server is disconnected, default to the most
   * recent cached value of the URI. If we're disconnected and have no cached
   * value, throw an Error.
   */
  private requireServerUri(): URL {
    const serverUri = this.getServerUri()
    if (notNullOrUndefined(serverUri)) {
      this.cachedServerUri = serverUri
      return serverUri
    }

    if (notNullOrUndefined(this.cachedServerUri)) {
      return this.cachedServerUri
    }

    throw new Error("not connected to a server!")
  }

  /**
   * Wrapper around axios.request to update the request config with
   * CSRF headers if client has CSRF protection enabled.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TODO: Replace 'any' with a more specific type.
  private csrfRequest<T = any, R = AxiosResponse<T>>(
    url: string,
    params: AxiosRequestConfig
  ): Promise<R> {
    params.url = url

    if (this.csrfEnabled) {
      const xsrfCookie = getCookie("_streamlit_xsrf")
      if (notNullOrUndefined(xsrfCookie)) {
        params.headers = {
          "X-Xsrftoken": xsrfCookie,
          ...(params.headers || {}),
        }
        params.withCredentials = true
      }
    }

    return axios.request<T, R>(params)
  }
}
