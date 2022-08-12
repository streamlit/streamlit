import { ScriptRunState } from "src/lib/ScriptRunState"
import { AppNode } from "src/lib/AppNode"
import { FormsData, WidgetStateManager } from "src/lib/WidgetStateManager"
import { FileUploadClient } from "src/lib/FileUploadClient"
import { ComponentRegistry } from "src/components/widgets/CustomComponent/"

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
  scriptRunId: string
  scriptRunState: ScriptRunState
  widgetMgr: WidgetStateManager
  uploadClient: FileUploadClient
  widgetsDisabled: boolean
  componentRegistry: ComponentRegistry
  formsData: FormsData
}
