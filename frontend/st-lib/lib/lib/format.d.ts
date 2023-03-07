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
 * Text formatting utilities
 */
import moment from "moment";
import "moment-duration-format";
declare class Duration {
    private readonly millis;
    constructor(millis: number);
    getTime(): number;
}
declare class Format {
    static nanosToDate(nanos: number): Date;
    static iso8601ContainsTimezone(iso: string): boolean;
    static iso8601ToMoment(iso: string): moment.Moment;
    static nanosToDuration(nanos: number): Duration;
    static dateToString(date: Date): string;
    static durationToString(duration: Duration): string;
}
/**
 * Formats the string nicely if it's a floating point, number, date or duration.
 */
declare function toFormattedString(x: any): string;
export { Duration, Format, toFormattedString };
