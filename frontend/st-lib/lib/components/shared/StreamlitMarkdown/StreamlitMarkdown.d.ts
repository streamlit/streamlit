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
import React, { ReactElement, ReactNode, PureComponent, CSSProperties, HTMLProps, FunctionComponent } from "react";
import { Components, ReactMarkdownProps } from "react-markdown/lib/ast-to-react";
import { Heading as HeadingProto } from "src/autogen/proto";
import "katex/dist/katex.min.css";
export interface Props {
    /**
     * The Markdown formatted text to render.
     */
    source: string;
    /**
     * True if HTML is allowed in the source string. If this is false,
     * any HTML will be escaped in the output.
     */
    allowHTML: boolean;
    style?: CSSProperties;
    isCaption?: boolean;
    /**
     * Only allows italics, bold, strikethrough, and emojis in button/download button labels,
     * does not allow colored text
     */
    isButton?: boolean;
    /**
     * Only allows italics, bold, strikethrough, emojis, links, and code in widget/expander/tab labels
     */
    isLabel?: boolean;
    /**
     * Checkbox has larger label font sizing - same allowed elements as other widgets ^,
     * does not allow colored text
     */
    isCheckbox?: boolean;
    /**
     * Does not allow colored text
     */
    isExpander?: boolean;
    isTabs?: boolean;
}
/**
 * Creates a slug suitable for use as an anchor given a string.
 * Splits the string on non-alphanumeric characters, and joins with a dash.
 */
export declare function createAnchorFromText(text: string | null): string;
interface HeadingWithAnchorProps {
    tag: string;
    anchor?: string;
    children: ReactNode[] | ReactNode;
    tagProps?: HTMLProps<HTMLHeadingElement>;
}
export interface HeadingProtoProps {
    width: number;
    element: HeadingProto;
}
export declare const HeadingWithAnchor: FunctionComponent<HeadingWithAnchorProps>;
type HeadingProps = JSX.IntrinsicElements["h1"] & ReactMarkdownProps & {
    level: number;
    "data-anchor"?: string;
};
export declare const CustomHeading: FunctionComponent<HeadingProps>;
export interface RenderedMarkdownProps {
    /**
     * The Markdown formatted text to render.
     */
    source: string;
    /**
     * True if HTML is allowed in the source string. If this is false,
     * any HTML will be escaped in the output.
     */
    allowHTML: boolean;
    overrideComponents?: Components;
    /**
     * Only allows italics, bold, strikethrough, and emojis in button/download button labels,
     * does not allow colored text
     */
    isButton?: boolean;
    /**
     * Only allows italics, bold, strikethrough, emojis, links, and code in widget/expander/tab labels
     */
    isLabel?: boolean;
    /**
     * Does not allow colored text
     */
    isCheckbox?: boolean;
    isExpander?: boolean;
    isTabs?: boolean;
}
export declare function RenderedMarkdown({ allowHTML, source, overrideComponents, isLabel, isButton, isCheckbox, isExpander, isTabs, }: RenderedMarkdownProps): ReactElement;
/**
 * Wraps the <ReactMarkdown> component to include our standard
 * renderers and AST plugins (for syntax highlighting, HTML support, etc).
 */
declare class StreamlitMarkdown extends PureComponent<Props> {
    static contextType: React.Context<boolean>;
    componentDidCatch: () => void;
    render(): ReactNode;
}
interface LinkProps {
    node: any;
    children: ReactNode[];
    href?: string;
    title?: string;
    target?: string;
    rel?: string;
}
export declare function LinkWithTargetBlank(props: LinkProps): ReactElement;
export declare function Heading(props: HeadingProtoProps): ReactElement;
export default StreamlitMarkdown;
