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

import { CancelToken } from "axios"

/** Exposes non-websocket endpoints used by the frontend. */
export interface StreamlitEndpoints {
  /**
   * Return a URL to fetch data for the given custom component.
   * @param componentName The registered name of the component.
   * @param path The path of the component resource to fetch, e.g. "index.html".
   */
  buildComponentURL(componentName: string, path: string): string

  /**
   * Upload a file to the FileUploader endpoint.
   *
   * @param file The file to upload
   * @param widgetId the widget ID of the FileUploader associated with the file.
   * @param sessionId the current sessionID. The file will be associated with this ID.
   * @param onUploadProgress optional function that will be called repeatedly with progress events during the upload
   * @param cancelToken optional axios CancelToken that can be used to cancel the in-progress upload.
   *
   * @return a Promise<number> that resolves with the file's unique ID, as assigned by the server.
   */
  uploadFileUploaderFile(
    file: File,
    widgetId: string,
    sessionId: string,
    onUploadProgress?: (progressEvent: any) => void,
    cancelToken?: CancelToken
  ): Promise<number>
}
