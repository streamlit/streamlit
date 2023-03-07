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
import { ReactElement, ReactNode } from "react";
export declare enum Kind {
    ERROR = "error",
    INFO = "info",
    SUCCESS = "success",
    WARNING = "warning"
}
export interface AlertContainerProps {
    width?: number;
    kind: Kind;
    children: ReactNode;
}
/**
 * Provides Base Styles for any Alert Type UI. Used in the following cases:
 *   * Alert is the Streamlit specific alert component that users can use with
 *     any Markdown. Users have API access to generate these.
 *   * ExceptionElement is a special type of alert that formats an exception
 *     with a stack trace provided. Users have API access to generate these.
 *   * ErrorElement is an alert for an internal exception happening in
 *     Streamlit (likely a JS exception happening at runtime). Users do NOT
 *     have API access to generate these.
 */
export default function AlertContainer({ kind, width, children, }: AlertContainerProps): ReactElement;
