/* eslint-disable global-require */
import axios, { AxiosResponse } from "axios";
import URI from "urijs";

// eslint-disable-next-line prefer-import/prefer-import-over-require 
export const version = require("../../package.json").version;

export interface ServerTime {
  serverTime: number;
  localTimeRecorded: number;
}

/**
 * keep a local map of server times
 * (export this purely for testing purposes)
 *
 * each entry will map the server domain to the last-known time and the local
 * time it was recorded, ex:
 *
 *     "horizon-testnet.stellar.org": {
 *       serverTime: 1552513039,
 *       localTimeRecorded: 1552513052
 *     }
 */
export const SERVER_TIME_MAP: Record<string, ServerTime> = {};

export const AxiosClient = axios.create({
  headers: {
    "X-Client-Name": "js-stellar-sdk",
    "X-Client-Version": version,
  },
});

function toSeconds(ms: number): number {
  return Math.floor(ms / 1000);
}

AxiosClient.interceptors.response.use(
  (response: AxiosResponse) => {
    const hostname = URI(response.config.url!).hostname();
    const serverTime = toSeconds(Date.parse(response.headers.date));
    const localTimeRecorded = toSeconds(new Date().getTime());

    if (!Number.isNaN(serverTime)) {
      SERVER_TIME_MAP[hostname] = {
        serverTime,
        localTimeRecorded,
      };
    }

    return response;
  },
);

export default AxiosClient;

/**
 * Given a hostname, get the current time of that server (i.e., use the last-
 * recorded server time and offset it by the time since then.) If there IS no
 * recorded server time, or it's been 5 minutes since the last, return null.
 * @param {string} hostname Hostname of a Horizon server.
 * @returns {number} The UNIX timestamp (in seconds, not milliseconds)
 * representing the current time on that server, or `null` if we don't have
 * a record of that time.
 */
export function getCurrentServerTime(hostname: string): number | null {
  const entry = SERVER_TIME_MAP[hostname];

  if (!entry || !entry.localTimeRecorded || !entry.serverTime) {
    return null;
  }

  const { serverTime, localTimeRecorded } = entry;
  const currentTime = toSeconds(new Date().getTime());

  // if it's been more than 5 minutes from the last time, then null it out
  if (currentTime - localTimeRecorded > 60 * 5) {
    return null;
  }

  return currentTime - localTimeRecorded + serverTime;
}
