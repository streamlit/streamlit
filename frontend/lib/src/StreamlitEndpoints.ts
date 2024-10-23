/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import { CancelToken } from "axios"

import { IAppPage } from "./proto"

export type JWTHeader = {
  jwtHeaderName: string
  jwtHeaderValue: string
}

/** Exposes non-websocket endpoints used by the frontend. */
export interface StreamlitEndpoints {
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
   * @param cancelToken optional axios CancelToken that can be used to cancel the in-progress upload.
   *
   * @return a Promise<number> that resolves with the file's unique ID, as assigned by the server.
   */
  uploadFileUploaderFile(
    fileUploadUrl: string,
    file: File,
    sessionId: string,
    onUploadProgress?: (progressEvent: any) => void,
    cancelToken?: CancelToken
  ): Promise<void>

  /**
   * Request that the file at the given URL be deleted.
   *
   * @param fileUrl: The URL of the file to delete.
   * @param sessionId the current sessionID.
   */
  deleteFileAtURL?(fileUrl: string, sessionId: string): Promise<void>

  /**
   * Set JWT Header.
   * @param jwtHeader the object that contains jwtHeaderName and jwtHeaderValue
   */
  setJWTHeader?(jwtHeader: JWTHeader): void
}
