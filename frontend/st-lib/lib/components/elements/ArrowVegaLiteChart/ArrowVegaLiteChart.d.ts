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
import { Quiver } from "src/lib/Quiver";
import { Theme } from "src/theme";
interface Props {
    element: VegaLiteChartElement;
    theme: Theme;
    width: number;
}
/** All of the data that makes up a VegaLite chart. */
export interface VegaLiteChartElement {
    /**
     * The dataframe that will be used as the chart's main data source, if
     * specified using Vega-Lite's inline API.
     *
     * This is mutually exclusive with WrappedNamedDataset - if `data` is non-null,
     * `datasets` will not be populated; if `datasets` is populated, then `data`
     * will be null.
     */
    data: Quiver | null;
    /** The a JSON-formatted string with the Vega-Lite spec. */
    spec: string;
    /**
     * Dataframes associated with this chart using Vega-Lite's datasets API,
     * if any.
     */
    datasets: WrappedNamedDataset[];
    /** If True, will overwrite the chart width spec to fit to container. */
    useContainerWidth: boolean;
    /** override the properties with a theme. Currently, only "streamlit" or None are accepted. */
    vegaLiteTheme: string;
}
/** A mapping of `ArrowNamedDataSet.proto`. */
export interface WrappedNamedDataset {
    /** The dataset's optional name. */
    name: string | null;
    /** True if the name field (above) was manually set. */
    hasName: boolean;
    /** The data itself, wrapped in a Quiver object. */
    data: Quiver;
}
export interface PropsWithHeight extends Props {
    height: number | undefined;
}
interface State {
    error?: Error;
}
export declare class ArrowVegaLiteChart extends PureComponent<PropsWithHeight, State> {
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
export declare function getDataArray(dataProto: Quiver, startIndex?: number): {
    [field: string]: any;
}[];
declare const _default: React.FC<Pick<any, string | number | symbol> & {
    theme?: import("@emotion/react").Theme | undefined;
}>;
export default _default;
