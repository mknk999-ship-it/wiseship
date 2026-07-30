"use client";

import { useState, useEffect, useRef } from "react";

import { MAX_LEVERAGE } from "@/lib/engine";

const MIN_LEVERAGE = 1;
const PRESETS = [5, 10, 20, 30, 50, 75, 100];

const C = {
  bg: "#09090b",
  sheet: "#18181b",
  card: "#27272a",
  line: "#27272a",
  text: "#fafafa",
  sub: "#a1a1aa",
  green: "#10b981",
  greenDim: "rgba(16,185,129,0.15)",
};

export default function LeverageControl({ value = 20, onChange }) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState(value);

  useEffect(() => {
    if (open) setTemp(value);
  }, [open, value]);

  const clamp = (n) => Math.min(MAX_LEVERAGE, Math.max(MIN_LEVERAGE, n));
  const step = (delta) => setTemp((t) => clamp(t + delta));

  const confirm = () => {
    onChange?.(temp);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: C.card,
          color: C.text,
          border: "none",
          borderRadius: 6,
          padding: "8px 14px",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        Cross · {value}x
        <span style={{ color: C.sub, fontSize: 11 }}>▾</span>
      </button>

      {open && (
        <LeverageSheet
          temp={temp}
          value={value}
          clamp={clamp}
          step={step}
          setTemp={setTemp}
          onConfirm={confirm}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function LeverageSheet({ temp, value, clamp, step, setTemp, onConfirm, onClose }) {
  const holdRef = useRef(null);

  const startHold = (delta) => {
    step(delta);
    holdRef.current = setTimeout(function repeat() {
      step(delta);
      holdRef.current = setTimeout(repeat, 90);
    }, 350);
  };
  const stopHold = () => clearTimeout(holdRef.current);
  useEffect(() => () => clearTimeout(holdRef.current), []);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-end",
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          background: C.sheet,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: "18px 18px 22px",
          color: C.text,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>레버리지 조정</span>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", color: C.sub, fontSize: 20, cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        <div style={{ marginTop: 4, marginBottom: 18, fontSize: 12, color: C.sub }}>
          현재 {value}x
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: C.bg,
            borderRadius: 10,
            padding: 6,
            marginBottom: 16,
          }}
        >
          <StepButton label="−" disabled={temp <= MIN_LEVERAGE} onDown={() => startHold(-1)} onUp={stopHold} />
          <div style={{ flex: 1, textAlign: "center", fontSize: 26, fontWeight: 700, letterSpacing: 1 }}>
            {temp}
            <span style={{ fontSize: 16, color: C.sub, marginLeft: 2 }}>x</span>
          </div>
          <StepButton label="+" disabled={temp >= MAX_LEVERAGE} onDown={() => startHold(1)} onUp={stopHold} />
        </div>

        <input
          type="range"
          min={MIN_LEVERAGE}
          max={MAX_LEVERAGE}
          value={temp}
          onChange={(e) => setTemp(clamp(Number(e.target.value)))}
          style={{ width: "100%", accentColor: C.green, marginBottom: 6 }}
        />

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, marginBottom: 22 }}>
          {PRESETS.map((p) => {
            const active = temp === p;
            return (
              <button
                type="button"
                key={p}
                onClick={() => setTemp(p)}
                style={{
                  flex: 1,
                  minWidth: 52,
                  padding: "9px 0",
                  borderRadius: 8,
                  border: `1px solid ${active ? C.green : C.line}`,
                  background: active ? C.greenDim : "transparent",
                  color: active ? C.green : C.text,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {p}x
              </button>
            );
          })}
        </div>

        {temp >= 50 && (
          <div style={{ fontSize: 12, color: "#f87171", marginBottom: 14, lineHeight: 1.5 }}>
            높은 레버리지는 청산 위험이 커집니다. 작은 가격 변동에도 증거금이 소진될 수 있어요.
          </div>
        )}

        <button
          type="button"
          onClick={onConfirm}
          style={{
            width: "100%",
            padding: "14px 0",
            borderRadius: 10,
            border: "none",
            background: C.green,
            color: C.bg,
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          확인
        </button>
      </div>
    </div>
  );
}

function StepButton({ label, disabled, onDown, onUp }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={onDown}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      onTouchStart={(e) => {
        e.preventDefault();
        onDown();
      }}
      onTouchEnd={onUp}
      style={{
        width: 46,
        height: 46,
        borderRadius: 8,
        border: "none",
        background: C.card,
        color: disabled ? "#52525b" : C.text,
        fontSize: 24,
        fontWeight: 600,
        cursor: disabled ? "default" : "pointer",
        userSelect: "none",
      }}
    >
      {label}
    </button>
  );
}
