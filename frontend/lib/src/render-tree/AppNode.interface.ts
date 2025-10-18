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

import { Element } from "@streamlit/protobuf"

/**
 * The Generic ID of the script run this node was generated in.
 */
export const NO_SCRIPT_RUN_ID = "NO_SCRIPT_RUN_ID"

/**
 * An immutable node of the "App Data Tree".
 *
 * Trees are composed of `ElementNode` leaves, which contain data about
 * a single visual element, and `BlockNode` branches, which determine the
 * layout of a group of children nodes.
 *
 * A simple tree might look like this:
 *
 *   AppRoot
 *   ├── BlockNode ("main")
 *   │   ├── ElementNode (text: "Ahoy, Streamlit!")
 *   │   └── ElementNode (button: "Don't Push This")
 *   └── BlockNode ("sidebar")
 *       └── ElementNode (checkbox: "Batten The Hatches")
 *
 * To build this tree, the frontend receives `Delta` messages from Python,
 * each of which corresponds to a tree mutation ("add an element",
 * "add a block", "add rows to an existing element"). The frontend builds the
 * tree bit by bit in response to these `Delta`s.
 *
 * To render the app, the `AppView` class walks this tree and outputs
 * a corresponding DOM structure, using React, that's essentially a mapping
 * of `AppElement` -> `ReactNode`. This rendering happens "live" - that is,
 * the app is re-rendered each time a new `Delta` is received.
 *
 * Because the app gets re-rendered frequently, updates need to be fast.
 * Our React components - the building blocks of the app - are "pure"
 * (see https://reactjs.org/docs/react-api.html#reactpurecomponent), which
 * means that React uses shallow comparison to determine which ReactNodes to
 * update.
 *
 * Thus, each node in our tree is _immutable_ - any change to a `AppNode`
 * actually results in a *new* `AppNode` instance. This occurs recursively,
 * so inserting a new `ElementNode` into the tree will also result in new
 * `BlockNode`s for each of that Element's ancestors, all the way up to the
 * root node. Then, when React re-renders the app, it will re-traverse the new
 * nodes that have been created, and rebuild just the bits of the app that
 * have changed.
 */
export interface AppNode {
  /**
   * The ID of the script run this node was generated in. When a script finishes
   * running, the app prunes all stale nodes.
   */
  readonly scriptRunId: string

  /**
   * The ID of the fragment that sent the Delta creating this AppNode. If this
   * AppNode was not created by a fragment, this field is falsy.
   */
  readonly fragmentId?: string

  /**
   * The hash of the script that created this node.
   */
  readonly activeScriptHash?: string

  // A timestamp indicating based on which delta message the node was created.
  // If the node was created without a delta message, this field is undefined.
  // This helps us to update React components based on a new backend message even though other
  // props have not changed; this can happen for UI-only interactions such as dismissing a dialog.
  readonly deltaMsgReceivedAt?: number

  /**
   * Return the AppNode for the given index path, or undefined if the path
   * is invalid.
   */
  getIn(path: number[]): AppNode | undefined

  /**
   * Return a copy of this node with a new element set at the given index
   * path. Throws an error if the path is invalid.
   */
  setIn(path: number[], node: AppNode, scriptRunId: string): AppNode

  /**
   * Recursively remove children nodes whose activeScriptHash is no longer
   * associated with the mainScriptHash.
   */
  filterMainScriptElements(mainScriptHash: string): AppNode | undefined

  /**
   * Recursively remove children nodes whose scriptRunId is no longer current.
   * If this node should no longer exist, return undefined.
   */
  clearStaleNodes(
    currentScriptRunId: string,
    fragmentIdsThisRun?: Array<string>,
    fragmentIdOfBlock?: string
  ): AppNode | undefined

  /**
   * Return a Set of all the Elements contained in the tree.
   * If an existing Set is passed in, that Set will be mutated and returned.
   * Otherwise, a new Set will be created and will be returned.
   */
  getElements(elementSet?: Set<Element>): Set<Element>
}
