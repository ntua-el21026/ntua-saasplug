export class ApiError extends Error {
  status: number;
  detail: unknown;
  userMessage: string;

  constructor(status: number, detail: unknown, userMessage: string) {
    super(userMessage);
    this.status = status;
    this.detail = detail;
    this.userMessage = userMessage;
  }
}

export interface ApiOptions extends RequestInit {
  accessToken?: string | null;
  bodyJson?: unknown;
}

export async function requestJson<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { response, payload } = await requestPayload(path, options);

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    throw new ApiError(response.status, payload, messageFromPayload(payload, response.status));
  }

  return payload as T;
}

export async function requestText(path: string, options: ApiOptions = {}): Promise<string> {
  const { response, text, payload } = await requestPayload(path, options);

  if (!response.ok) {
    throw new ApiError(response.status, payload, messageFromPayload(payload, response.status));
  }

  return text;
}

async function requestPayload(path: string, options: ApiOptions = {}): Promise<{
  response: Response;
  text: string;
  payload: unknown;
}> {
  if (!path.startsWith("/api/")) {
    throw new Error(`Frontend API calls must use gateway-relative /api paths: ${path}`);
  }

  const headers = new Headers(options.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  if (options.bodyJson !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (options.accessToken) {
    headers.set("Authorization", `Bearer ${options.accessToken}`);
  }

  const response = await fetch(path, {
    ...options,
    headers,
    body: options.bodyJson === undefined ? options.body : JSON.stringify(options.bodyJson),
  });

  if (response.status === 204) {
    return { response, text: "", payload: null };
  }

  const text = await response.text();
  const payload = parseResponsePayload(text);

  return { response, text, payload };
}

export function messageFromUnknownError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.userMessage;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "The request could not be completed. Please try again.";
}

function parseResponsePayload(text: string): unknown {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function messageFromPayload(payload: unknown, status: number): string {
  if (typeof payload === "string") {
    return payload;
  }
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail: unknown }).detail;
    if (typeof detail === "string") {
      return detail;
    }
    if (detail && typeof detail === "object" && "message" in detail) {
      const message = (detail as { message?: unknown }).message;
      if (typeof message === "string") {
        return message;
      }
    }
    if (detail && typeof detail === "object" && "error_type" in detail) {
      const errorType = (detail as { error_type?: unknown }).error_type;
      if (typeof errorType === "string") {
        return friendlyErrorType(errorType);
      }
    }
  }
  if (status === 401) {
    return "Your session has expired. Please sign in again.";
  }
  if (status === 403) {
    return "Your account does not have access to this action.";
  }
  if (status === 404) {
    return "The requested record was not found.";
  }
  if (status >= 500) {
    return "The service is temporarily unavailable. Please try again later.";
  }
  return "The request could not be completed. Please review the form and try again.";
}

function friendlyErrorType(errorType: string): string {
  const messages: Record<string, string> = {
    catalog_point_not_found: "The point is no longer available in the catalog.",
    catalog_point_unavailable: "This point is not currently available for reservation.",
    provider_http_error: "The provider service rejected the request.",
    provider_timeout: "The provider did not respond in time.",
  };
  return messages[errorType] ?? "The request could not be completed.";
}
