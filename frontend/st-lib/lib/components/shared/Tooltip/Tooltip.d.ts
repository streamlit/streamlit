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
import React, { ReactElement, ReactNode } from "react";
export declare enum Placement {
    AUTO = "auto",
    TOP_LEFT = "topLeft",
    TOP = "top",
    TOP_RIGHT = "topRight",
    RIGHT_TOP = "rightTop",
    RIGHT = "right",
    RIGHT_BOTTOM = "rightBottom",
    BOTTOM_RIGHT = "bottomRight",
    BOTTOM = "bottom",
    BOTTOM_LEFT = "bottomLeft",
    LEFT_BOTTOM = "leftBottom",
    LEFT = "left",
    LEFT_TOP = "leftTop"
}
export interface TooltipProps {
    content: ReactNode;
    placement: Placement;
    children: ReactNode;
    inline?: boolean;
    style?: React.CSSProperties;
}
declare function Tooltip({ content, placement, children, inline, style, }: TooltipProps): ReactElement;
export default Tooltip;
