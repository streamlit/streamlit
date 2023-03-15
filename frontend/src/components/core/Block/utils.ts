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

import { ScriptRunState } from "src/lib/ScriptRunState"
import { AppNode } from "src/lib/AppNode"
import { FormsData, WidgetStateManager } from "src/lib/WidgetStateManager"
import { FileUploadClient } from "src/lib/FileUploadClient"
import { ComponentRegistry } from "src/components/widgets/CustomComponent/"
import { SessionInfo } from "src/lib/SessionInfo"

export function shouldComponentBeEnabled(
  elementType: string,
  scriptRunState: ScriptRunState
): boolean {
  return elementType !== "empty" || scriptRunState !== ScriptRunState.RUNNING
}

export function isElementStale(
  node: AppNode,
  scriptRunState: ScriptRunState,
  scriptRunId: string
): boolean {
  if (scriptRunState === ScriptRunState.RERUN_REQUESTED) {
    // If a rerun was just requested, all of our current elements
    // are about to become stale.
    return true
  }
  if (scriptRunState === ScriptRunState.RUNNING) {
    return node.scriptRunId !== scriptRunId
  }
  return false
}

export function isComponentStale(
  enable: boolean,
  node: AppNode,
  scriptRunState: ScriptRunState,
  scriptRunId: string
): boolean {
  return !enable || isElementStale(node, scriptRunState, scriptRunId)
}

export interface BaseBlockProps {
  sessionInfo: SessionInfo
  scriptRunId: string
  scriptRunState: ScriptRunState
  widgetMgr: WidgetStateManager
  uploadClient: FileUploadClient
  widgetsDisabled: boolean
  componentRegistry: ComponentRegistry
  formsData: FormsData
}
