"use client";

import { type ChangeEvent, type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { AdminSessionStore } from "@/lib/admin/admin-session-store";
import { ApiError } from "@/lib/api/api-error";
import { AppsScriptClient } from "@/lib/api/apps-script-client";
import { getClientConfig } from "@/lib/config/client-env";
import {
  AdminAssetUploadResultSchema,
  AdminSkinListResultSchema,
  AdminSkinDraftSchema,
  AdminSkinSchema,
  type AdminAssetUploadResult,
  type AdminSkin,
  type AdminSkinDraft,
} from "@/shared/contracts";

import { validateAdminSkinFile, type ValidatedBrowserFile } from "./file-validation";
import { DEFAULT_CALIBRATION, type SkinCalibration } from "./skin-calibration";
import { SkinList } from "./skin-list";
import { SkinPreview } from "./skin-preview";
import styles from "./skin-upload.module.css";

const DRAFT_KEY = "brush-king:admin-skin-draft";
const subscribeToHydration = () => () => undefined;
const clientHydrated = () => true;
const serverHydrated = () => false;
const SavedSkinDraftSchema = AdminSkinDraftSchema
  .omit({ assetId: true, enabled: true, skinId: true })
  .extend({ enabled: z.boolean().optional() });
type SavedSkinDraft = z.infer<typeof SavedSkinDraftSchema>;

export type SkinEditorServices = {
  getToken: () => string | null;
  validateFile: (file: File) => Promise<ValidatedBrowserFile>;
  uploadAsset: (token: string, file: ValidatedBrowserFile, name: string) => Promise<AdminAssetUploadResult>;
  saveSkin: (token: string, draft: AdminSkinDraft) => Promise<unknown>;
  listSkins: (token: string) => Promise<AdminSkin[]>;
  setEnabled: (token: string, skinId: string, enabled: boolean) => Promise<unknown>;
  expireSession: (draft: SavedSkinDraft) => void;
  restoreDraft?: () => SavedSkinDraft | null;
};

function browserServices(navigate: (path: string) => void): SkinEditorServices {
  let sessionStore: AdminSessionStore | undefined;
  let client: AppsScriptClient | undefined;
  const getSessionStore = () => sessionStore ??= new AdminSessionStore();
  const getClient = () => client ??= new AppsScriptClient(getClientConfig().appsScriptUrl);
  return {
    getToken: () => getSessionStore().get()?.adminToken ?? null,
    validateFile: validateAdminSkinFile,
    uploadAsset: (token, file, name) => getClient().request("admin.asset.upload", {
      name, fileName: file.fileName, mimeType: file.mimeType, byteSize: file.byteSize, base64: file.base64,
    }, AdminAssetUploadResultSchema, { adminToken: token }),
    saveSkin: (token, draft) => getClient().request("admin.skin.save", draft, AdminSkinSchema, { adminToken: token }),
    listSkins: (token) => getClient().request("admin.skin.list", {}, AdminSkinListResultSchema, { adminToken: token }),
    setEnabled: (token, skinId, enabled) => getClient().request("admin.skin.setEnabled", { skinId, enabled }, AdminSkinSchema, { adminToken: token }),
    restoreDraft: () => {
      try {
        const raw = sessionStorage.getItem(DRAFT_KEY);
        sessionStorage.removeItem(DRAFT_KEY);
        return raw ? SavedSkinDraftSchema.parse(JSON.parse(raw)) : null;
      } catch {
        sessionStorage.removeItem(DRAFT_KEY);
        return null;
      }
    },
    expireSession: (draft) => {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      getSessionStore().clear();
      navigate("/admin?returnTo=/admin/skins");
    },
  };
}

const sliders = [
  { key: "anchorX", label: "좌우 위치", min: -1, max: 1, step: 0.01 },
  { key: "anchorY", label: "상하 위치", min: -1, max: 1, step: 0.01 },
  { key: "scale", label: "크기", min: 0.2, max: 3, step: 0.01 },
  { key: "rotationOffset", label: "회전", min: -180, max: 180, step: 1 },
] as const;

function calibrationInput(
  key: keyof SkinCalibration,
  value: string,
  update: Dispatch<SetStateAction<SkinCalibration>>,
) {
  const numericValue = Number(value);
  update((current) => ({ ...current, [key]: numericValue }));
}

function SkinEditorCore({ services }: { services: SkinEditorServices }) {
  const activeServices = useRef<SkinEditorServices>(services);
  const savingRef = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const hydrated = useSyncExternalStore(subscribeToHydration, clientHydrated, serverHydrated);
  const [validated, setValidated] = useState<ValidatedBrowserFile | null>(null);
  const [name, setName] = useState("");
  const [calibration, setCalibration] = useState<SkinCalibration>(DEFAULT_CALIBRATION);
  const [skins, setSkins] = useState<AdminSkin[]>([]);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string>();
  const [message, setMessage] = useState("");

  function getServices() {
    return activeServices.current;
  }

  function draftFields(enabled?: boolean) {
    return { name, ...calibration, sortOrder: skins.length, ...(enabled === undefined ? {} : { enabled }) };
  }

  function handleError(error: unknown, enabled?: boolean) {
    if (error instanceof ApiError && error.code === "ADMIN_SESSION_EXPIRED") {
      getServices().expireSession(draftFields(enabled));
      return;
    }
    setMessage(error instanceof Error ? error.message : "요청을 처리하지 못했어요.");
  }

  useEffect(() => {
    let cancelled = false;
    const active = getServices();
    const restored = active.restoreDraft?.();
    if (restored) {
      setName(restored.name);
      setCalibration({
        anchorX: restored.anchorX,
        anchorY: restored.anchorY,
        scale: restored.scale,
        rotationOffset: restored.rotationOffset,
      });
    }
    const token = active.getToken();
    if (!token) return;
    active.listSkins(token).then((items) => {
      if (!cancelled) setSkins(items);
    }).catch(handleError);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setValidated(null);
    setMessage("");
    if (!selected) return;
    try {
      setValidated(await getServices().validateFile(selected));
    } catch (error) {
      setFile(null);
      handleError(error);
    }
  }

  async function save(enabled: boolean) {
    if (savingRef.current || !file || !name.trim()) return;
    savingRef.current = true;
    setSaving(true);
    setMessage("");
    try {
      const active = getServices();
      const token = active.getToken();
      if (!token) {
        active.expireSession(draftFields(enabled));
        return;
      }
      const checked = validated ?? await active.validateFile(file);
      const asset = await active.uploadAsset(token, checked, name.trim());
      await active.saveSkin(token, { assetId: asset.assetId, name: name.trim(), ...calibration, enabled, sortOrder: skins.length });
      setName("");
      setFile(null);
      setValidated(null);
      setCalibration(DEFAULT_CALIBRATION);
      setSkins(await active.listSkins(token));
      setMessage(enabled ? "스킨을 저장하고 활성화했어요." : "스킨을 비공개로 저장했어요.");
    } catch (error) {
      handleError(error, enabled);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function toggle(skin: AdminSkin) {
    const active = getServices();
    const token = active.getToken();
    if (!token) return active.expireSession(draftFields());
    setBusyId(skin.skinId);
    try {
      await active.setEnabled(token, skin.skinId, !skin.enabled);
      setSkins(await active.listSkins(token));
    } catch (error) {
      handleError(error);
    } finally {
      setBusyId(undefined);
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}><div><span>양치왕 관리자</span><h1>AR 스킨 관리</h1></div><p>PNG·WebP / 최대 2MB</p></header>
      <div className={styles.editorGrid}>
        <SkinPreview imageUrl={validated?.previewUrl} calibration={calibration} />
        <section className={styles.formCard} aria-label="스킨 설정">
          <label className={styles.field}><span>스킨 이미지</span><input type="file" accept="image/png,image/webp" disabled={!hydrated} onChange={selectFile} /></label>
          <label className={styles.field}><span>스킨 이름</span><input value={name} maxLength={40} placeholder="예: 꽃님 사진관" onChange={(event) => setName(event.target.value)} /></label>
          <div className={styles.sliders}>
            {sliders.map((slider) => <label key={slider.key}><span>{slider.label}<strong>{calibration[slider.key]}</strong></span><input type="range" aria-label={slider.label} min={slider.min} max={slider.max} step={slider.step} value={calibration[slider.key]} onInput={(event) => calibrationInput(slider.key, event.currentTarget.value, setCalibration)} /></label>)}
          </div>
          <output data-testid="calibration-values" className={styles.values}>{JSON.stringify(calibration)}</output>
          {message && <p role="status" className={styles.message}>{message}</p>}
          <div className={styles.actions}>
            <button type="button" disabled={saving || !file || !name.trim()} onClick={() => save(false)}>비공개로 저장</button>
            <button type="button" className={styles.primary} disabled={saving || !file || !name.trim()} onClick={() => save(true)}>{saving ? "저장 중" : "저장하고 활성화"}</button>
          </div>
        </section>
      </div>
      <SkinList skins={skins} busyId={busyId} onToggle={toggle} />
    </main>
  );
}

function BrowserSkinEditor() {
  const router = useRouter();
  const services = useMemo(() => browserServices((path) => router.push(path)), [router]);
  return <SkinEditorCore services={services} />;
}

export function SkinEditor({ services }: { services?: SkinEditorServices }) {
  return services ? <SkinEditorCore services={services} /> : <BrowserSkinEditor />;
}
