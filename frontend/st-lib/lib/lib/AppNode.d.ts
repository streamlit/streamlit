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
import { Map as ImmutableMap } from "immutable";
import { ArrowNamedDataSet, Block as BlockProto, Delta, Element, ForwardMsgMetadata, NamedDataSet } from "src/autogen/proto";
import { VegaLiteChartElement } from "src/components/elements/ArrowVegaLiteChart/ArrowVegaLiteChart";
import { Quiver } from "src/lib/Quiver";
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
    readonly scriptRunId: string;
    /**
     * Return the AppNode for the given index path, or undefined if the path
     * is invalid.
     */
    getIn(path: number[]): AppNode | undefined;
    /**
     * Return a copy of this node with a new element set at the given index
     * path. Throws an error if the path is invalid.
     */
    setIn(path: number[], node: AppNode, scriptRunId: string): AppNode;
    /**
     * Recursively remove children nodes whose scriptRunId is no longer current.
     * If this node should no longer exist, return undefined.
     */
    clearStaleNodes(currentScriptRunId: string): AppNode | undefined;
    /**
     * Return a Set of all the Elements contained in the tree.
     * If an existing Set is passed in, that Set will be mutated and returned.
     * Otherwise, a new Set will be created and will be returned.
     */
    getElements(elementSet?: Set<Element>): Set<Element>;
}
/**
 * A leaf AppNode. Contains a single element to render.
 */
export declare class ElementNode implements AppNode {
    readonly element: Element;
    readonly metadata: ForwardMsgMetadata;
    readonly scriptRunId: string;
    /**
     * A lazily-created immutableJS version of our element.
     *
     * This is temporary! `immutableElement` is currently needed for
     * dataframe-consuming elements because our dataframe API is
     * immutableJS-based. It'll go away when we've converted to an ArrowJS-based
     * dataframe API.
     *
     * Because most elements do *not* use the Dataframe API, and therefore
     * do not need to access `immutableElement`, it is calculated lazily.
     */
    private lazyImmutableElement?;
    private lazyQuiverElement?;
    private lazyVegaLiteChartElement?;
    /** Create a new ElementNode. */
    constructor(element: Element, metadata: ForwardMsgMetadata, scriptRunId: string);
    get immutableElement(): ImmutableMap<string, any>;
    get quiverElement(): Quiver;
    get vegaLiteChartElement(): VegaLiteChartElement;
    getIn(path: number[]): AppNode | undefined;
    setIn(path: number[], node: AppNode, scriptRunId: string): AppNode;
    clearStaleNodes(currentScriptRunId: string): ElementNode | undefined;
    getElements(elements?: Set<Element>): Set<Element>;
    addRows(namedDataSet: NamedDataSet, scriptRunId: string): ElementNode;
    arrowAddRows(namedDataSet: ArrowNamedDataSet, scriptRunId: string): ElementNode;
    private static quiverAddRowsHelper;
    private static vegaLiteChartAddRowsHelper;
}
/**
 * A container AppNode that holds children.
 */
export declare class BlockNode implements AppNode {
    readonly children: AppNode[];
    readonly deltaBlock: BlockProto;
    readonly scriptRunId: string;
    constructor(children?: AppNode[], deltaBlock?: BlockProto, scriptRunId?: string);
    /** True if this Block has no children. */
    get isEmpty(): boolean;
    getIn(path: number[]): AppNode | undefined;
    setIn(path: number[], node: AppNode, scriptRunId: string): BlockNode;
    clearStaleNodes(currentScriptRunId: string): BlockNode | undefined;
    getElements(elementSet?: Set<Element>): Set<Element>;
}
/**
 * The root of our data tree. It contains the app's top-level BlockNodes.
 */
export declare class AppRoot {
    private readonly root;
    /**
     * Create an empty AppRoot with an optional placeholder element.
     */
    static empty(placeholderText?: string): AppRoot;
    constructor(root: BlockNode);
    get main(): BlockNode;
    get sidebar(): BlockNode;
    applyDelta(scriptRunId: string, delta: Delta, metadata: ForwardMsgMetadata): AppRoot;
    clearStaleNodes(currentScriptRunId: string): AppRoot;
    /** Return a Set containing all Elements in the tree. */
    getElements(): Set<Element>;
    private addElement;
    private addBlock;
    private addRows;
    private arrowAddRows;
}
