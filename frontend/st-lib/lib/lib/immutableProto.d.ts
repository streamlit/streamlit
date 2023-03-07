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
import { Map } from "immutable";
/**
 * Converts a protobuf JS object into its immutable counterpart.
 */
export declare function toImmutableProto(messageType: any, message: any): any;
/**
 * Applies a function based on the type of a protobuf oneof field.
 *
 * obj   - The immutable protobuf object we're applying this to.
 * name  - The name of the oneof field.
 * funcs - Dictionary of functions, one for each oneof field. Optionally, you
 * may pass a key-value pair {'_else': errorFunc} to handle the case where there
 * is no match. If such a function is not passed, we throw an error if there's
 * no match.
 */
export declare function dispatchOneOf(obj: Map<string, any>, name: string, funcs: any): any;
/**
 * Updates a oneof field of an immutable protobuf based on its type.
 *
 * obj   - The immutable protobuf object we're applying this to.
 * name  - The name of the oneof field.
 * funcs - Dictionary of update functions, one for each oneof field.
 */
export declare function updateOneOf(obj: Map<string, any>, name: string, funcs: any): any;
/**
 * Returns a value based on the type of a protobuf oneof field.
 *
 * obj   - The immutable protobuf object we're applying this to.
 * name  - The name of the oneof field.
 * values - Dictionary of values, one for each oneof field.
 */
export declare function mapOneOf(obj: Map<string, any>, name: string, values: any): any;
