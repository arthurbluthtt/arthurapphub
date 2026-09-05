/**
 * Driver no-op para Astro. La autenticación real del proyecto vive en D1 y
 * no debe crear ni depender del binding KV `SESSION` del adapter.
 */
export default function createNullSessionDriver() {
  return {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  };
}
