"use client";

/**
 * 비밀번호 입력 + 보기/숨기기 토글 (키트 password-field, 이 앱의 입력 스타일을 받도록 class/style 만 열었다).
 *
 * 접근성 결정 (GOV.UK Password input 기준):
 *  - aria-pressed 를 쓰지 않는다. 라벨이 "보기"↔"숨기기" 로 바뀌는데 aria-pressed 까지 붙이면 상태를 두 번 읽는다.
 *  - 상태 변화는 polite 라이브 영역으로 따로 알린다.
 *  - 폼 제출 시와 뒤로가기 캐시(pageshow)로 돌아왔을 때 다시 가린다. 공용 PC 에서 노출을 막는다.
 *  - 붙여넣기와 비밀번호 관리자를 막지 않는다 (NIST 800-63B).
 */
import { useEffect, useId, useRef, useState, type ComponentProps, type CSSProperties } from "react";

type Props = Omit<ComponentProps<"input">, "type" | "autoComplete" | "className" | "style"> & {
  label: string;
  /** 로그인·현재 비밀번호는 "current-password", 가입·변경의 새 비밀번호는 "new-password". */
  autoComplete: "current-password" | "new-password";
  hint?: string;
  className?: string;
  labelClassName?: string;
  labelStyle?: CSSProperties;
  inputClassName?: string;
  inputStyle?: CSSProperties;
};

export function PasswordField({
  label, hint, id, autoComplete, className, labelClassName, labelStyle, inputClassName, inputStyle, ...props
}: Props) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const describedBy = [props["aria-describedby"], hintId].filter(Boolean).join(" ") || undefined;
  const [visible, setVisible] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const hide = () => setVisible(false);
    const form = inputRef.current?.form;
    form?.addEventListener("submit", hide);
    window.addEventListener("pageshow", hide);
    return () => {
      form?.removeEventListener("submit", hide);
      window.removeEventListener("pageshow", hide);
    };
  }, []);

  const toggle = () => {
    const next = !visible;
    setVisible(next);
    setAnnouncement(next ? "비밀번호가 표시되었습니다." : "비밀번호가 가려졌습니다.");
  };

  return (
    <div className={className}>
      <label htmlFor={inputId} className={labelClassName} style={labelStyle}>{label}</label>
      {hint ? <p id={hintId} className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
      <div className="relative">
        <input
          {...props}
          ref={inputRef}
          id={inputId}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          aria-describedby={describedBy}
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          className={`${inputClassName ?? ""} pr-16`}
          style={inputStyle}
        />
        <button
          type="button"
          aria-controls={inputId}
          aria-label={visible ? `${label} 숨기기` : `${label} 보기`}
          onClick={toggle}
          disabled={props.disabled}
          className="absolute inset-y-0 right-0 h-full min-w-11 px-3 text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          {visible ? "숨기기" : "보기"}
        </button>
      </div>
      <span aria-live="polite" className="sr-only">{announcement}</span>
    </div>
  );
}
