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
import { ScriptRunState } from "src/lib/ScriptRunState";
interface PerformanceEventBase {
    timestamp?: number;
}
export interface RequestedRerunEvent extends PerformanceEventBase {
    name: "RequestedRerun";
    scriptRunState: ScriptRunState;
}
export interface BeginHandleMessageEvent extends PerformanceEventBase {
    name: "BeginHandleMessage";
    messageIndex: number;
}
export interface DecodedMessageEvent extends PerformanceEventBase {
    name: "DecodedMessage";
    messageIndex: number;
    messageType?: string;
    len: number;
}
export interface GotCachedPayloadEvent extends PerformanceEventBase {
    name: "GotCachedPayload";
    messageIndex: number;
}
export interface DispatchedMessageEvent extends PerformanceEventBase {
    name: "DispatchedMessage";
    messageIndex: number;
    messageType?: string;
}
export type HandleMessageEvent = BeginHandleMessageEvent | DecodedMessageEvent | GotCachedPayloadEvent | DispatchedMessageEvent;
export type PerformanceEvent = RequestedRerunEvent | HandleMessageEvent;
/** Simple utility for capturing time samples. */
export declare class PerformanceEvents {
    /** Set this to true to capture PerformanceEvents. */
    static enabled: boolean;
    private static events;
    static record(event: PerformanceEvent): void;
}
export {};
