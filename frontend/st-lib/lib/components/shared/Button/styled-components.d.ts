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
import { MouseEvent, ReactNode } from "react";
export declare enum Kind {
    PRIMARY = "primary",
    SECONDARY = "secondary",
    TERTIARY = "tertiary",
    LINK = "link",
    ICON = "icon",
    BORDERLESS_ICON = "borderlessIcon",
    MINIMAL = "minimal",
    PRIMARY_FORM_SUBMIT = "primaryFormSubmit",
    SECONDARY_FORM_SUBMIT = "secondaryFormSubmit",
    HEADER_BUTTON = "header"
}
export declare enum Size {
    XSMALL = "xsmall",
    SMALL = "small",
    MEDIUM = "medium",
    LARGE = "large"
}
export interface ButtonProps {
    kind: Kind;
    size?: Size;
    onClick?: (event: MouseEvent<HTMLButtonElement>) => any;
    disabled?: boolean;
    fluidWidth?: boolean;
    children: ReactNode;
    autoFocus?: boolean;
}
export declare const StyledBaseButton: import("@emotion/styled").StyledComponent<{
    theme?: import("@emotion/react").Theme | undefined;
    as?: import("react").ElementType<any> | undefined;
} & Required<ButtonProps>, import("react").DetailedHTMLProps<import("react").ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>, {}>;
export declare const StyledPrimaryButton: import("@emotion/styled").StyledComponent<{
    theme?: import("@emotion/react").Theme | undefined;
    as?: import("react").ElementType<any> | undefined;
} & Required<ButtonProps> & import("react").ClassAttributes<HTMLButtonElement> & import("react").ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: ReactNode;
} & {
    theme?: import("@emotion/react").Theme | undefined;
} & Required<ButtonProps>, {}, {}>;
export declare const StyledSecondaryButton: import("@emotion/styled").StyledComponent<{
    theme?: import("@emotion/react").Theme | undefined;
    as?: import("react").ElementType<any> | undefined;
} & Required<ButtonProps> & import("react").ClassAttributes<HTMLButtonElement> & import("react").ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: ReactNode;
} & {
    theme?: import("@emotion/react").Theme | undefined;
} & Required<ButtonProps>, {}, {}>;
export declare const StyledTertiaryButton: import("@emotion/styled").StyledComponent<{
    theme?: import("@emotion/react").Theme | undefined;
    as?: import("react").ElementType<any> | undefined;
} & Required<ButtonProps> & import("react").ClassAttributes<HTMLButtonElement> & import("react").ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: ReactNode;
} & {
    theme?: import("@emotion/react").Theme | undefined;
} & Required<ButtonProps>, {}, {}>;
export declare const StyledLinkButton: import("@emotion/styled").StyledComponent<{
    theme?: import("@emotion/react").Theme | undefined;
    as?: import("react").ElementType<any> | undefined;
} & Required<ButtonProps> & import("react").ClassAttributes<HTMLButtonElement> & import("react").ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: ReactNode;
} & {
    theme?: import("@emotion/react").Theme | undefined;
} & Required<ButtonProps>, {}, {}>;
export declare const StyledMinimalButton: import("@emotion/styled").StyledComponent<{
    theme?: import("@emotion/react").Theme | undefined;
    as?: import("react").ElementType<any> | undefined;
} & Required<ButtonProps> & import("react").ClassAttributes<HTMLButtonElement> & import("react").ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: ReactNode;
} & {
    theme?: import("@emotion/react").Theme | undefined;
} & Required<ButtonProps>, {}, {}>;
export declare const StyledPrimaryFormSubmitButton: import("@emotion/styled").StyledComponent<{
    theme?: import("@emotion/react").Theme | undefined;
    as?: import("react").ElementType<any> | undefined;
} & Required<ButtonProps> & import("react").ClassAttributes<HTMLButtonElement> & import("react").ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: ReactNode;
} & {
    theme?: import("@emotion/react").Theme | undefined;
} & Required<ButtonProps>, {}, {}>;
export declare const StyledSecondaryFormSubmitButton: import("@emotion/styled").StyledComponent<{
    theme?: import("@emotion/react").Theme | undefined;
    as?: import("react").ElementType<any> | undefined;
} & Required<ButtonProps> & import("react").ClassAttributes<HTMLButtonElement> & import("react").ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: ReactNode;
} & {
    theme?: import("@emotion/react").Theme | undefined;
} & Required<ButtonProps>, {}, {}>;
export declare const StyledIconButton: import("@emotion/styled").StyledComponent<{
    theme?: import("@emotion/react").Theme | undefined;
    as?: import("react").ElementType<any> | undefined;
} & Required<ButtonProps> & import("react").ClassAttributes<HTMLButtonElement> & import("react").ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: ReactNode;
} & {
    theme?: import("@emotion/react").Theme | undefined;
} & Required<ButtonProps>, {}, {}>;
export declare const StyledHeaderButton: import("@emotion/styled").StyledComponent<{
    theme?: import("@emotion/react").Theme | undefined;
    as?: import("react").ElementType<any> | undefined;
} & Required<ButtonProps> & import("react").ClassAttributes<HTMLButtonElement> & import("react").ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: ReactNode;
} & {
    theme?: import("@emotion/react").Theme | undefined;
} & Required<ButtonProps>, {}, {}>;
export declare const StyledBorderlessIconButton: import("@emotion/styled").StyledComponent<{
    theme?: import("@emotion/react").Theme | undefined;
    as?: import("react").ElementType<any> | undefined;
} & Required<ButtonProps> & import("react").ClassAttributes<HTMLButtonElement> & import("react").ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: ReactNode;
} & {
    theme?: import("@emotion/react").Theme | undefined;
} & Required<ButtonProps>, {}, {}>;
export declare const StyledTooltipNormal: import("@emotion/styled").StyledComponent<{
    theme?: import("@emotion/react").Theme | undefined;
    as?: import("react").ElementType<any> | undefined;
}, import("react").DetailedHTMLProps<import("react").HTMLAttributes<HTMLDivElement>, HTMLDivElement>, {}>;
export declare const StyledTooltipMobile: import("@emotion/styled").StyledComponent<{
    theme?: import("@emotion/react").Theme | undefined;
    as?: import("react").ElementType<any> | undefined;
}, import("react").DetailedHTMLProps<import("react").HTMLAttributes<HTMLDivElement>, HTMLDivElement>, {}>;
