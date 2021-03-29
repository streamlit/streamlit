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

import produce, { immerable } from "immer"

/** Immutable data about all st.forms in the app. */
export class FormsData {
  // We use immer to produce new versions of this immutable class.
  // This declaration marks the class as immer-aware.
  [immerable] = true

  /** Forms that have unsubmitted changes. */
  public readonly pendingForms: Set<string>

  /** Forms that have in-progress file uploads. */
  public readonly formsWithUploads: Set<string>

  public constructor() {
    this.pendingForms = new Set()
    this.formsWithUploads = new Set()
  }

  /** True if the given form has unsubmitted changes. */
  public hasPendingChanges(formId: string): boolean {
    return this.pendingForms.has(formId)
  }

  /** True if the given form has at least one in-progress upload. */
  public hasInProgressUpload(formId: string): boolean {
    return this.formsWithUploads.has(formId)
  }

  public setPendingForms(pendingForms: Set<string>): FormsData {
    return produce(this, draft => {
      draft.pendingForms = pendingForms
    })
  }

  public setFormsWithUploads(formsWithUploads: Set<string>): FormsData {
    return produce(this, draft => {
      draft.formsWithUploads = formsWithUploads
    })
  }
}
