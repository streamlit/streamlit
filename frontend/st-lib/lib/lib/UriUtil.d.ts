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
/**
 * host:port tuple
 */
export interface BaseUriParts {
    host: string;
    port: number;
    basePath: string;
}
/**
 * Return the BaseUriParts for the global window
 */
export declare function getWindowBaseUriParts(): BaseUriParts;
export declare function getPossibleBaseUris(): Array<BaseUriParts>;
/**
 * Create a ws:// or wss:// URI for the given path.
 */
export declare function buildWsUri({ host, port, basePath }: BaseUriParts, path: string): string;
/**
 * Create an HTTP URI for the given path.
 */
export declare function buildHttpUri({ host, port, basePath }: BaseUriParts, path: string): string;
/**
 * Run SVG strings through DOMPurify to prevent Javascript execution
 */
export declare function xssSanitizeSvg(uri: string): string;
/**
 * If this is a relative URI, assume it's being served from streamlit and
 * construct it appropriately.  Otherwise leave it alone.
 */
export declare function buildMediaUri(uri: string, baseUriParts?: BaseUriParts): string;
/**
 * Check if the given origin follows the allowed origin pattern, which could
 * include wildcards.
 *
 * This function is used to check whether cross-origin messages received by the
 * withHostCommunication component come from an origin that we've listed as
 * trusted. If this function returns false against the origin being tested for
 * all trusted origins in our whitelist, the cross-origin message should be
 * ignored.
 */
export declare function isValidOrigin(allowedOrigin: string, testOrigin: string): boolean;
