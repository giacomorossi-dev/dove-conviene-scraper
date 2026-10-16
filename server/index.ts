import { createApp } from "./app";
import { initCatalog } from "./catalog-store";

await initCatalog();

const PORT = 3000;
/**
 * Only this computer by default: the API can start a long crawl of dc from
 * this IP. Set HOST (e.g. 0.0.0.0) to reach it from other devices on purpose.
 */
const HOST = process.env.HOST ?? "127.0.0.1";
createApp().listen(PORT, HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
});
