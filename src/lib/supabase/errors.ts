type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

export function getReadableErrorMessage(
  error: unknown,
  fallback: string,
) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const maybeError = error as SupabaseLikeError;
    const joined = [maybeError.message, maybeError.details, maybeError.hint]
      .filter(Boolean)
      .join(" - ");

    if (joined) {
      return joined;
    }
  }

  return fallback;
}
