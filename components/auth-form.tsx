"use client";

import { useActionState, useState } from "react";

import { login, signup, type AuthState } from "@/app/actions/auth";

const initialState: AuthState = {};

type Mode = "login" | "signup";

const inputClassName =
  "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-600";

const USERNAME_PATTERN = /^[a-z0-9_]*$/;

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [loginState, loginAction, loginPending] = useActionState(
    login,
    initialState,
  );
  const [signupState, signupAction, signupPending] = useActionState(
    signup,
    initialState,
  );

  const state = mode === "login" ? loginState : signupState;
  const action = mode === "login" ? loginAction : signupAction;
  const pending = mode === "login" ? loginPending : signupPending;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Wiseship
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          {mode === "login"
            ? "아이디와 비밀번호로 로그인하세요"
            : "새 계정을 만들어 시작하세요"}
        </p>
      </div>

      <div className="mb-6 flex rounded-lg bg-zinc-800/60 p-1">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
            mode === "login"
              ? "bg-zinc-700 text-zinc-50 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          로그인
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
            mode === "signup"
              ? "bg-zinc-700 text-zinc-50 shadow-sm"
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          회원가입
        </button>
      </div>

      <form action={action} className="space-y-4">
        {mode === "signup" && (
          <div>
            <label
              htmlFor="nickname"
              className="mb-1.5 block text-sm font-medium text-zinc-300"
            >
              닉네임
            </label>
            <input
              id="nickname"
              name="nickname"
              type="text"
              autoComplete="nickname"
              placeholder="표시될 닉네임"
              className={inputClassName}
              required
            />
          </div>
        )}

        <div>
          <label
            htmlFor="username"
            className="mb-1.5 block text-sm font-medium text-zinc-300"
          >
            아이디
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder="영문 소문자, 숫자, 밑줄"
            pattern="[a-z0-9_]+"
            title="영문 소문자, 숫자, 밑줄(_)만 사용할 수 있습니다."
            value={username}
            onChange={(e) => {
              const next = e.target.value.toLowerCase();
              if (USERNAME_PATTERN.test(next)) setUsername(next);
            }}
            className={inputClassName}
            required
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-medium text-zinc-300"
          >
            비밀번호
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            placeholder={mode === "signup" ? "6자 이상" : "비밀번호"}
            className={inputClassName}
            required
          />
        </div>

        {state.error && (
          <p className="rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-zinc-100 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending
            ? "처리 중..."
            : mode === "login"
              ? "로그인"
              : "회원가입"}
        </button>
      </form>
    </div>
  );
}
