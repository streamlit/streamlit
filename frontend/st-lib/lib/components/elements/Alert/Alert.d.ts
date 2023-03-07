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
import { ReactElement } from "react";
import { Alert as AlertProto } from "src/autogen/proto";
import { Kind } from "src/components/shared/AlertContainer";
export declare function getAlertKind(format: AlertProto.Format): Kind;
export interface AlertProps {
    body: string;
    icon?: string;
    kind: Kind;
    width: number;
}
/**
 * Display an (error|warning|info|success) box with a Markdown-formatted body.
 */
export default function Alert({ icon, body, kind, width, }: AlertProps): ReactElement;
