"use client";

import { type FormEvent, useState } from "react";

import { AppsScriptClient } from "@/lib/api/apps-script-client";
import { ApiError } from "@/lib/api/api-error";
import { AdminSessionStore } from "@/lib/admin/admin-session-store";
import { getClientConfig } from "@/lib/config/client-env";
import { AdminLoginResultSchema, type AdminLoginResult } from "@/shared/contracts";

import styles from "./admin.module.css";

type AdminLoginServices = {
  login: (password: string) => Promise<AdminLoginResult>;
  store: Pick<AdminSessionStore, "set">;
  navigate: (path: string) => void;
};

function browserServices(): AdminLoginServices {
  const client = new AppsScriptClient(getClientConfig().appsScriptUrl);
  return {
    login: (password) => client.request("admin.login", { password }, AdminLoginResultSchema),
    store: new AdminSessionStore(),
    navigate: (path) => window.location.assign(path),
  };
}

export function AdminLoginForm({ services }: { services?: AdminLoginServices }) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage("");
    try {
      const activeServices = services ?? browserServices();
      const session = await activeServices.login(password);
      activeServices.store.set(session);
      setPassword("");
      activeServices.navigate("/admin/skins");
    } catch (error) {
      setMessage(error instanceof ApiError
        ? error.message
        : "네트워크 연결을 확인해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.card} onSubmit={submit}>
      <h2>관리자 로그인</h2>
      <p>스킨을 등록하고 활성화할 수 있어요.</p>
      <label className={styles.field}>
        <span>관리자 비밀번호</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          minLength={8}
          required
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {message && <p role="alert" className={styles.error}>{message}</p>}
      {submitting && <p aria-live="polite">로그인하고 있어요.</p>}
      <button className={styles.primary} type="submit" disabled={submitting}>
        {submitting ? "로그인 중" : "로그인"}
      </button>
    </form>
  );
}
