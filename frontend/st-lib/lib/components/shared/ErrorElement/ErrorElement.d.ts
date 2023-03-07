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
export interface ErrorElementProps {
    name: string;
    message: string | ReactElement;
    stack?: string;
    width?: number;
}
/**
 * A component that draws an error on the screen. This is for internal use
 * only. That is, this should not be an element that a user purposefully places
 * in a Streamlit app. For that, see st.exception / Exception.tsx or
 * st.error / Text.tsx.
 */
declare function ErrorElement(props: ErrorElementProps): ReactElement;
export default ErrorElement;
