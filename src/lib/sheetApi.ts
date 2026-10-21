export interface SheetTodoItem {
  timestamp: string;
  datetime: string;
  category: "할 일" | "아이디어" | "기타";
  content: string;
  color: "yellow" | "pink" | "green" | "blue";
  state?: string;
  order?: number;
}

const SCRIPT_URL = process.env.NEXT_PUBLIC_GOOGLE_SCRIPT_URL;

/**
 * 구글 시트에서 전체 할 일 목록 가져오기 (Read)
 */
export async function fetchTodosFromSheet(): Promise<SheetTodoItem[]> {
  if (!SCRIPT_URL) {
    console.warn("NEXT_PUBLIC_GOOGLE_SCRIPT_URL이 설정되지 않았습니다.");
    return [];
  }

  try {
    const res = await fetch(`${SCRIPT_URL}?t=${Date.now()}`, {
      method: "GET",
    });

    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status}`);
    }

    const result = await res.json();
    if (result.success && Array.isArray(result.data)) {
      return result.data;
    }
    return [];
  } catch (error) {
    console.error("구글 시트 데이터 조회 실패:", error);
    throw error;
  }
}

/**
 * 구글 앱스 스크립트로 작업 전송 (Create, Update, Delete, Reorder)
 * GAS의 CORS 특성을 고려하여 text/plain 형식으로 POST 전송합니다.
 */
export async function executeSheetAction(payload: any): Promise<boolean> {
  if (!SCRIPT_URL) {
    console.warn("NEXT_PUBLIC_GOOGLE_SCRIPT_URL이 설정되지 않았습니다.");
    return false;
  }

  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      // text/plain을 사용하면 브라우저 preflight(OPTIONS) 없이 바로 GAS doPost로 도달합니다.
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`HTTP Error: ${res.status}`);
    }

    const data = await res.json();
    return !!data.success;
  } catch (error) {
    console.error("구글 시트 액션 실행 실패:", error);
    return false;
  }
}
