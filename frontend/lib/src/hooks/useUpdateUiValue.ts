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

import { Dispatch, SetStateAction, useEffect } from "react"

/**
 * Sets the ui value to the new value if they are not equal and the ui value is not dirty.
 * If the ui value is dirty, it means the user has made changes to the ui value that have not been synced to the backend.
 *
 * @param newValue the new value to set the ui value to
 * @param uiValue the current ui value
 * @param setUiValue the function to set the ui value
 * @param dirty whether the ui value is dirty (has unsynced changes)
 */
export default function useUpdateUiValue<T>(
  newValue: T,
  uiValue: T,
  setUiValue: Dispatch<SetStateAction<T>>,
  dirty: boolean
): void {
  useEffect(() => {
    // the UI did not sync its value
    if (dirty) {
      return
    }
    // If the incoming value changes, update the UI value (e.g. set via state)
    if (newValue !== uiValue) {
      setUiValue(newValue)
    }
  }, [newValue, uiValue, dirty, setUiValue])
}
