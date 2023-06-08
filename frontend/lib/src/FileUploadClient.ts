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
import { SessionInfo } from "./SessionInfo"
import _ from "lodash"
import { StreamlitEndpoints } from "./StreamlitEndpoints"
import { isValidFormId } from "./util/utils"

/** Common widget protobuf fields that are used by the FileUploadClient. */
interface WidgetInfo {
  id: string
  formId: string
}

interface Props {
  /** The app's SessionInfo instance. */
  sessionInfo: SessionInfo
  endpoints: StreamlitEndpoints
  formsWithPendingRequestsChanged: (formIds: Set<string>) => void
}

/**
 * Handles uploading files to the server.
 */
export class FileUploadClient {
  private readonly sessionInfo: SessionInfo

  private readonly endpoints: StreamlitEndpoints

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
    this.sessionInfo = props.sessionInfo
    this.endpoints = props.endpoints
    this.pendingFormUploadsChanged = props.formsWithPendingRequestsChanged
  }

  /**
   * Upload a file to the given URL. It will be associated with this browser's
   * sessionID.
   *
   * @param widget: the FileUploader widget that's doing the upload.
   * @param fileUploadUrl: the URL to upload the file to.
   * @param file: the files to upload.
   * @param onUploadProgress: an optional function that will be called repeatedly with progress events during the upload.
   * @param cancelToken: an optional axios CancelToken that can be used to cancel the in-progress upload.
   *
   * @return a Promise<number> that resolves with the file's unique ID, as assigned by the server.
   */
  public async uploadFile(
    widget: WidgetInfo,
    fileUploadUrl: string,
    file: File,
    onUploadProgress?: (progressEvent: any) => void,
    cancelToken?: CancelToken
    // TODO(vdonato): Change the return type to Promise<void> once we've gotten
    // rid of numerical file IDs.
  ): Promise<number> {
    this.offsetPendingRequestCount(widget.formId, 1)
    return this.endpoints
      .uploadFileUploaderFile(
        fileUploadUrl,
        file,
        this.sessionInfo.current.sessionId,
        onUploadProgress,
        cancelToken
      )
      .finally(() => this.offsetPendingRequestCount(widget.formId, -1))
  }

  /**
   * Request that the file at the given URL is deleted.
   * @param fileUrl: the URL of the file to delete.
   */
  public deleteFile(fileUrl: string): Promise<void> {
    return this.endpoints.deleteFileAtURL(
      fileUrl,
      this.sessionInfo.current.sessionId
    )
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
