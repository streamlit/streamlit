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
/// <reference types="react" />
export declare const ThemedStyledDropdownListItem: import("@emotion/styled").StyledComponent<{
    $as?: import("react").ElementType<any> | undefined;
} & {
    $disabled?: boolean | undefined;
    $isFocused?: boolean | undefined;
    $isFocusVisible?: boolean | undefined;
    $isHighlighted?: boolean | undefined;
    $size?: "default" | "compact" | undefined;
} & {
    item?: any;
} & {
    $style?: import("styletron-standard").StyleObject | ((props: {
        $disabled?: boolean | undefined;
        $isFocused?: boolean | undefined;
        $isFocusVisible?: boolean | undefined;
        $isHighlighted?: boolean | undefined;
        $size?: "default" | "compact" | undefined;
    } & {
        item?: any;
    }) => import("styletron-standard").StyleObject) | undefined;
    className?: string | undefined;
} & Omit<any, "className" | "$disabled" | "$isFocusVisible" | "$style" | "$isFocused" | "$isHighlighted" | "$size" | "item"> & {
    theme?: import("@emotion/react").Theme | undefined;
}, {}, {}>;
