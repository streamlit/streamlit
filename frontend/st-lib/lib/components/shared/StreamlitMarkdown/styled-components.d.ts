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
import { Theme } from "@emotion/react";
export interface StyledStreamlitMarkdownProps {
    isCaption: boolean;
    isInSidebar: boolean;
    isLabel?: boolean;
    isCheckbox?: boolean;
}
export declare const StyledStreamlitMarkdown: import("@emotion/styled").StyledComponent<{
    theme?: Theme | undefined;
    as?: import("react").ElementType<any> | undefined;
} & StyledStreamlitMarkdownProps, import("react").DetailedHTMLProps<import("react").HTMLAttributes<HTMLDivElement>, HTMLDivElement>, {}>;
export declare const StyledLinkIconContainer: import("@emotion/styled").StyledComponent<{
    theme?: Theme | undefined;
    as?: import("react").ElementType<any> | undefined;
}, import("react").DetailedHTMLProps<import("react").HTMLAttributes<HTMLDivElement>, HTMLDivElement>, {}>;
export declare const StyledLinkIcon: import("@emotion/styled").StyledComponent<{
    theme?: Theme | undefined;
    as?: import("react").ElementType<any> | undefined;
}, import("react").DetailedHTMLProps<import("react").AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>, {}>;
export declare const StyledHeaderContainer: import("@emotion/styled").StyledComponent<{
    theme?: Theme | undefined;
    as?: import("react").ElementType<any> | undefined;
}, import("react").DetailedHTMLProps<import("react").HTMLAttributes<HTMLDivElement>, HTMLDivElement>, {}>;
export declare const StyledHeaderContent: import("@emotion/styled").StyledComponent<{
    theme?: Theme | undefined;
    as?: import("react").ElementType<any> | undefined;
}, import("react").DetailedHTMLProps<import("react").HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>, {}>;
