import axios, { AxiosError } from "axios";
import { config } from "../config";
import { Logger } from "./logger";

class DiskCache {
    async set(key: string, value: unknown): Promise<boolean> {
        if (!config.diskCacheURL) return false;

        try {
            const result = await axios.post(`${config.diskCacheURL}/api/v1/item`, {
                key,
                value
            });

            return result.status === 200;
        } catch (err) {
            const response = (err as AxiosError).response;
            if (!response || response.status !== 404) {
                Logger.error(`DiskCache: Error setting key ${key}: ${err}`);
            }

            return false;
        }
    }

    async get(key: string): Promise<unknown> {
        if (!config.diskCacheURL) return null;

        try {
            const result = await axios.get(`${config.diskCacheURL}/api/v1/item?key=${key}`, { timeout: 500 });

            return result.status === 200 ? result.data : null;
        } catch (err) {
            const response = (err as AxiosError).response;
            if (!response || response.status !== 404) {
                Logger.error(`DiskCache: Error getting key ${key}: ${err}`);
            }

            return null;
        }
    }
}

const diskCache = new DiskCache();
export default diskCache;