const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const hasControl = value => [...value].some(character => {
  const code = character.codePointAt(0);
  return code < 32 || code === 127;
});

/** Validate before constructing a pg.Client: pg query parameters override URL hosts. */
export function assertLocalDatabaseUrl(value) {
  const fail = () => {
    const error = new Error('Test database URL must be a local PostgreSQL URL without query, fragment, or parser overrides.');
    error.code = 'ERR_UNSAFE_TEST_DATABASE_URL';
    throw error;
  };
  if (typeof value !== 'string' || !/^postgres(?:ql)?:\/\//i.test(value)
    || hasControl(value) || value.includes(' ') || value.includes('\\')
    || value.includes('?') || value.includes('#') || /%(?![0-9a-f]{2})/i.test(value)) fail();
  let target;
  try {
    target = new URL(value);
    for (const component of [target.username, target.password, target.pathname]) {
      if (hasControl(decodeURIComponent(component))) fail();
    }
  } catch { fail(); }
  if (!LOCAL_HOSTS.has(target.hostname) || target.search || target.hash) fail();
  return target;
}
