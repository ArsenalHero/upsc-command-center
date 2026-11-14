type AuthAction = "login" | "signup" | "forgot" | "reset" | "resend";

// Return approved user messages, never SMTP responses, recipient details or server diagnostics.
export function authErrorMessage(error: unknown, action: AuthAction): string {
  const value = error && typeof error === "object" ? error as { code?: unknown; status?: unknown; message?: unknown; name?: unknown } : {};
  const code = typeof value.code === "string" ? value.code : "";
  const status = typeof value.status === "number" ? value.status : 0;
  const message = typeof value.message === "string" ? value.message : "";
  const emailFailure = code === "email_address_not_authorized" || (status >= 500 && /smtp|error sending (?:confirmation|recovery|reset|magic link|email)/i.test(message));

  if (emailFailure) {
    if (action === "forgot") return "The website’s email service is unavailable. We couldn’t send a password reset link. Please try again later.";
    if (action === "resend") return "The website’s email service is unavailable. We couldn’t resend your confirmation email. Please try again later.";
    return "The website’s email service is unavailable, so we couldn’t complete sign-up. Please try again later or continue as a guest.";
  }
  if (status === 429 || ["over_email_send_rate_limit", "over_request_rate_limit", "over_sms_send_rate_limit"].includes(code)) {
    return "Too many requests have been made. Please wait before trying again.";
  }
  if (code === "weak_password") return "Choose a stronger password with at least 8 characters.";
  if (code === "email_address_invalid") return "Enter a valid email address.";
  if (code === "email_not_confirmed") return "Please confirm your email before logging in.";
  if (code === "signup_disabled" || code === "email_provider_disabled") return "Email sign-up is temporarily unavailable. You can continue as a guest.";
  if (code === "same_password") return "Choose a password you haven’t used before.";
  if (status >= 500 || code === "unexpected_failure") return "The account service is temporarily unavailable. Please try again later or continue as a guest.";
  if (value.name === "AuthRetryableFetchError" || value.name === "TypeError") return "We couldn’t connect to the account service. Check your connection and try again.";
  if (action === "login") return "We couldn't log you in. Check your email and password, then try again.";
  if (action === "forgot") return "We couldn't send a reset email right now. Please try again later.";
  if (action === "reset") return "Your password could not be changed. Try a different password or request a new reset link.";
  if (action === "resend") return "We couldn't resend the email yet. Wait a moment and try again.";
  return "Sign-up could not be completed. If you already have an account, log in or request a password reset.";
}
