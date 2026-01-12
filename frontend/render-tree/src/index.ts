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

// Main classes
export { AppRoot } from "./AppRoot"
export { NO_SCRIPT_RUN_ID } from "./AppNode.interface"
export type { AppNode } from "./AppNode.interface"
export { BlockNode } from "./BlockNode"
export { ElementNode } from "./ElementNode"
export { TransientNode } from "./TransientNode"

// Types
export type { VegaLiteChartElement, WrappedNamedDataset } from "./types"

// Utilities
export {
  ensureError,
  getLoadingScreenType,
  LoadingScreenType,
  makeAppSkeletonElement,
  makeElementWithErrorText,
  makeElementWithInfoText,
} from "./utils"

// Visitors
export type { AppNodeVisitor } from "./visitors/AppNodeVisitor.interface"
export { ClearStaleNodeVisitor } from "./visitors/ClearStaleNodeVisitor"
export { ClearTransientNodesVisitor } from "./visitors/ClearTransientNodesVisitor"
export { DebugVisitor, MAX_HASH_LENGTH } from "./visitors/DebugVisitor"
export { ElementsSetVisitor } from "./visitors/ElementsSetVisitor"
export { FilterMainScriptElementsVisitor } from "./visitors/FilterMainScriptElementsVisitor"
export { GetNodeByDeltaPathVisitor } from "./visitors/GetNodeByDeltaPathVisitor"
export { SetNodeByDeltaPathVisitor } from "./visitors/SetNodeByDeltaPathVisitor"
