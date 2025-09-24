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

import { AppNode } from "./AppNode.interface"
import { TransientNode } from "./TransientNode"
import { AppNodeVisitor } from "./visitors/AppNodeVisitor.interface"
import { DebugVisitor } from "./visitors/DebugVisitor"

/**
 * A standalone AppNode that represents independent items in the tree.
 * This is used for items like logos that are not part of the main content tree
 * but need to be managed with the same lifecycle and visitor patterns.
 */
export class StandaloneNode<T> implements AppNode {
  public readonly element: T | null

  public readonly scriptRunId: string

  // The hash of the script that created this standalone item.
  public readonly activeScriptHash: string

  /** Create a new StandaloneNode. */
  public constructor(
    element: T | null,
    scriptRunId: string,
    activeScriptHash: string
  ) {
    this.element = element
    this.scriptRunId = scriptRunId
    this.activeScriptHash = activeScriptHash
  }

  public accept<T>(visitor: AppNodeVisitor<T>): T {
    return visitor.visitStandaloneNode(this)
  }

  public replaceTransientNode(_node: TransientNode): AppNode {
    // In this case, the standalone node is replacing the transient node
    // so we return the standalone node
    return this
  }

  public debug(): string {
    return this.accept(new DebugVisitor())
  }
}
