/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference path="../worker-configuration.d.ts" />

declare namespace App {
  interface Locals {
    sessionId: string | null;
    userId: string | null;
  }
}

declare module 'cloudflare:workers' {
  interface Env extends WorkerConfig.Env {
    AUTH_PEPPER: string;
    INTERNAL_API_SECRET: string;
    BUNGIE_API_KEY: string;
  }
}