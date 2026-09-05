/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference path="../worker-configuration.d.ts" />

declare namespace App {
  interface Locals {
    sessionId: string | null;
    userId: string | null;
  }
}

declare namespace Cloudflare {
  interface Env {
    AUTH_PEPPER: string;
    INTERNAL_API_SECRET: string;
    BUNGIE_API_KEY: string;
    TMDB_API_KEY?: string;
  }
}
