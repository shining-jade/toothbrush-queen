import { AdminLoginForm } from "@/features/admin/admin-login-form";
import styles from "@/features/admin/admin.module.css";

export default function AdminPage() {
  return (
    <main className={styles.shell}>
      <AdminLoginForm />
    </main>
  );
}
