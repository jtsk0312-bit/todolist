/**
 * Google Apps Script - Post-it Todo List CRUD API
 * 
 * 스프레드시트 컬럼 구성 (1행 헤더):
 * 1열(A): timestamp (고유 ID / 생성 타임스탬프)
 * 2열(B): datetime  (포맷된 작성 일시, 예: 2026.10.21 (수) 20:30)
 * 3열(C): category  (할 일, 아이디어, 기타)
 * 4열(D): content   (메모 내용)
 * 5열(E): color     (yellow, pink, green, blue)
 * 6열(F): state     (active, done 등)
 * 7열(G): order     (정렬 순서 번호)
 */

const SPREADSHEET_ID = "1wH3RzHwMo9a0-RFX1qLuLhfgN8gz_u740Oo05kkfCBg";
const SHEET_NAME = "Sheet1"; // 시트 이름에 맞게 수정 가능 (기본: 첫 번째 시트 사용)

function getTargetSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.getSheets()[0];
  }
  return sheet;
}

/**
 * 초기 헤더 설정 함수 (최초 1회 실행용)
 */
function setupHeaders() {
  const sheet = getTargetSheet();
  const headers = ["timestamp", "datetime", "category", "content", "color", "state", "order"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
}

/**
 * GET 요청 처리 (Read: 목록 조회)
 */
function doGet(e) {
  try {
    const sheet = getTargetSheet();
    const data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return responseJSON({ success: true, data: [] });
    }

    const headers = data[0].map(h => String(h).trim().toLowerCase());
    const rows = data.slice(1);

    const items = rows
      .filter(row => row[0] !== "" && row[0] !== null && row[0] !== undefined)
      .map(row => {
        const item = {};
        headers.forEach((header, index) => {
          item[header] = row[index];
        });
        return item;
      });

    // order 기준 오름차순 정렬
    items.sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

    return responseJSON({ success: true, data: items });
  } catch (error) {
    return responseJSON({ success: false, error: error.toString() });
  }
}

/**
 * POST 요청 처리 (Create, Update, Delete, Reorder)
 */
function doPost(e) {
  try {
    const postData = e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : null;
    const action = postData?.action || e.parameter?.action;

    if (!action) {
      return responseJSON({ success: false, error: "Action parameter is required." });
    }

    const sheet = getTargetSheet();

    // 1. CREATE: 새 메모 생성
    if (action === "create") {
      const item = postData.item || {};
      const timestamp = String(item.timestamp || new Date().getTime());
      const datetime = String(item.datetime || "");
      const category = String(item.category || "할 일");
      const content = String(item.content || "");
      const color = String(item.color || "yellow");
      const state = String(item.state || "active");
      
      const lastRow = sheet.getLastRow();
      let orderVal = 1;
      if (item.order !== undefined && item.order !== null && item.order !== "") {
        orderVal = Number(item.order);
      } else {
        orderVal = lastRow > 1 ? lastRow : 1;
      }

      // appendRow 대신 정확한 7개 열(A~G)에 명시적으로 setValues 사용
      const nextRow = lastRow + 1;
      sheet.getRange(nextRow, 1, 1, 7).setValues([[
        timestamp,
        datetime,
        category,
        content,
        color,
        state,
        orderVal
      ]]);

      return responseJSON({ success: true, message: "Created successfully", row: nextRow });
    }

    // 2. UPDATE: 메모 수정 (timestamp로 탐색)
    if (action === "update") {
      const { timestamp, datetime, category, content, color, state, order } = postData.item;
      if (!timestamp) {
        return responseJSON({ success: false, error: "Timestamp is required for update." });
      }

      const data = sheet.getDataRange().getValues();
      let rowIndex = -1;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(timestamp)) {
          rowIndex = i + 1; // 1-indexed
          break;
        }
      }

      if (rowIndex === -1) {
        return responseJSON({ success: false, error: "Item not found." });
      }

      if (datetime !== undefined) sheet.getRange(rowIndex, 2).setValue(datetime);
      if (category !== undefined) sheet.getRange(rowIndex, 3).setValue(category);
      if (content !== undefined) sheet.getRange(rowIndex, 4).setValue(content);
      if (color !== undefined) sheet.getRange(rowIndex, 5).setValue(color);
      if (state !== undefined) sheet.getRange(rowIndex, 6).setValue(state);
      if (order !== undefined) sheet.getRange(rowIndex, 7).setValue(order);

      return responseJSON({ success: true, message: "Updated successfully" });
    }

    // 3. DELETE: 메모 삭제 (timestamp로 탐색)
    if (action === "delete") {
      const { timestamp } = postData;
      if (!timestamp) {
        return responseJSON({ success: false, error: "Timestamp is required for delete." });
      }

      const data = sheet.getDataRange().getValues();
      let rowIndex = -1;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(timestamp)) {
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex === -1) {
        return responseJSON({ success: false, error: "Item not found." });
      }

      sheet.deleteRow(rowIndex);
      return responseJSON({ success: true, message: "Deleted successfully" });
    }

    // 4. REORDER: 드래그 앤 드롭 일괄 순서(order) 업데이트
    if (action === "reorder") {
      const { items } = postData; // [{ timestamp: "...", order: 1 }, ...]
      if (!Array.isArray(items)) {
        return responseJSON({ success: false, error: "Items array is required for reorder." });
      }

      const data = sheet.getDataRange().getValues();
      const map = {};
      items.forEach(it => {
        map[String(it.timestamp)] = it.order;
      });

      for (let i = 1; i < data.length; i++) {
        const rowTimestamp = String(data[i][0]);
        if (map[rowTimestamp] !== undefined) {
          sheet.getRange(i + 1, 7).setValue(map[rowTimestamp]);
        }
      }

      return responseJSON({ success: true, message: "Reordered successfully" });
    }

    return responseJSON({ success: false, error: "Invalid action." });

  } catch (error) {
    return responseJSON({ success: false, error: error.toString() });
  }
}

/**
 * CORS 지원 JSON 응답 헬퍼
 */
function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
