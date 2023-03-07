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
import { BaseUriParts } from "src/lib/UriUtil";
/**
 * Set the provided url/emoji as the page favicon.
 *
 * @param {string} favicon may be an image url, or an emoji like 🍕 or :pizza:
 * @param {function} callback
 */
export declare function handleFavicon(favicon: string, baseUriParts?: BaseUriParts): void;
