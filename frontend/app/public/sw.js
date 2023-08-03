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
 * Triggered when the service worker is installed.
 */
self.addEventListener("install", _event => {})

/**
 * Triggered after the service worker has been installed.
 * Use it to perform any one-time tasks.
 */
self.addEventListener("activate", _event => {})

/**
 * Triggered when the service worker receives a message from the controlled page.
 * Use it to communicate between the service worker and the page.
 */
self.addEventListener("message", _event => {})

/**
 * Triggered whenever a network request is made by the controlled page.
 */
self.addEventListener("fetch", _event => {})
