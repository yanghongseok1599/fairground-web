/** Bound auth-lock waits as well as network I/O; never retry a mutation. */
export async function inspectionRequest<T>(
  signal: AbortSignal,
  request: (signal: AbortSignal) => PromiseLike<T>,
  timeoutMs = 15_000,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: () => void = () => {};
  const interrupted = new Promise<never>((_, reject) => {
    cancel = () => { controller.abort(); reject(new Error("검인 요청이 취소되었습니다.")); };
    if (signal.aborted) cancel();
    else signal.addEventListener("abort", cancel, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("서버 응답 timeout: 검인 결과를 다시 확인해주세요."));
    }, timeoutMs);
  });
  try {
    return await Promise.race([interrupted, signal.aborted ? interrupted : request(controller.signal)]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}
