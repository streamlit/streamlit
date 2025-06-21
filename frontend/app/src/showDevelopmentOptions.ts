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

import { Config } from "@streamlit/protobuf"
import { isLocalhost } from "@streamlit/utils"

export const showDevelopmentOptions = (
  hostIsOwner: boolean | undefined,
  toolbarMode: Config.ToolbarMode
): boolean => {
  if (toolbarMode == Config.ToolbarMode.DEVELOPER) {
    return true
  }
  if (
    Config.ToolbarMode.VIEWER == toolbarMode ||
    Config.ToolbarMode.MINIMAL == toolbarMode
  ) {
    return false
  }
  return hostIsOwner || isLocalhost()
}
