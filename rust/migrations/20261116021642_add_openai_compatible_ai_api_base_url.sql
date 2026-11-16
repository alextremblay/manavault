-- Add the base URL for self-hosted OpenAI-compatible inference APIs.

ALTER TABLE "ai_settings" ADD COLUMN "api_base_url" TEXT;
