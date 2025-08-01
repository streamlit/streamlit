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

import { useContext } from "react"

import { LibContext } from "~lib/components/core/LibContext"
import { getCrossOriginAttribute } from "~lib/util/UriUtil"

/**
 * Return the crossorigin attribute value for the given resourceCrossOriginMode and given url.
 *
 * Returns the configured resourceCrossOriginMode if the URL is a full URL (not just a path) and is equal to window.__streamlit.BACKEND_BASE_URL,
 * as it points to the same origin as the backend server or if the URL is relative and, thus, also points to the backend server.
 * Note that window.__streamlit.BACKEND_BASE_URL is used to configure the backend base URL when the Streamlit app origin is different from the backend server origin!
 * This can happen when the Streamlit app is loaded in an iframe or loaded via a proxy. In this case, the request to window.__streamlit?.BACKEND_BASE_URL is a
 * cross-origin request and the crossorigin attribute is required to avoid CORS errors.
 * If window.__streamlit.BACKEND_BASE_URL is set to the same origin as the Streamlit app origin, the request is a same-origin request and the crossorigin attribute is ignored by the browser so it can be omitted.
 *
 * Returns undefined if the URL is a full URL (not just a path) and is not equal to window.__streamlit.BACKEND_BASE_URL, as it
 * likely points to an external server in this case, where the crossOrigin attribute might lead to CORS errors depending on the external server configuration.
 *
 * If the URL is not a valid URL, e.g. it's relative, it returns the resourceCrossOriginMode if window.__streamlit.BACKEND_BASE_URL is set,
 * otherwise it returns undefined (in this case, the request would go against the window's origin and is a same-origin request anyways).
 */
export const useCrossOriginAttribute = (
  url?: string
): undefined | "anonymous" | "use-credentials" => {
  const { libConfig } = useContext(LibContext)
  return getCrossOriginAttribute(libConfig.resourceCrossOriginMode, url)
}
