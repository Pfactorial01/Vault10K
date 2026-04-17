import { config } from "../config.js";

let lastSecRequest = 0;

export async function secFetch(url: string): Promise<Response> {
  const now = Date.now();
  const wait = config.secSleepMs - (now - lastSecRequest);
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastSecRequest = Date.now();
  return fetch(url, {
    headers: {
      "User-Agent": config.secUserAgent,
      Accept: "application/json,text/plain,*/*",
    },
  });
}
