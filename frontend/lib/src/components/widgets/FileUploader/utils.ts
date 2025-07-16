/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import { Accept } from "react-dropzone"

// Before we support official MIME types, using the custom "application/streamlit" as a wild card
// to allow file types defined in acceptedExtensions.
export const STREAMLIT_MIME_TYPE = "application/streamlit"

export function getAccept(acceptedExtensions: string[]): Accept | undefined {
  const accept: Accept = {}
  accept[STREAMLIT_MIME_TYPE] = acceptedExtensions

  return acceptedExtensions.length ? accept : undefined
}
