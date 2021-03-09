/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
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

import { CancelToken } from "axios"
import HttpClient from "lib/HttpClient"
import { SessionInfo } from "lib/SessionInfo"
import _ from "lodash"
import { BaseUriParts } from "./UriUtil"

interface FileWithId {
  file: File
  id: string
}

/** Common widget protobuf fields that are used by the FileUploadClient. */
interface WidgetInfo {
  id: string
  formId: string
}

interface Props {
  getServerUri: () => BaseUriParts | undefined
  csrfEnabled: boolean
  formsWithPendingRequestsChanged: (formIds: Set<string>) => void
}

/**
 * Handles uploading files to the server.
 */
export class FileUploadClient extends HttpClient {
  /**
   * Map of <formId: number of outstanding requests>. Updated whenever
   * a widget in a form creates are completes a request.
   */
  private readonly formsWithPendingRequests = new Map<string, number>()

  /**
   * Called when the set of forms that have pending file requests changes.
   */
  private readonly pendingFormUploadsChanged: (formIds: Set<string>) => void

  public constructor(props: Props) {
    super(props.getServerUri, props.csrfEnabled)
    this.pendingFormUploadsChanged = props.formsWithPendingRequestsChanged
  }

  /**
   * Upload a file to the server. It will be associated with this browser's sessionID.
   *
   * @param widget: the ID of the FileUploader widget that's doing the upload.
   * @param fileWithId: the file to upload.
   * @param onUploadProgress: an optional function that will be called repeatedly with progress events during the upload.
   * @param cancelToken: an optional axios CancelToken that can be used to cancel the in-progress upload.
   * @param replace: an optional boolean to indicate if the file should replace existing files associated with the widget.
   */
  public async uploadFile(
    widget: WidgetInfo,
    fileWithId: FileWithId,
    onUploadProgress?: (progressEvent: any) => void,
    cancelToken?: CancelToken,
    replace?: boolean
  ): Promise<void> {
    const form = new FormData()
    form.append("sessionId", SessionInfo.current.sessionId)
    form.append("widgetId", widget.id)

    if (replace) {
      form.append("replace", "true")
    }
    form.append(fileWithId.id, fileWithId.file, fileWithId.file.name)

    this.offsetPendingRequestCount(widget.formId, 1)
    await this.request("upload_file", {
      cancelToken,
      method: "POST",
      data: form,
      onUploadProgress,
    }).finally(() => this.offsetPendingRequestCount(widget.formId, -1))
  }

  public async delete(widget: WidgetInfo, fileId: string): Promise<void> {
    this.offsetPendingRequestCount(widget.formId, 1)
    await this.request(
      `upload_file/${SessionInfo.current.sessionId}/${widget.id}/${fileId}`,
      { method: "DELETE" }
    ).finally(() => this.offsetPendingRequestCount(widget.formId, -1))
  }

  private getFormIdSet(): Set<string> {
    return new Set(this.formsWithPendingRequests.keys())
  }

  private offsetPendingRequestCount(formId: string, offset: number): void {
    if (offset === 0) {
      return
    }

    const curCount = this.formsWithPendingRequests.get(formId) ?? 0
    const newCount = curCount + offset
    if (newCount < 0) {
      throw new Error(
        `Can't offset pendingRequestCount below 0 (formId=${formId}, curCount=${curCount}, offset=${offset})`
      )
    }

    const prevWidgetIds = this.getFormIdSet()

    if (newCount === 0) {
      this.formsWithPendingRequests.delete(formId)
    } else {
      this.formsWithPendingRequests.set(formId, newCount)
    }

    const newWidgetIds = this.getFormIdSet()
    if (!_.isEqual(newWidgetIds, prevWidgetIds)) {
      this.pendingFormUploadsChanged(newWidgetIds)
    }
  }
}
