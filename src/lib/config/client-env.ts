import { z } from "zod";

const clientEnvSchema = z.object({
  NEXT_PUBLIC_APPS_SCRIPT_URL: z.string().url().startsWith("https://"),
});

export function getClientConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const parsed = clientEnvSchema.parse(env);
  return { appsScriptUrl: parsed.NEXT_PUBLIC_APPS_SCRIPT_URL };
}
