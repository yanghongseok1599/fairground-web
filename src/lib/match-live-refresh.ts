/** 직렬 조회와 폐기 가드로 늦게 도착한 응답이 최신 경기 기록을 덮지 않게 한다. */
export function createMatchLiveRefresh<T>(options: {
  load: () => Promise<T>;
  publish: (value: T) => void;
  onError: (error: unknown) => void;
}) {
  let active = true;
  let running = false;
  let queued = false;

  const refresh = async () => {
    if (!active) return;
    queued = true;
    if (running) return;
    running = true;
    try {
      while (active && queued) {
        queued = false;
        try {
          const value = await options.load();
          if (active) options.publish(value);
        } catch (error) {
          if (active) options.onError(error);
        }
      }
    } finally {
      running = false;
    }
  };

  return { refresh, stop: () => { active = false; queued = false; } };
}
