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
import HttpClient from "src/lib/HttpClient"
import { SessionInfo } from "src/lib/SessionInfo"
import _ from "lodash"
import { BaseUriParts } from "./UriUtil"
import { isValidFormId } from "./utils"

/** Common widget protobuf fields that are used by the FileUploadClient. */
interface WidgetInfo {
  id: string
  formId: string
}

interface Props {
  /** The app's SessionInfo instance. */
  sessionInfo: SessionInfo
  getServerUri: () => BaseUriParts | undefined
  csrfEnabled: boolean
  formsWithPendingRequestsChanged: (formIds: Set<string>) => void
}

/**
 * Handles uploading files to the server.
 */
export class FileUploadClient extends HttpClient {
  private readonly sessionInfo: SessionInfo

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
    this.sessionInfo = props.sessionInfo
  }

  /**
   * Upload a file to the server. It will be associated with this browser's sessionID.
   *
   * @param widget: the FileUploader widget that's doing the upload.
   * @param file: the files to upload.
   * @param onUploadProgress: an optional function that will be called repeatedly with progress events during the upload.
   * @param cancelToken: an optional axios CancelToken that can be used to cancel the in-progress upload.
   *
   * @return a Promise<number> that resolves with the file's unique ID, as assigned by the server.
   */
  public async uploadFile(
    widget: WidgetInfo,
    file: File,
    onUploadProgress?: (progressEvent: any) => void,
    cancelToken?: CancelToken
  ): Promise<number> {
    const form = new FormData()
    form.append("sessionId", this.sessionInfo.current.sessionId)
    form.append("widgetId", widget.id)
    form.append(file.name, file)

    this.offsetPendingRequestCount(widget.formId, 1)
    return this.request<number>("_stcore/upload_file", {
      cancelToken,
      method: "POST",
      data: form,
      responseType: "text",
      onUploadProgress,
    })
      .then(response => {
        // Sanity check. Axios should be returning a number here.
        if (typeof response.data === "number") {
          return response.data
        }

        throw new Error(
          `Bad uploadFile response: expected a number but got '${response.data}'`
        )
      })
      .finally(() => this.offsetPendingRequestCount(widget.formId, -1))
  }

  private getFormIdSet(): Set<string> {
    return new Set(this.formsWithPendingRequests.keys())
  }

  private offsetPendingRequestCount(formId: string, offset: number): void {
    if (offset === 0) {
      return
    }

    if (!isValidFormId(formId)) {
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
