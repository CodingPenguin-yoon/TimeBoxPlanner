export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  if (process.env.AUTH_REGISTRATION === "open") return true;
  const allowed = (process.env.AUTH_ALLOWED_EMAILS ?? "")
    .split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}
