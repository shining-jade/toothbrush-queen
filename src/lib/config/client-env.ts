import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APPS_SCRIPT_URL: z.string().url().startsWith("https://"),
});

export function getClientConfig(
  env?: Record<string, string | undefined>,
) {
  const parsed = clientEnvSchema.parse(
    env ?? {
      NEXT_PUBLIC_APPS_SCRIPT_URL: process.env.NEXT_PUBLIC_APPS_SCRIPT_URL,
    },
  );
  return { appsScriptUrl: parsed.NEXT_PUBLIC_APPS_SCRIPT_URL };
}
