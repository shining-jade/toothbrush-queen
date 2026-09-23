import { z } from "zod";

import { ApiResponseSchema } from "@/shared/contracts";

import { ApiError } from "./api-error";

type RequestOptions = {
  deviceToken?: string;
};

export class AppsScriptClient {
  constructor(private readonly endpoint: string) {}

  async request<T>(
    action: string,
    payload: unknown,
    responseSchema: z.ZodType<T>,
    options: RequestOptions = {},
  ): Promise<T> {
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action,
          auth: options.deviceToken
            ? { deviceToken: options.deviceToken }
            : undefined,
          payload,
        }),
      });

      if (!response.ok) {
        throw new ApiError(
          "NETWORK_UNAVAILABLE",
          "네트워크 연결을 확인해 주세요.",
        );
      }

      const envelope = ApiResponseSchema.safeParse(await response.json());
      if (!envelope.success) {
        throw new ApiError(
          "INVALID_RESPONSE",
          "서버 응답을 확인할 수 없습니다.",
        );
      }

      if (!envelope.data.ok) {
        throw new ApiError(
          envelope.data.error.code,
          envelope.data.error.message,
        );
      }

      const parsed = responseSchema.safeParse(envelope.data.data);
      if (!parsed.success) {
        throw new ApiError(
          "INVALID_RESPONSE",
          "서버 응답을 확인할 수 없습니다.",
        );
      }

      return parsed.data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(
        "NETWORK_UNAVAILABLE",
        "네트워크 연결을 확인해 주세요.",
      );
    }
  }
}
