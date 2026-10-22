"use client";

import { useState, useEffect, useRef } from "react";
import {
  fetchTodosFromSheet,
  executeSheetAction,
  SheetTodoItem,
} from "@/lib/sheetApi";

type ColorType = "yellow" | "pink" | "green" | "blue";

// 메모에 사용할 카테고리: 할 일, 아이디어, 기타 (필터에는 '전체' 포함)
const CATEGORIES = ["할 일", "아이디어", "기타"] as const;
type CategoryType = (typeof CATEGORIES)[number];
const FILTER_CATEGORIES = ["전체", ...CATEGORIES] as const;
type FilterCategoryType = (typeof FILTER_CATEGORIES)[number];

interface TodoItem {
  id: string; // timestamp에 대응
  content: string;
  category: CategoryType;
  color: ColorType;
  createdAt: string; // datetime
  rotation: number;
  order: number;
  state: string;
}

const COLOR_STYLES: Record<
  ColorType,
  {
    bg: string;
    border: string;
    tag: string;
    tape: string;
  }
> = {
  yellow: {
    bg: "bg-[#fff885] dark:bg-[#ecd847] text-stone-900",
    border: "border-amber-300/70 dark:border-amber-500/50",
    tag: "bg-amber-100/90 text-amber-900 border-amber-300",
    tape: "bg-amber-100/70 dark:bg-amber-200/50",
  },
  pink: {
    bg: "bg-[#ffb7d5] dark:bg-[#e890b5] text-stone-900",
    border: "border-rose-300/70 dark:border-rose-500/50",
    tag: "bg-rose-100/90 text-rose-900 border-rose-300",
    tape: "bg-rose-100/70 dark:bg-rose-200/50",
  },
  green: {
    bg: "bg-[#bbf7d0] dark:bg-[#86efac] text-stone-900",
    border: "border-emerald-300/70 dark:border-emerald-500/50",
    tag: "bg-emerald-100/90 text-emerald-900 border-emerald-300",
    tape: "bg-emerald-100/70 dark:bg-emerald-200/50",
  },
  blue: {
    bg: "bg-[#bae6fd] dark:bg-[#7dd3fc] text-stone-900",
    border: "border-sky-300/70 dark:border-sky-500/50",
    tag: "bg-sky-100/90 text-sky-900 border-sky-300",
    tape: "bg-sky-100/70 dark:bg-sky-200/50",
  },
};

const COLORS: ColorType[] = ["yellow", "pink", "green", "blue"];

function formatCurrentDateTime(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  const daysOfWeek = ["일", "월", "화", "수", "목", "금", "토"];
  const dayOfWeek = daysOfWeek[now.getDay()];

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `${year}.${month}.${day} (${dayOfWeek}) ${hours}:${minutes}`;
}

