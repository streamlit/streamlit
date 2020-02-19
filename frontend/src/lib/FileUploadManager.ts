/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import axios from "axios"
import { SessionInfo } from "lib/SessionInfo"
import { BaseUriParts, buildHttpUri } from "lib/UriUtil"

/**
 * Handles uploading files to the server.
 */
export class FileUploadManager {
  private readonly getServerUri: () => BaseUriParts | undefined

  constructor(getServerUri: () => BaseUriParts | undefined) {
    this.getServerUri = getServerUri
  }

  /**
   * Upload a file to the server.
   */
  public async uploadFile(
    widgetId: string,
    name: string,
    lastModified: number,
    data: Uint8Array | Blob,
    onUploadProgress?: (progressEvent: any) => void
  ): Promise<void> {
    const serverURI = this.getServerUri()
    if (serverURI === undefined) {
      throw new Error("Cannot upload file: not connected to a server")
    }

    const form = new FormData()
    form.append("sessionId", SessionInfo.current.sessionId)
    form.append("widgetId", widgetId)
    form.append("lastModified", lastModified.toString())
    if (data instanceof Blob) {
      form.append(name, data)
    } else {
      form.append(name, new Blob([data.buffer]))
    }

    await axios.request({
      url: buildHttpUri(serverURI, "upload_file"),
      method: "POST",
      data: form,
      onUploadProgress,
    })
  }
}
