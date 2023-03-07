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
import { ComponentMessageType } from "./enums";
export type ComponentMessageListener = (type: ComponentMessageType, data: any) => void;
/**
 * Dispatches iframe messages to ComponentInstances.
 */
export declare class ComponentRegistry {
    private readonly getServerUri;
    private readonly msgListeners;
    private cachedServerUri?;
    constructor(getServerUri: () => BaseUriParts | undefined);
    /**
     * Register a listener for component messages dispatched by the given source.
     */
    registerListener: (source: MessageEventSource, listener: ComponentMessageListener) => void;
    deregisterListener: (source: MessageEventSource) => void;
    getComponentURL: (componentName: string, path: string) => string;
    private onMessageEvent;
}
