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
import { Placement } from "src/components/shared/Tooltip";
import { StreamlitMarkdownProps } from "src/components/shared/StreamlitMarkdown";
export interface TooltipIconProps {
    placement?: Placement;
    iconSize?: string;
    content: string;
    children?: ReactNode;
    markdownProps?: Partial<StreamlitMarkdownProps>;
}
declare function TooltipIcon({ placement, iconSize, content, children, markdownProps, }: TooltipIconProps): ReactElement;
export default TooltipIcon;
