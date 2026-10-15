import { HttpErrorResponse } from '@angular/common/http';

/**
 * Turns any HTTP failure into a sentence a client can act on. Prefers the message
 * the backend sent (Spring `ApiError.message` or Nest `{ message }`), then falls
 * back to a status-specific explanation.
 */
export function describeHttpError(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!(error instanceof HttpErrorResponse)) {
    return error instanceof Error && error.message ? error.message : fallback;
  }

  if (error.status === 0) {
    return 'We could not reach the server. Check your connection and try again.';
  }

  const serverMessage = extractServerMessage(error.error);

  switch (error.status) {
    case 400:
      return serverMessage ?? 'The request was not valid. Please check the details and try again.';
    case 401:
      return serverMessage ?? 'Your session is no longer valid. Please sign in again.';
    case 403:
      return serverMessage ?? 'Your role does not allow this action.';
    case 404:
      return serverMessage ?? 'We could not find what you were looking for.';
    case 409:
      return serverMessage ?? 'This action conflicts with the current state of your account.';
    case 502:
    case 504:
      // The dev-server proxy (or a production reverse proxy) could not reach the service behind the prefix.
      return 'The service could not be reached through the API gateway. If you are running locally, make sure Group-12-Auth (port 3000) and Group-12-Backend (port 8081) are started.';
    case 503:
      return 'The service is temporarily unavailable. Please try again shortly.';
    default:
      if (error.status >= 500) {
        return 'The server ran into a problem. Please try again in a moment.';
      }
      return serverMessage ?? fallback;
  }
}

export function httpStatusOf(error: unknown): number | null {
  return error instanceof HttpErrorResponse ? error.status : null;
}

/** True for failures where no service answered at all (network error or gateway timeout). */
export function isUnreachable(error: unknown): boolean {
  const status = httpStatusOf(error);
  return status === 0 || status === 502 || status === 503 || status === 504;
}

/**
 * Every message in the error body, one per entry. NestJS validation errors arrive as
 * `message: string[]`; Spring and Nest business errors as a single string.
 */
export function extractServerMessages(error: unknown): string[] {
  if (!(error instanceof HttpErrorResponse)) {
    return [];
  }
  const body: unknown = error.error;
  if (!body || typeof body !== 'object') {
    return typeof body === 'string' && body.trim() ? [body.trim()] : [];
  }
  const message = (body as Record<string, unknown>)['message'];
  if (typeof message === 'string' && message.trim()) {
    return [message.trim()];
  }
  if (Array.isArray(message)) {
    return message
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim());
  }
  return [];
}

function extractServerMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return typeof body === 'string' && body.trim() ? body.trim() : null;
  }
  const record = body as Record<string, unknown>;
  const message = record['message'];
  if (typeof message === 'string' && message.trim()) {
    return message.trim();
  }
  if (Array.isArray(message) && message.length) {
    return message.filter((item): item is string => typeof item === 'string').join(' ');
  }
  const errorText = record['error'];
  return typeof errorText === 'string' && errorText.trim() ? errorText.trim() : null;
}
