/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { FormsData } from "~lib/WidgetStateManager"

export interface FormsContextProps {
  /**
   * Data about all forms in the app. The WidgetStateManager creates its own
   * internal FormsData instance, and calls a callback (`formsDataChanged`)
   * when forms are updated. This FormsData instance should be updated
   * from that callback.
   * Pulled from context in BlockNodeRenderer/FormSubmitButton
   * @see BlockNodeRenderer
   * @see FormSubmitButton
   */
  formsData: FormsData
}

/**
 * Initialize FormsContext with a default value of null so downstream usages
 * will trigger runtime errors if context expected to exist but does not.
 */
export const FormsContext = createContext<FormsContextProps | null>(null)

// Set the conetxt display name for useRequiredContext error message
FormsContext.displayName = "FormsContext"
