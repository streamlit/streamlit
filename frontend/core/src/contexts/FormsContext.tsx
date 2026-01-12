/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

import { createContext } from "react"

import { Button as SubmitButtonProto } from "@streamlit/protobuf"

/**
 * Immutable structure that exposes public data about all the forms in the app.
 * WidgetStateManager produces new instances of this type when forms data
 * changes.
 */
export interface FormsData {
  /** Forms that have unsubmitted changes. */
  readonly formsWithPendingChanges: Set<string>

  /** Forms that have in-progress file uploads. */
  readonly formsWithUploads: Set<string>

  /**
   * Mapping of formID:numberOfSubmitButtons. (Most forms will have only one,
   * but it's not an error to have multiple.)
   */
  readonly submitButtons: Map<string, Array<SubmitButtonProto>>
}

export interface FormsContextProps {
  /**
   * Data about all forms in the app. The WidgetStateManager creates its own
   * internal FormsData instance, and calls a callback (`formsDataChanged`)
   * when forms are updated. This FormsData instance should be updated
   * from that callback.
   *
   * Consumed by: Form, FormSubmitButton
   * @see Form
   * @see FormSubmitButton
   */
  formsData: FormsData
}

/**
 * FormsContext provides access to form state data throughout the app.
 *
 * Initialize with a default value of null so downstream usages will trigger
 * runtime errors if context expected to exist but does not.
 */
export const FormsContext = createContext<FormsContextProps | null>(null)

// Set the context display name for useRequiredContext error message
FormsContext.displayName = "FormsContext"
