"use client";

import { useActionState, useState } from "react";

import { depositUpbitKrw, type MarginState } from "@/app/actions/margin";
import {
  errorBoxClassName,
  inputClassName,
  primaryButtonClassName,
} from "@/components/ui";

const initialState: MarginState = {};

export function DepositForm() {
  const [state, action, pending] = useActionState(
    depositUpbitKrw,
    initialState,
  );
  const [display, setDisplay] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/[^0-9]/g, "");
    setDisplay(digits ? Number(digits).toLocaleString("ko-KR") : "");
  }

  return (
    <form action={action} className="space-y-4">
      <div>
        <label
          htmlFor="amount"
          className="mb-1.5 block text-sm font-medium text-zinc-300"
        >
          입금액 (원)
        </label>
        <input
          id="amount"
          type="text"
          inputMode="numeric"
          placeholder="100만원 ~ 1억원"
          value={display}
          onChange={handleChange}
          className={inputClassName}
          required
        />
        <input type="hidden" name="amount" value={display.replace(/,/g, "")} />
      </div>

      {state.error && <p className={errorBoxClassName}>{state.error}</p>}

      <button type="submit" disabled={pending} className={primaryButtonClassName}>
        {pending ? "처리 중..." : "입금"}
      </button>
    </form>
  );
}
