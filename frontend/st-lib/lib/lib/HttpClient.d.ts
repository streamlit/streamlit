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
import { AxiosRequestConfig, AxiosResponse } from "axios";
import { BaseUriParts } from "src/lib/UriUtil";
/**
 * Base class for HTTP Clients
 */
export default class HttpClient {
    protected readonly getServerUri: () => BaseUriParts | undefined;
    protected readonly csrfEnabled: boolean;
    constructor(getServerUri: () => BaseUriParts | undefined, csrfEnabled: boolean);
    /**
     * Wrapper around axios.request to update the request config with
     * CSRF headers if client has CSRF protection enabled.
     */
    request<T = any, R = AxiosResponse<T>>(url: string, params: AxiosRequestConfig): Promise<R>;
}
