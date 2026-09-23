"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { LoadingIndicator } from "@/components/loading-indicator";
import { AppsScriptClient } from "@/lib/api/apps-script-client";
import { ApiError } from "@/lib/api/api-error";
import { AdminSessionStore } from "@/lib/admin/admin-session-store";
import { getClientConfig } from "@/lib/config/client-env";
import {
  AdminDashboardResultSchema,
  ChallengeSchema,
  type AdminChallengeSaveInput,
  type AdminDashboardResult,
  type Challenge,
} from "@/shared/contracts";

import { ChallengeSettingsForm } from "./challenge-settings-form";
import { ChallengeQr } from "./challenge-qr";
import { DashboardSummary } from "./dashboard-summary";
import { StudentParticipationTable } from "./student-participation-table";
import styles from "./teacher-dashboard.module.css";

export type TeacherDashboardServices = {
  getToken: () => string | null;
  loadDashboard: (token: string, challengeId: string) => Promise<AdminDashboardResult>;
  saveChallenge: (token: string, input: AdminChallengeSaveInput) => Promise<Challenge>;
  navigate: (path: string) => void;
};

function browserServices(): TeacherDashboardServices {
  const client = new AppsScriptClient(getClientConfig().appsScriptUrl);
  return {
    getToken: () => new AdminSessionStore().get()?.adminToken ?? null,
    loadDashboard: (token, challengeId) => client.request(
      "admin.dashboard.get", { challengeId }, AdminDashboardResultSchema, { adminToken: token },
    ),
    saveChallenge: (token, input) => client.request(
      "admin.challenge.save", input, ChallengeSchema, { adminToken: token },
    ),
    navigate: (path) => window.location.assign(path),
  };
}

export function TeacherDashboard({ challengeId, services }: { challengeId: string; services?: TeacherDashboardServices }) {
  const activeServices = useMemo(() => services ?? browserServices(), [services]);
  const [dashboard, setDashboard] = useState<AdminDashboardResult | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const token = activeServices.getToken();
    if (!token) {
      activeServices.navigate("/admin?returnTo=/admin/dashboard");
      return;
    }
    void activeServices.loadDashboard(token, challengeId).then((result) => {
      if (active) setDashboard(result);
    }).catch((caught) => {
      if (!active) return;
      if (caught instanceof ApiError && caught.code === "ADMIN_SESSION_EXPIRED") {
        activeServices.navigate("/admin?returnTo=/admin/dashboard");
      } else {
        setError("교사 대시보드를 불러오지 못했어요.");
      }
    });
    return () => { active = false; };
  }, [activeServices, challengeId]);

  async function saveChallenge(input: AdminChallengeSaveInput) {
    const token = activeServices.getToken();
    if (!token) {
      activeServices.navigate("/admin?returnTo=/admin/dashboard");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await activeServices.saveChallenge(token, input);
      const refreshed = await activeServices.loadDashboard(token, challengeId);
      setDashboard(refreshed);
      setMessage("챌린지 설정을 저장했어요.");
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === "ADMIN_SESSION_EXPIRED") {
        activeServices.navigate("/admin?returnTo=/admin/dashboard");
      } else {
        setError(caught instanceof ApiError ? caught.message : "챌린지 설정을 저장하지 못했어요.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (error && !dashboard) return <main className={styles.shell}><p role="alert" className={styles.error}>{error}</p></main>;
  if (!dashboard) return <main className={styles.loading}><LoadingIndicator label="교사 대시보드를 불러오고 있어요." /></main>;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>양치왕 교사 모드</p><h1>{dashboard.challenge.name}</h1></div>
        <Link className={styles.secondaryButton} href="/admin/skins">AR 스킨 관리</Link>
      </header>
      <DashboardSummary summary={dashboard.summary} />
      {message && <p role="status" className={styles.success}>{message}</p>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <ChallengeSettingsForm
        key={`${dashboard.challenge.challengeId}-${dashboard.challenge.name}-${dashboard.challenge.startDate}-${dashboard.challenge.endDate}-${dashboard.challenge.targetDays}-${dashboard.challenge.durationMode}`}
        challenge={dashboard.challenge}
        saving={saving}
        onSave={(input) => void saveChallenge(input)}
      />
      <ChallengeQr challengeId={dashboard.challenge.challengeId} />
      <StudentParticipationTable students={dashboard.students} />
    </main>
  );
}
