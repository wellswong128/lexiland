export function buildApiAuthHeaders(session, { expectedUserId } = {}) {
  const token = session?.access_token;

  if (!token) {
    return {};
  }

  if (expectedUserId && session?.user?.id !== expectedUserId) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}
