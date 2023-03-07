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
import React, { PureComponent, ReactNode } from "react";
import { Theme } from "src/theme";
import { DeckGlJsonChart as DeckGlJsonChartProto } from "src/autogen/proto";
import "mapbox-gl/dist/mapbox-gl.css";
interface PickingInfo {
    object: {
        [key: string]: string;
    };
}
interface DeckObject {
    initialViewState: {
        height: number;
        width: number;
    };
    layers: Record<string, unknown>[];
    mapStyle?: string | Array<string>;
}
interface Props {
    width: number;
    theme: Theme;
    mapboxToken: string;
    element: DeckGlJsonChartProto;
}
export interface PropsWithHeight extends Props {
    height: number | undefined;
}
interface State {
    viewState: Record<string, unknown>;
    initialized: boolean;
    initialViewState: Record<string, unknown>;
}
export declare const DEFAULT_DECK_GL_HEIGHT = 500;
export declare class DeckGlJsonChart extends PureComponent<PropsWithHeight, State> {
    readonly state: {
        viewState: {
            bearing: number;
            pitch: number;
            zoom: number;
        };
        initialized: boolean;
        initialViewState: {};
    };
    componentDidMount: () => void;
    static getDerivedStateFromProps(props: Readonly<PropsWithHeight>, state: Partial<State>): Partial<State> | null;
    static getDeckObject: (props: PropsWithHeight) => DeckObject;
    createTooltip: (info: PickingInfo) => Record<string, unknown> | boolean;
    interpolate: (info: PickingInfo, body: string) => string;
    onViewStateChange: ({ viewState }: State) => void;
    render(): ReactNode;
}
declare const _default: React.FC<Pick<any, string | number | symbol> & {
    theme?: import("@emotion/react").Theme | undefined;
}>;
export default _default;
