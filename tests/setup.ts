import { mock } from "bun:test";

// `server-only` throws outside a Next.js server bundle; tests run server code directly.
mock.module("server-only", () => ({}));

process.env.SESSION_SECRET ??= "test-secret-test-secret-test-secret-1234";
process.env.ENCRYPTION_KEY ??= "00".repeat(32);
process.env.APP_URL = "https://app.example.com";
