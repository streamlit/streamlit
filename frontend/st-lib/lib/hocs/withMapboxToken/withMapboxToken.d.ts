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
import { ComponentType } from "react";
/**
 * A higher-order component that fetches our mapbox token and passes
 * it through to the wrapped component. If the token fetch fails, an error
 * will be rendered in place of the wrapped component.
 *
 * @param {string} deltaType In case of an exception we show an error with this
 */
declare const withMapboxToken: (deltaType: string) => (WrappedComponent: ComponentType<any>) => ComponentType<any>;
export default withMapboxToken;
