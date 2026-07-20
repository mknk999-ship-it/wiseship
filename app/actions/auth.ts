"use server";

import { redirect } from "next/navigation";

import { mapAuthError, usernameToEmail, validateUsername } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type AuthState = {
  error?: string;
};

export async function login(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  const usernameError = validateUsername(username);
  if (usernameError) return { error: usernameError };
  if (!password) return { error: "비밀번호를 입력해주세요." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });

  if (error) {
    return { error: mapAuthError(error.message, "login") };
  }

  redirect("/dashboard");
}

export async function signup(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;
  const nickname = (formData.get("nickname") as string)?.trim();

  const usernameError = validateUsername(username);
  if (usernameError) return { error: usernameError };
  if (!password || password.length < 6) {
    return { error: "비밀번호는 6자 이상이어야 합니다." };
  }
  if (!nickname) return { error: "닉네임을 입력해주세요." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: usernameToEmail(username),
    password,
  });

  if (error) {
    return { error: mapAuthError(error.message, "signup") };
  }

  if (!data.user) {
    return { error: "회원가입에 실패했습니다." };
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: data.user.id,
    nickname,
  });

  if (profileError) {
    return { error: "프로필 생성에 실패했습니다." };
  }

  const { error: accountError } = await supabase.from("accounts").insert({
    user_id: data.user.id,
  });

  if (accountError) {
    return { error: "계정 생성에 실패했습니다." };
  }

  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
