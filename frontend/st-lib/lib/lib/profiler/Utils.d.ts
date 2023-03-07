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
import { HandleMessageEvent, PerformanceEvent } from "src/lib/profiler/PerformanceEvents";
export type EventPredicate = (event: PerformanceEvent) => boolean;
export declare function findNextEventIndex(events: PerformanceEvent[], startEvent: PerformanceEvent | number, pred: EventPredicate): number | undefined;
export declare function findNextEvent(events: PerformanceEvent[], startEvent: PerformanceEvent | number, pred: EventPredicate): PerformanceEvent | undefined;
export declare function findPrevEventIndex(events: PerformanceEvent[], startEvent: PerformanceEvent | number, pred: EventPredicate): number | undefined;
export declare function findPrevEvent(events: PerformanceEvent[], startEvent: PerformanceEvent | number, pred: EventPredicate): PerformanceEvent | undefined;
export declare function isHandleMessageEvent(event: PerformanceEvent): event is HandleMessageEvent;
/** Return the elapsed time between two performance events. */
export declare function getTimeDelta(a: PerformanceEvent, b: PerformanceEvent): number;
