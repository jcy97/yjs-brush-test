import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { BrushStroke, Point, User } from "../types/brush";

/**
 * 개별 캔버스를 관리하는 클래스
 * 각 캔버스마다 독립적인 YJS 문서와 그리기 엔진을 가집니다.
 */
export class CanvasManager {
  // YJS 관련
  public doc: Y.Doc;
  public provider: WebsocketProvider;
  public strokes: Y.Array<BrushStroke>;
  public users: Y.Map<User>;
  public userId: string;

  // Canvas 관련
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cursorsContainer: HTMLElement;

  // 그리기 상태
  private isDrawing: boolean = false;
  private currentStroke: Point[] = [];
  private brushSize: number = 5;
  private brushColor: string = "#000000";

  // 콜백들
  private onUserChangeCallback?: (users: Map<string, User>) => void;

  constructor(
    projectId: string,
    canvasId: string,
    canvas: HTMLCanvasElement,
    cursorsContainer: HTMLElement,
    persistentUserId?: string // 사용자 ID를 외부에서 받아서 재사용
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.cursorsContainer = cursorsContainer;

    // 기존 사용자 ID 재사용 또는 새로 생성
    this.userId = persistentUserId || this.generateUserId();

    console.log(
      "🎨 CanvasManager 초기화 - Project:",
      projectId,
      "Canvas:",
      canvasId,
      "User:",
      this.userId
    );

    // Y.js Document 생성
    this.doc = new Y.Doc();

    // WebSocket Provider 설정 - 캔버스별 독립적인 room
    const wsUrl = "ws://localhost:1234";
    const roomName = `project-${projectId}-canvas-${canvasId}`;

    console.log("🔗 캔버스 WebSocket 서버 연결:", wsUrl, roomName);

    this.provider = new WebsocketProvider(wsUrl, roomName, this.doc);

    // 연결 상태 모니터링
    this.provider.on("status", (event: any) => {
      console.log("📡 캔버스 연결 상태:", event.status);
    });

    // 공유 데이터 구조 정의
    this.strokes = this.doc.getArray<BrushStroke>("strokes");
    this.users = this.doc.getMap<User>("users");

    this.setupCanvas();
    this.setupEventListeners();
    this.setupYjsListeners();
    this.initializeUser();
    this.renderExistingStrokes();
  }

  private setupCanvas(): void {
    // Canvas 스타일 설정
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.imageSmoothingEnabled = true;
  }

