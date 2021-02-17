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

import { CancelTokenSource } from "axios"

export interface UploadingStatus {
  type: "uploading"
  cancelToken: CancelTokenSource
  progress: number
}

export interface UploadedStatus {
  type: "uploaded"
}

export interface DeletingStatus {
  type: "deleting"
}

export interface ErrorStatus {
  type: "error"
  errorMessage: string
}

/** The various statuses that an UploadedFileInfo can have. */
export type FileStatus =
  | UploadingStatus
  | UploadedStatus
  | DeletingStatus
  | ErrorStatus

/**
 * Wraps a File object with additional data used by FileUploader.
 * This class is immutable because it's used in within FileUploader.state.
 */
export class UploadFileInfo {
  public readonly file: File

  public readonly status: FileStatus

  public readonly id: string

  /**
   * Create a clone of this UploadFileInfo with the given status.
   */
  public setStatus(status: FileStatus): UploadFileInfo {
    return new UploadFileInfo(this.file, status, this.id)
  }

  public constructor(file: File, status: FileStatus, id?: string) {
    this.file = file
    this.status = status
    this.id = id != null ? id : `${new Date().getTime()}-${Math.random()}`
  }
}
