import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminLoginForm } from "@/features/admin/admin-login-form";
import { ApiError } from "@/lib/api/api-error";

describe("AdminLoginForm", () => {
  it("renders before browser API configuration is resolved", () => {
    expect(() => render(<AdminLoginForm />)).not.toThrow();
    expect(screen.getByLabelText("관리자 비밀번호")).toBeVisible();
  });

  it("shows a safe password error without persisting the password", async () => {
    const store = { set: vi.fn() };
    render(<AdminLoginForm services={{
      login: vi.fn().mockRejectedValue(new ApiError("ADMIN_LOGIN_FAILED", "비밀번호를 확인해 주세요.")),
      store,
      navigate: vi.fn(),
      getReturnTo: vi.fn(() => null),
    }} />);
    fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("비밀번호를 확인해 주세요.");
    expect(store.set).not.toHaveBeenCalled();
    expect(JSON.stringify(sessionStorage)).not.toContain("wrong-password");
  });

  it("stores the parsed session and navigates after one successful submit", async () => {
    const session = { adminToken: "a".repeat(32), expiresAtMs: 10_000 };
    let resolve!: (value: typeof session) => void;
    const pending = new Promise<typeof session>((done) => { resolve = done; });
    const services = { login: vi.fn(() => pending), store: { set: vi.fn() }, navigate: vi.fn(), getReturnTo: vi.fn(() => null) };
    render(<AdminLoginForm services={services} />);
    fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "valid-password" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    fireEvent.click(screen.getByRole("button", { name: "로그인 중" }));
    expect(await screen.findByText("로그인하고 있어요.")).toBeVisible();
    expect(services.login).toHaveBeenCalledOnce();
    resolve(session);
    await vi.waitFor(() => expect(services.navigate).toHaveBeenCalledWith("/admin/dashboard"));
    expect(services.store.set).toHaveBeenCalledWith(session);
  });

  it("honors only safe local return paths", async () => {
    const session = { adminToken: "a".repeat(32), expiresAtMs: 10_000 };
    const services = {
      login: vi.fn().mockResolvedValue(session),
      store: { set: vi.fn() },
      navigate: vi.fn(),
      getReturnTo: vi.fn(() => "https://outside.example/path"),
    };
    render(<AdminLoginForm services={services} />);
    fireEvent.change(screen.getByLabelText("관리자 비밀번호"), { target: { value: "valid-password" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    await vi.waitFor(() => expect(services.navigate).toHaveBeenCalledWith("/admin/dashboard"));
  });
});
