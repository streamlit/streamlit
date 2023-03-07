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
import { CustomThemeConfig } from "src/autogen/proto";
export declare const toMinimalToml: (themeInput: Partial<CustomThemeConfig>) => string;
export interface Props {
    backToSettings: (animateModal: boolean) => void;
    onClose: () => void;
}
declare const ThemeCreatorDialog: (props: Props) => ReactElement;
export default ThemeCreatorDialog;
