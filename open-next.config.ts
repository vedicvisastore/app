// Cloudflare Workers deployment (free plan). Every page is rendered per request, so no ISR cache is configured.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
