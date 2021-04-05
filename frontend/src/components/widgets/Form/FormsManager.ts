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
import produce, { Draft } from "immer"

export interface FormsData {
  /** Forms that have unsubmitted changes. */
  readonly formsWithPendingChanges: Set<string>

  /** Forms that have in-progress file uploads. */
  readonly formsWithUploads: Set<string>
}

/** Create an empty FormsData instance. */
export function createFormsData(): FormsData {
  return {
    formsWithPendingChanges: new Set(),
    formsWithUploads: new Set(),
  }
}

/**
 * Singleton manager for Forms data. Manages changes to FormsData, and notifies
 * listeners when FormsData has changed.
 */
export class FormsManager {
  private readonly formsDataChanged: (formsData: FormsData) => void

  private data: FormsData

  public constructor(
    initialData: FormsData,
    formsDataChanged: (formsData: FormsData) => void
  ) {
    this.data = initialData
    this.formsDataChanged = formsDataChanged
  }

  public setPendingForms(pendingForms: Set<string>): void {
    this.updateData(draft => {
      draft.formsWithPendingChanges = pendingForms
    })
  }

  public setFormsWithUploads(formsWithUploads: Set<string>): void {
    this.updateData(draft => {
      draft.formsWithUploads = formsWithUploads
    })
  }

  /**
   * Produce a new FormsData with the given recipe, and fire off the
   * formsDataChanged callback with that new data.
   */
  private updateData(recipe: (draft: Draft<FormsData>) => void): void {
    const newData = produce(this.data, recipe)
    if (this.data !== newData) {
      this.data = newData
      this.formsDataChanged(this.data)
    }
  }
}
