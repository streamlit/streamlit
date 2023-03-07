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
 * A wrapper around setTimeout that adds some useful features, like getting the
 * remaining time.
 */
export declare class Timer {
    private timerHandle?;
    private duration;
    private startTime;
    private running;
    /** True if the timer is currently running */
    get isRunning(): boolean;
    /** Remaining time before timeout, or 0 if the timer is not running */
    get remainingTime(): number;
    /**
     * Starts the Timer with the given callback.
     * If the Timer is already running, it will be canceled first.
     */
    setTimeout(handler: () => void, time: number): void;
    /** Cancels the Timer. If the Timer is not already running, this is a no-op. */
    cancel(): void;
}
