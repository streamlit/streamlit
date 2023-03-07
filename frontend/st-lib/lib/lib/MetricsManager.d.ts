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
import { DeployedAppMetadata } from "src/hocs/withHostCommunication/types";
/**
 * A mapping of [delta type] -> [count] which is used to upload delta stats
 * when the app is idle.
 */
interface DeltaCounter {
    [name: string]: number;
}
/**
 * A mapping of [component instance name] -> [count] which is used to upload
 * custom component stats when the app is idle.
 */
interface CustomComponentCounter {
    [name: string]: number;
}
export declare class MetricsManager {
    private initialized;
    /**
     * Whether to send metrics to the server.
     */
    private actuallySendMetrics;
    /**
     * Queue of metrics events that were enqueued before this MetricsManager was
     * initialized.
     */
    private pendingEvents;
    /**
     * Object used to count the number of delta types seen in a given script run.
     * Maps type of delta (string) to count (number).
     */
    private pendingDeltaCounter;
    /**
     * Object used to count the number of custom instance names seen in a given
     * script run. Maps type of custom instance name (string) to count (number).
     */
    private pendingCustomComponentCounter;
    /**
     * App hash uniquely identifies "projects" so we can tell
     * how many projects are being created with Streamlit while still keeping
     * possibly-sensitive info like the mainScriptPath outside of our metrics
     * services.
     */
    private appHash;
    private metadata;
    /**
     * Singleton MetricsManager object. The reason we're using a singleton here
     * instead of just exporting a module-level instance is so we can easily
     * override it in tests.
     */
    static current: MetricsManager;
    initialize({ gatherUsageStats, }: {
        gatherUsageStats: boolean;
    }): void;
    enqueue(evName: string, evData?: Record<string, any>): void;
    clearDeltaCounter(): void;
    incrementDeltaCounter(deltaType: string): void;
    getAndResetDeltaCounter(): DeltaCounter;
    clearCustomComponentCounter(): void;
    incrementCustomComponentCounter(customInstanceName: string): void;
    getAndResetCustomComponentCounter(): CustomComponentCounter;
    setAppHash: (appHash: string) => void;
    private send;
    private sendPendingEvents;
    private identify;
    private track;
    private static getInstallationData;
    setMetadata(metadata: DeployedAppMetadata): void;
    private getHostTrackingData;
}
export {};