  private setupEventListeners(): void {
    // 마우스 이벤트
    this.canvas.addEventListener("mousedown", (e) => {
      this.isDrawing = true;
      const point = this.getPointFromEvent(e);
      this.startDrawing(point);
    });

    this.canvas.addEventListener("mousemove", (e) => {
      const point = this.getPointFromEvent(e);
      this.updateUserCursor(point);

      if (this.isDrawing) {
        this.addPoint(point);
      }
    });

    this.canvas.addEventListener("mouseup", () => {
      this.endDrawing();
    });

    this.canvas.addEventListener("mouseleave", () => {
      this.endDrawing();
    });

    // 터치 이벤트 (모바일 지원)
    this.canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this.isDrawing = true;
      const point = this.getPointFromTouchEvent(e);
      this.startDrawing(point);
    });

    this.canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      const point = this.getPointFromTouchEvent(e);
      this.updateUserCursor(point);

      if (this.isDrawing) {
        this.addPoint(point);
      }
    });

    this.canvas.addEventListener("touchend", (e) => {
      e.preventDefault();
      this.endDrawing();
    });
  }

  private setupYjsListeners(): void {
    // 새로운 스트로크 추가 감지
    this.strokes.observe(() => {
      const lastIndex = this.strokes.length - 1;
      if (lastIndex >= 0) {
        const lastStroke = this.strokes.get(lastIndex);
        if (lastStroke && lastStroke.userId !== this.userId) {
          this.renderStroke(lastStroke);
        }
      }
    });

    // 사용자 커서 업데이트 감지
    this.users.observe(() => {
      this.updateCursors();
      this.onUserChangeCallback?.(new Map(this.users.entries()));
    });
  }

  private initializeUser(): void {
    // 기존 사용자 정보가 있는지 확인
    const existingUser = this.users.get(this.userId);

    if (existingUser) {
      console.log("👤 기존 사용자 정보 사용:", existingUser);
    } else {
      const userColor = this.generateRandomColor();
      const newUser: User = {
        id: this.userId,
        color: userColor,
      };
      this.users.set(this.userId, newUser);
      console.log("👤 새 사용자 생성:", newUser);
    }
  }

  private startDrawing(point: Point): void {
    this.currentStroke = [point];
  }

  private addPoint(point: Point): void {
    if (!this.isDrawing) return;

    this.currentStroke.push(point);
    if (this.currentStroke.length >= 2) {
      this.drawSegment(
        this.currentStroke[this.currentStroke.length - 2],
        point
      );
    }
  }

  private endDrawing(): void {
    if (!this.isDrawing || this.currentStroke.length < 2) {
      this.isDrawing = false;
      return;
    }

    this.isDrawing = false;

    const stroke: BrushStroke = {
      id: this.generateStrokeId(),
      points: [...this.currentStroke],
      color: this.brushColor,
      size: this.brushSize,
      timestamp: Date.now(),
      userId: this.userId,
    };

    this.strokes.push([stroke]);
    this.currentStroke = [];
  }

  private drawSegment(from: Point, to: Point): void {
    if (!from || !to) return;

    this.ctx.beginPath();
    this.ctx.moveTo(from.x, from.y);
    this.ctx.lineTo(to.x, to.y);
    this.ctx.strokeStyle = this.brushColor;
    this.ctx.lineWidth = this.brushSize;
    this.ctx.stroke();
  }

  private renderStroke(stroke: BrushStroke): void {
    if (stroke.points.length < 2) return;

    this.ctx.beginPath();
    this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

    for (let i = 1; i < stroke.points.length; i++) {
      this.ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }

    this.ctx.strokeStyle = stroke.color;
    this.ctx.lineWidth = stroke.size;
    this.ctx.stroke();
  }

  private renderExistingStrokes(): void {
    // 페이지 로드 시 기존 스트로크들을 렌더링
    this.strokes.forEach((stroke) => {
      this.renderStroke(stroke);
    });
  }

  private updateUserCursor(position: Point): void {
    const currentUser = this.users.get(this.userId);
    if (currentUser) {
      this.users.set(this.userId, {
        ...currentUser,
        cursor: position,
      });
    }
  }

  private updateCursors(): void {
    // 기존 커서 제거
    this.cursorsContainer.innerHTML = "";

    // 모든 사용자의 커서 렌더링
    this.users.forEach((user, userId) => {
      if (userId !== this.userId && user.cursor) {
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

  // Public API
  public setBrushSize(size: number): void {
    this.brushSize = size;
  }

  public setBrushColor(color: string): void {
    this.brushColor = color;
  }

  public clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // 모든 스트로크 제거 (다른 사용자들과 동기화)
    this.strokes.delete(0, this.strokes.length);
  }

  public getConnectedUsers(): Map<string, User> {
    return new Map(this.users.entries());
  }

  public onUserChange(callback: (users: Map<string, User>) => void): void {
    this.onUserChangeCallback = callback;
  }

  public resizeCanvas(width: number, height: number): void {
    // 기존 이미지 데이터 백업
    const imageData = this.ctx.getImageData(
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );

    // 캔버스 크기 조정
    this.canvas.width = width;
    this.canvas.height = height;

    // 설정 복원
    this.setupCanvas();

    // 이미지 데이터 복원
    this.ctx.putImageData(imageData, 0, 0);

    // 모든 스트로크 다시 렌더링
    this.ctx.clearRect(0, 0, width, height);
    this.renderExistingStrokes();
  }

  private generateUserId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private generateStrokeId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private generateRandomColor(): string {
    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#FFA07A",
      "#98D8C8",
      "#F7DC6F",
      "#BB8FCE",
      "#82E0AA",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  public destroy(): void {
    // 현재 사용자 정보 제거
    this.users.delete(this.userId);

    // YJS 연결 정리
    this.provider.destroy();
    this.doc.destroy();

    console.log("🗑️ CanvasManager 정리됨 - User:", this.userId);
  }
}
