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
import React, { PureComponent } from "react";
import { Map as ImmutableMap } from "immutable";
import { Theme } from "src/theme";
interface Props {
    width: number;
    element: ImmutableMap<string, any>;
    theme: Theme;
}
export interface PropsWithHeight extends Props {
    height: number | undefined;
}
interface State {
    error?: Error;
}
export declare class VegaLiteChart extends PureComponent<PropsWithHeight, State> {
    /**
     * The Vega view object
     */
    private vegaView?;
    /**
     * Finalizer for the embedded vega object. Must be called to dispose
     * of the vegaView when it's no longer used.
     */
    private vegaFinalizer?;
    /**
     * The default data name to add to.
     */
    private defaultDataName;
    /**
     * The html element we attach the Vega view to.
     */
    private element;
    readonly state: {
        error: undefined;
    };
    componentDidMount(): Promise<void>;
    componentWillUnmount(): void;
    /**
     * Finalize the view so it can be garbage collected. This should be done
     * when a new view is created, and when the component unmounts.
     */
    private finalizeView;
    componentDidUpdate(prevProps: PropsWithHeight): Promise<void>;
    generateSpec: () => any;
    /**
     * Update the dataset in the Vega view. This method tried to minimize changes
     * by automatically creating and applying diffs.
     *
     * @param name The name of the dataset.
     * @param prevData The dataset before the update.
     * @param data The dataset at the current state.
     */
    private updateData;
    /**
     * Create a new Vega view and add the data.
     */
    private createView;
    render(): JSX.Element;
}
/**
 * Checks if data looks like it's just prevData plus some appended rows.
 */
export declare function dataIsAnAppendOfPrev(prevData: ImmutableMap<string, number>, prevNumRows: number, prevNumCols: number, data: ImmutableMap<string, number>, numRows: number, numCols: number): boolean;
declare const _default: React.FC<Pick<any, string | number | symbol> & {
    theme?: import("@emotion/react").Theme | undefined;
}>;
export default _default;
