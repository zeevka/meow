type SupabaseLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function getErrorText(error: unknown) {
  if (!error || typeof error !== "object") {
    return "";
  }

  const maybeError = error as SupabaseLikeError;
  return [
    maybeError.code,
    maybeError.message,
    maybeError.details,
    maybeError.hint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function isSupabaseSchemaSetupError(error: unknown) {
  const text = getErrorText(error);

  return (
    text.includes("relation") ||
    text.includes("does not exist") ||
    text.includes("schema cache") ||
    text.includes("could not find") ||
    text.includes("infinite recursion") ||
    text.includes("function public.") ||
    text.includes("pgrst")
  );
}

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
