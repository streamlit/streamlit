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
export declare class MapboxTokenNotProvidedError extends Error {
}
export declare class MapboxTokenFetchingError extends Error {
}
/**
 * A remote file that stores user-visible tokens.
 */
export declare const TOKENS_URL = "https://data.streamlit.io/tokens.json";
export declare class MapboxToken {
    static token?: string;
    static commandLine?: string;
    private static isRunningLocal;
    /**
     * Expose a singleton MapboxToken:
     * - If the user specified a token in their streamlit config, return it.
     * - Else, fetch the remote "tokens.json" and return the "mapbox" entry.
     *
     * (The returned value is cached in memory, so the remote resource will
     * only be fetched once per session.)
     */
    static get(): Promise<string>;
    private static fetchToken;
}
