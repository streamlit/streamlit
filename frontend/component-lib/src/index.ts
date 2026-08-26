/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

// Workaround for type-only exports:
// https://stackoverflow.com/questions/53728230/cannot-re-export-a-type-when-using-the-isolatedmodules-with-ts-3-2-2
import { RenderData as RenderData_, Theme as Theme_ } from "./streamlit"
import { ComponentProps as ComponentProps_ } from "./StreamlitReact"

export { ArrowTable } from "./ArrowTable"
export {
  StreamlitComponentBase,
  withStreamlitConnection,
} from "./StreamlitReact"
export { Streamlit } from "./streamlit"
export type ComponentProps = ComponentProps_
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Use `any` to maintain existing library semantics for implicit component args typing.
export type RenderData<ArgType = any> = RenderData_<ArgType>
export type Theme = Theme_
