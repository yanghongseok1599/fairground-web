"use client";

type SocialAuthButtonsProps = {
  disabled?: boolean;
  googleLabel?: string;
  onGoogle: () => void | Promise<void>;
  onKakao: () => void | Promise<void>;
};

function KakaoLoginSymbol() {
  return (
    <svg
      aria-hidden="true"
      className="h-[18px] w-[18px] shrink-0 text-black"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path
        fill="currentColor"
        d="M12 3C6.48 3 2 6.58 2 11c0 2.83 1.84 5.31 4.61 6.73l-.94 3.45a.5.5 0 0 0 .76.55l4.16-2.77c.46.04.93.07 1.41.07 5.52 0 10-3.59 10-8.03S17.52 3 12 3Z"
      />
    </svg>
  );
}

function GoogleSymbol() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

/** 로그인·회원가입에서 같은 OAuth 순서와 브랜드 규격을 유지한다. */
export function SocialAuthButtons({
  disabled = false,
  googleLabel = "Google로 계속",
  onGoogle,
  onKakao,
}: SocialAuthButtonsProps) {
  const commonClassName =
    "flex min-h-12 w-full touch-manipulation items-center justify-center gap-2.5 rounded-[12px] px-4 text-sm font-semibold transition-[filter,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onKakao}
        disabled={disabled}
        aria-busy={disabled || undefined}
        className={`${commonClassName} bg-[#FEE500] text-black/85 hover:shadow-sm focus-visible:ring-black/70`}
      >
        <KakaoLoginSymbol />
        카카오 로그인
      </button>

      <button
        type="button"
        onClick={onGoogle}
        disabled={disabled}
        aria-busy={disabled || undefined}
        className={`${commonClassName} border border-border bg-background text-foreground hover:bg-muted focus-visible:ring-ring`}
      >
        <GoogleSymbol />
        {googleLabel}
      </button>
    </div>
  );
}
