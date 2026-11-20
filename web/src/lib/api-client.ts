const ML_API_URL = process.env.ML_API_URL || "http://127.0.0.1:8000";

export async function fetchFromMlApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data?: T; error?: string; status: number }> {
  try {
    const url = `${ML_API_URL}${path.startsWith("/") ? path : `/${path}`}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      cache: "no-store",
    });

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        error: body?.detail || `ML API request failed with status ${res.status}`,
        status: res.status,
      };
    }

    return { data: body as T, status: res.status };
  } catch (err: any) {
    return {
      error: err?.message || "Internal server error communicating with ML API",
      status: 502,
    };
  }
}
