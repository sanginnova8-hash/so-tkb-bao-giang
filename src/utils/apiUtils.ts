/**
 * Safe API request helpers that prevent 'Unexpected token <, "<!doctype " is not valid JSON'
 * by ensuring responses are valid JSON before attempting to parse them.
 */

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(input, init);
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await res.json();
      return {
        ok: res.ok,
        status: res.status,
        data,
        error: !res.ok ? (data?.error || data?.message || `Lỗi máy chủ (${res.status})`) : undefined,
      };
    }

    // Response is not JSON (e.g. HTML 404 or 500 error page from server)
    const text = await res.text();
    const cleanSnippet = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);

    return {
      ok: false,
      status: res.status,
      error: cleanSnippet
        ? `Lỗi máy chủ (${res.status}): ${cleanSnippet}`
        : `Phản hồi máy chủ không đúng định dạng (${res.status}).`,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      error: err?.message || 'Không thể kết nối đến máy chủ.',
    };
  }
}
