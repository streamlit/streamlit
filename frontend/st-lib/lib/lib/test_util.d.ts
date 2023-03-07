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
import { RenderOptions, RenderResult } from "@testing-library/react";
import { MountRendererProps, ReactWrapper, ShallowRendererProps, ShallowWrapper } from "enzyme";
import { Component, ReactElement } from "react";
import { Theme } from "src/theme";
export declare function mount<C extends Component, P = C["props"], S = C["state"]>(node: ReactElement<P>, options?: MountRendererProps, theme?: Theme): ReactWrapper<P, S, C>;
export declare function shallow<C extends Component, P = C["props"], S = C["state"]>(node: ReactElement<P>, options?: ShallowRendererProps, theme?: Theme): ShallowWrapper<P, S, C>;
/**
 * Use react-testing-library to render a ReactElement. The element will be
 * wrapped in our ThemeProvider.
 */
export declare function render(ui: ReactElement, options?: Omit<RenderOptions, "queries">): RenderResult;
