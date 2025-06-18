import { YjsManager } from "./YjsManager";
import { BrushEngine } from "./BrushEngine";
import { BrushStroke, Point, User } from "../types/brush";

export class SyncManager {
  private yjsManager: YjsManager;
  private brushEngine: BrushEngine;
  private canvas: HTMLCanvasElement;
  private cursorsContainer: HTMLElement;

  constructor(
    yjsManager: YjsManager,
    brushEngine: BrushEngine,
    canvas: HTMLCanvasElement,
    cursorsContainer: HTMLElement
  ) {
    this.yjsManager = yjsManager;
    this.brushEngine = brushEngine;
    this.canvas = canvas;
    this.cursorsContainer = cursorsContainer;

    this.setupEventListeners();
    this.setupYjsListeners();
  }

  private setupEventListeners(): void {
    let isDrawing = false;

    // 마우스 이벤트
    this.canvas.addEventListener("mousedown", (e) => {
      isDrawing = true;
      const point = this.getPointFromEvent(e);
      this.brushEngine.startDrawing(point);
    });

    this.canvas.addEventListener("mousemove", (e) => {
      const point = this.getPointFromEvent(e);

      // 커서 위치 업데이트
      this.yjsManager.updateUserCursor(point);

      if (isDrawing) {
        this.brushEngine.addPoint(point);
      }
    });

    this.canvas.addEventListener("mouseup", () => {
      if (isDrawing) {
        const stroke = this.brushEngine.endDrawing();
        if (stroke) {
          stroke.userId = this.yjsManager.userId;
          this.yjsManager.addStroke(stroke);
        }
        isDrawing = false;
      }
    });

    // 터치 이벤트 (모바일 지원)
    this.canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      isDrawing = true;
      const point = this.getPointFromTouchEvent(e);
      this.brushEngine.startDrawing(point);
    });

    this.canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      const point = this.getPointFromTouchEvent(e);

      this.yjsManager.updateUserCursor(point);

      if (isDrawing) {
        this.brushEngine.addPoint(point);
      }
    });

    this.canvas.addEventListener("touchend", (e) => {
      e.preventDefault();
      if (isDrawing) {
        const stroke = this.brushEngine.endDrawing();
        if (stroke) {
          stroke.userId = this.yjsManager.userId;
          this.yjsManager.addStroke(stroke);
        }
        isDrawing = false;
      }
    });
  }

  private setupYjsListeners(): void {
    // 새로운 스트로크 추가 감지 - 더 간단한 방법
    this.yjsManager.strokes.observe(() => {
      // 마지막에 추가된 스트로크만 렌더링
      const lastIndex = this.yjsManager.strokes.length - 1;
      if (lastIndex >= 0) {
        const lastStroke = this.yjsManager.strokes.get(lastIndex);
        if (lastStroke && lastStroke.userId !== this.yjsManager.userId) {
          this.brushEngine.renderStroke(lastStroke);
        }
      }
    });

    // 사용자 커서 업데이트 감지
    this.yjsManager.users.observe(() => {
      this.updateCursors();
    });
  }

  private getPointFromEvent(e: MouseEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  private getPointFromTouchEvent(e: TouchEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    const touch = e.touches[0];
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  }

  private updateCursors(): void {
    // 기존 커서 제거
    this.cursorsContainer.innerHTML = "";

    // 모든 사용자의 커서 렌더링
    this.yjsManager.users.forEach((user, userId) => {
      if (userId !== this.yjsManager.userId && user.cursor) {
        this.renderUserCursor(user);
      }
    });
  }

  private renderUserCursor(user: User): void {
    if (!user.cursor) return;

    const cursor = document.createElement("div");
    cursor.className = "user-cursor";
    cursor.style.cssText = `
      position: absolute;
      left: ${user.cursor.x}px;
      top: ${user.cursor.y}px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background-color: ${user.color};
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      pointer-events: none;
      transform: translate(-50%, -50%);
      z-index: 1000;
    `;

    this.cursorsContainer.appendChild(cursor);
  }
}