export default function Home() {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<CategoryType>("할 일");
  const [selectedFilter, setSelectedFilter] = useState<FilterCategoryType>("전체");
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // 구글 시트 동기화 상태
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">("idle");

  // 편집 모달 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState<CategoryType>("할 일");

  // 드래그 앤 드롭 상태
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // 터치 기반 드래그 앤 드롭 (모바일)
  const touchState = useRef<{
    activeId: string | null;
    startX: number;
    startY: number;
  }>({
    activeId: null,
    startX: 0,
    startY: 0,
  });

  // 초기 로드: 테마 설정 및 구글 시트 연동 데이터 가져오기
  useEffect(() => {
    setMounted(true);

    // 테마 설정 복원
    const savedTheme = localStorage.getItem("postit_theme");
    const isDark = savedTheme === "dark";
    setIsDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
      document.body.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
      document.body.classList.remove("dark");
    }

    // 로컬 스토리지 데이터 먼저 빠르게 렌더링
    const savedTodos = localStorage.getItem("postit_todos");
    if (savedTodos) {
      try {
        setTodos(JSON.parse(savedTodos));
      } catch (e) {
        console.error("Failed to parse cached todos", e);
      }
    }

    // 구글 시트로부터 최신 데이터 동기화
    loadTodosFromSheet();
  }, []);

  // 구글 시트 데이터 로드 함수
  const loadTodosFromSheet = async () => {
    setSyncing(true);
    try {
      const sheetData = await fetchTodosFromSheet();
      if (Array.isArray(sheetData)) {
        const mapped: TodoItem[] = sheetData.map((item, idx) => ({
          id: String(item.timestamp || Date.now() + idx),
          content: item.content || "",
          category: (CATEGORIES.includes(item.category as any)
            ? item.category
            : "할 일") as CategoryType,
          color: (COLORS.includes(item.color as any)
            ? item.color
            : "yellow") as ColorType,
          createdAt: item.datetime || formatCurrentDateTime(),
          rotation: Number((Math.random() * 4 - 2).toFixed(1)),
          order: Number(item.order ?? idx),
          state: item.state || "active",
        }));

        mapped.sort((a, b) => a.order - b.order);
        setTodos(mapped);
        localStorage.setItem("postit_todos", JSON.stringify(mapped));
      }
      setSyncStatus("success");
    } catch (err) {
      console.error(err);
      setSyncStatus("error");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncStatus("idle"), 3000);
    }
  };

  // 로컬 스토리지 백업 캐시 저장
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("postit_todos", JSON.stringify(todos));
    }
  }, [todos, mounted]);

  // 테마 토글 핸들러
  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
      document.body.classList.add("dark");
      localStorage.setItem("postit_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
      document.body.classList.remove("dark");
      localStorage.setItem("postit_theme", "light");
    }
  };

  // 새 메모 추가 (Create)
  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;

    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    const randomRotation = Number((Math.random() * 4 - 2).toFixed(1));
    const newTimestamp = String(Date.now());
    const newDateTime = formatCurrentDateTime();
    const newOrder = todos.length > 0 ? Math.max(...todos.map((t) => t.order)) + 1 : 1;

    const newTodo: TodoItem = {
      id: newTimestamp,
      content: trimmed,
      category,
      color: randomColor,
      createdAt: newDateTime,
      rotation: randomRotation,
      order: newOrder,
      state: "active",
    };

    // UI 우선 반영
    setTodos((prev) => [newTodo, ...prev]);
    setContent("");

    // 구글 시트에 비동기 Create 요청
    setSyncing(true);
    executeSheetAction({
      action: "create",
      item: {
        timestamp: newTimestamp,
        datetime: newDateTime,
        category,
        content: trimmed,
        color: randomColor,
        state: "active",
        order: newOrder,
      },
    }).finally(() => {
      setSyncing(false);
    });
  };

  // 메모 삭제 (Delete): confirm 팝업 없이 즉시 제거 및 구글 시트 반영
  const handleDelete = async (id: string) => {
    // UI에서 즉시 제거
    setTodos((prev) => prev.filter((item) => item.id !== id));
    if (editingId === id) setEditingId(null);

    // 구글 시트에 비동기 Delete 요청
    setSyncing(true);
    executeSheetAction({
      action: "delete",
      timestamp: id,
    }).finally(() => {
      setSyncing(false);
    });
  };

  // 편집 시작
  const startEditing = (todo: TodoItem) => {
    setEditingId(todo.id);
    setEditContent(todo.content);
    setEditCategory(todo.category);
  };

  // 편집 저장 (Update)
  const saveEditing = async () => {
    if (!editingId) return;
    const trimmed = editContent.trim();
    if (!trimmed) {
      alert("내용을 입력해주세요.");
      return;
    }

    const currentItem = todos.find((t) => t.id === editingId);
    if (!currentItem) return;

    // UI 우선 업데이트
    setTodos((prev) =>
      prev.map((item) =>
        item.id === editingId
          ? {
              ...item,
              content: trimmed,
              category: editCategory,
            }
          : item
      )
    );
    setEditingId(null);

    // 구글 시트에 비동기 Update 요청
    setSyncing(true);
    executeSheetAction({
      action: "update",
      item: {
        timestamp: currentItem.id,
        datetime: currentItem.createdAt,
        category: editCategory,
        content: trimmed,
        color: currentItem.color,
        state: currentItem.state,
        order: currentItem.order,
      },
    }).finally(() => {
      setSyncing(false);
    });
  };

  // 편집 취소
  const cancelEditing = () => {
    setEditingId(null);
  };

  // 드래그 앤 드롭 완료 후 순서 동기화
  const syncReorderToSheet = (newTodos: TodoItem[]) => {
    const items = newTodos.map((item, index) => ({
      timestamp: item.id,
      order: index + 1,
    }));

    executeSheetAction({
      action: "reorder",
      items,
    });
  };

  // 드래그 앤 드롭 (Desktop)
  const handleDragStart = (id: string) => {
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (draggedId !== id) {
      setDragOverId(id);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    setTodos((prev) => {
      const sourceIndex = prev.findIndex((item) => item.id === draggedId);
      const targetIndex = prev.findIndex((item) => item.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return prev;

      const updated = [...prev];
      const [removed] = updated.splice(sourceIndex, 1);
      updated.splice(targetIndex, 0, removed);
      
      const ordered = updated.map((item, idx) => ({ ...item, order: idx + 1 }));
      syncReorderToSheet(ordered);
      return ordered;
    });

    setDraggedId(null);
    setDragOverId(null);
  };

  // 터치 기반 드래그 앤 드롭 (모바일)
  const handleTouchStart = (id: string, e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchState.current = {
      activeId: id,
      startX: touch.clientX,
      startY: touch.clientY,
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const activeId = touchState.current.activeId;
    if (!activeId) return;

    const changedTouch = e.changedTouches[0];
    const element = document.elementFromPoint(
      changedTouch.clientX,
      changedTouch.clientY
    );
    const dropTarget = element?.closest("[data-todo-id]");
    const targetId = dropTarget?.getAttribute("data-todo-id");

    if (targetId && targetId !== activeId) {
      setTodos((prev) => {
        const sourceIndex = prev.findIndex((item) => item.id === activeId);
        const targetIndex = prev.findIndex((item) => item.id === targetId);
        if (sourceIndex === -1 || targetIndex === -1) return prev;

        const updated = [...prev];
        const [removed] = updated.splice(sourceIndex, 1);
        updated.splice(targetIndex, 0, removed);

        const ordered = updated.map((item, idx) => ({ ...item, order: idx + 1 }));
        syncReorderToSheet(ordered);
        return ordered;
      });
    }

    touchState.current = { activeId: null, startX: 0, startY: 0 };
    setDraggedId(null);
    setDragOverId(null);
  };

  // 필터링 적용된 목록
  const filteredTodos = todos.filter((todo) => {
    if (selectedFilter === "전체") return true;
    return todo.category === selectedFilter;
  });

  return (
    <div
      className={`min-h-screen flex flex-col justify-between transition-colors duration-300 selection:bg-amber-200 ${
        isDarkMode
          ? "bg-[#181614] text-stone-100 dark"
          : "bg-[#f3ede2] text-stone-800"
      }`}
    >
      {/* 상단 네비게이션 & 컨트롤 영역 */}
      <header className="pt-8 pb-4 text-center px-4 relative max-w-7xl mx-auto w-full">
        {/* 우측 상단: 구글 시트 동기화 상태 & 다크/라이트 모드 버튼 */}
        <div className="flex items-center justify-end gap-2 mb-3 sm:mb-0 sm:absolute sm:right-4 sm:top-8">
          {/* 구글 시트 동기화 새로고침 버튼 */}
          <button
            onClick={loadTodosFromSheet}
            disabled={syncing}
            title="구글 시트와 동기화"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 shadow-xs hover:shadow text-xs font-semibold transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            <span className={syncing ? "animate-spin" : ""}>🔄</span>
            <span className="hidden sm:inline">
              {syncing ? "시트 동기화 중..." : "시트 동기화"}
            </span>
          </button>

          {/* 테마 스위치 */}
          <button
            onClick={toggleTheme}
            aria-label={isDarkMode ? "라이트 모드로 전환" : "다크 모드로 전환"}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-stone-200/80 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 shadow-sm hover:shadow text-xs sm:text-sm font-semibold transition-all hover:scale-105 active:scale-95"
          >
            {isDarkMode ? (
              <>
                <span className="text-amber-400 text-base">☀️</span>
                <span className="text-stone-200">라이트 모드</span>
              </>
            ) : (
              <>
                <span className="text-indigo-600 text-base">🌙</span>
                <span className="text-stone-700">다크 모드</span>
              </>
            )}
          </button>
        </div>

        {/* 메인 페이지 제목 */}
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-stone-900 dark:text-stone-50 drop-shadow-sm flex items-center justify-center gap-2 mt-2">
          <span>📌</span>
          <span>Post-it Todo List</span>
        </h1>
        <p className="mt-2 text-sm sm:text-base text-stone-600 dark:text-stone-400">
          구글 시트와 실시간 연동되는 나만의 포스트잇 보드
        </p>

        {/* 상태 배지 */}
        {syncStatus === "success" && (
          <div className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-fadeIn">
            ✓ 구글 시트와 성공적으로 동기화되었습니다.
          </div>
        )}
      </header>

      {/* 메인 콘텐츠 영역 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 w-full flex-1">
        {/* 가운데 메모 입력 폼 */}
        <div className="max-w-xl mx-auto mb-10">
          <form
            onSubmit={handleAddTodo}
            className="bg-white/95 dark:bg-stone-900/90 backdrop-blur-sm p-5 sm:p-6 rounded-2xl shadow-xl border border-stone-200/80 dark:border-stone-800 transition-all hover:shadow-2xl"
          >
            <div className="flex flex-col gap-3">
              <label
                htmlFor="memo-input"
                className="text-sm font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5"
              >
                <span>✏️</span> 새로운 메모 작성
              </label>

              <textarea
                id="memo-input"
                rows={3}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="어떤 할 일이 있나요? 메모 내용을 입력해 보세요..."
                className="w-full resize-none rounded-xl border border-stone-300 dark:border-stone-700 p-3.5 text-stone-800 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200/60 dark:focus:ring-amber-500/40 text-sm sm:text-base transition-all bg-stone-50/70 dark:bg-stone-800/80 focus:bg-white dark:focus:bg-stone-800"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    handleAddTodo(e);
                  }
                }}
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {/* 메모 생성 범주 선택 */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                    카테고리
                  </span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as CategoryType)}
                    className="rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-1.5 text-xs sm:text-sm font-medium text-stone-700 dark:text-stone-200 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-500/30 cursor-pointer"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 붙이기 버튼 */}
                <button
                  type="submit"
                  disabled={!content.trim()}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-semibold text-sm sm:text-base shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                >
                  <span>착! 붙이기</span>
                  <span>📎</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* 카테고리 필터링 드롭다운 메뉴 및 정보 바 */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 bg-white/70 dark:bg-stone-900/60 backdrop-blur-sm p-4 rounded-xl border border-stone-200/70 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1">
              <span>🔍</span> 카테고리 필터:
            </span>
            <select
              value={selectedFilter}
              onChange={(e) =>
                setSelectedFilter(e.target.value as FilterCategoryType)
              }
              className="rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-1.5 text-sm font-semibold text-stone-800 dark:text-stone-200 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-500/30 cursor-pointer"
            >
              {FILTER_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === "전체" ? "전체 보기" : cat}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 font-medium">
            총 <span className="font-bold text-amber-600 dark:text-amber-400">{filteredTodos.length}</span>개의 포스트잇
            {selectedFilter !== "전체" && ` (${selectedFilter})`}
          </div>
        </div>

        {/* 한 행에 최대 4개 배치되는 포스트잇 메모 그리드 (드래그 앤 드롭 지원) */}
        <section aria-label="메모 목록" className="pb-16">
          {filteredTodos.length === 0 ? (
            <div className="text-center py-20 text-stone-400 dark:text-stone-600">
              <p className="text-5xl mb-3">📋</p>
              <p className="text-lg font-medium">
                {selectedFilter === "전체"
                  ? "등록된 포스트잇이 없습니다."
                  : `'${selectedFilter}' 카테고리에 해당하는 메모가 없습니다.`}
              </p>
              <p className="text-sm mt-1">새로운 메모를 작성하여 보드에 붙여보세요!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-7 items-start">
              {filteredTodos.map((todo) => {
                const style = COLOR_STYLES[todo.color];
                const isDragging = draggedId === todo.id;
                const isOver = dragOverId === todo.id;

                return (
                  <article
                    key={todo.id}
                    data-todo-id={todo.id}
                    draggable
                    onDragStart={() => handleDragStart(todo.id)}
                    onDragOver={(e) => handleDragOver(e, todo.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={() => handleDrop(todo.id)}
                    onTouchStart={(e) => handleTouchStart(todo.id, e)}
                    onTouchEnd={handleTouchEnd}
                    style={{
                      ["--postit-rot" as string]: `${todo.rotation}deg`,
                      transform: isDragging
                        ? "scale(1.05) rotate(0deg)"
                        : `rotate(${todo.rotation}deg)`,
                    }}
                    className={`relative flex flex-col justify-between aspect-square p-5 rounded-sm shadow-md transition-all duration-300 hover:scale-105 hover:z-20 hover:shadow-2xl animate-stick-on cursor-grab active:cursor-grabbing ${
                      style.bg
                    } border-t-8 border-l border-r border-b ${style.border} ${
                      isDragging ? "opacity-50 ring-4 ring-amber-400 z-30" : ""
                    } ${isOver ? "ring-2 ring-blue-500 scale-105" : ""}`}
                  >
                    {/* 상단 테이프 연출 (드래그 핸들 역할) */}
                    <div
                      className={`absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 ${style.tape} backdrop-blur-[1px] opacity-80 shadow-sm transform -rotate-1 pointer-events-none rounded-[1px] border-t border-b border-black/10`}
                      title="드래그하여 순서를 이동할 수 있습니다"
                    />

                    {/* 카드 헤더: 카테고리 배지 & [편집, 삭제] 버튼 */}
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shadow-2xs ${style.tag}`}
                      >
                        {todo.category}
                      </span>

                      {/* 액션 버튼들 (편집, 삭제) */}
                      <div className="flex items-center gap-1">
                        {/* 편집 버튼 */}
                        <button
                          onClick={() => startEditing(todo)}
                          className="text-stone-600 hover:text-stone-900 dark:text-stone-700 dark:hover:text-stone-950 transition-colors p-1 rounded hover:bg-black/10"
                          title="메모 편집"
                          aria-label="메모 편집"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </button>

                        {/* 삭제 버튼 */}
                        <button
                          onClick={() => handleDelete(todo.id)}
                          className="text-stone-600 hover:text-rose-700 dark:text-stone-700 dark:hover:text-rose-900 transition-colors p-1 rounded hover:bg-black/10"
                          title="메모 삭제"
                          aria-label="메모 삭제"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* 메모 본문 내용 */}
                    <div className="flex-1 overflow-y-auto pr-1 text-stone-900 text-sm sm:text-base font-medium leading-relaxed whitespace-pre-wrap break-words">
                      {todo.content}
                    </div>

                    {/* 왼쪽 하단: 작성한 연월일 시간 요일을 작은 글씨로 흐릿하게 표시 */}
                    <footer className="pt-2 mt-2 border-t border-black/10 flex items-center justify-between">
                      <time className="text-[11px] text-stone-700/60 dark:text-stone-800/70 font-mono tracking-tight select-none">
                        {todo.createdAt}
                      </time>
                      <span className="text-[10px] text-stone-600/50 select-none hidden sm:inline">
                        ⠿ 드래그 이동
                      </span>
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* 메모 편집 모달 다이얼로그 */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-stone-200 dark:border-stone-700">
            <h3 className="text-lg font-bold text-stone-800 dark:text-stone-100 mb-4 flex items-center gap-2">
              <span>📝</span> 메모 수정
            </h3>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1 block">
                  카테고리 변경
                </label>
                <select
                  value={editCategory}
                  onChange={(e) =>
                    setEditCategory(e.target.value as CategoryType)
                  }
                  className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 px-3 py-2 text-sm text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1 block">
                  메모 내용
                </label>
                <textarea
                  rows={4}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full rounded-xl border border-stone-300 dark:border-stone-700 p-3 text-sm text-stone-800 dark:text-stone-200 bg-stone-50 dark:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={saveEditing}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow transition-all"
                >
                  수정 완료
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer 영역 */}
      <footer className="w-full border-t border-stone-300/60 dark:border-stone-800 py-6 px-4 text-center bg-stone-200/40 dark:bg-stone-950/40 transition-colors">
        <p className="text-xs sm:text-sm font-medium text-stone-600 dark:text-stone-400">
          Copyright INU Post-it Todo List by 정채린
        </p>
      </footer>
    </div>
  );
}
