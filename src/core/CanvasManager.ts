import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { BrushStroke, Point, User } from "../types/brush";

/**
 * 개별 캔버스를 관리하는 클래스
 * YJS Awareness를 사용하여 실시간 커서 추적을 개선했습니다.
 */
export class CanvasManager {
  // YJS 관련
  public doc: Y.Doc;
  public provider: WebsocketProvider;
  public strokes: Y.Array<BrushStroke>;
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
  private userColor: string;

  // 콜백들
  private onUserChangeCallback?: (users: Map<string, User>) => void;

  constructor(
    projectId: string,
    canvasId: string,
    canvas: HTMLCanvasElement,
    cursorsContainer: HTMLElement,
    persistentUserId?: string
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.cursorsContainer = cursorsContainer;

    // 기존 사용자 ID 재사용 또는 새로 생성
    this.userId = persistentUserId || this.generateUserId();
    this.userColor = this.generateRandomColor();

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

    // 공유 데이터 구조 정의 (스트로크만 Y.js로 관리)
    this.strokes = this.doc.getArray<BrushStroke>("strokes");

    this.setupCanvas();
    this.setupEventListeners();
    this.setupYjsListeners();
    this.setupAwareness();
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
      this.updateAwarenessCursor(point);
    });

    this.canvas.addEventListener("mousemove", (e) => {
      const point = this.getPointFromEvent(e);
      this.updateAwarenessCursor(point);

      if (this.isDrawing) {
        this.addPoint(point);
      }
    });

    this.canvas.addEventListener("mouseup", () => {
      this.endDrawing();
    });

    this.canvas.addEventListener("mouseleave", () => {
      this.endDrawing();
      // 마우스가 캔버스를 벗어나면 커서 숨기기
      this.updateAwarenessCursor(null);
    });

    this.canvas.addEventListener("mouseenter", (e) => {
      // 마우스가 캔버스에 다시 들어오면 커서 표시
      const point = this.getPointFromEvent(e);
      this.updateAwarenessCursor(point);
    });

    // 터치 이벤트 (모바일 지원)
    this.canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this.isDrawing = true;
      const point = this.getPointFromTouchEvent(e);
      this.startDrawing(point);
      this.updateAwarenessCursor(point);
    });

    this.canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      const point = this.getPointFromTouchEvent(e);
      this.updateAwarenessCursor(point);

      if (this.isDrawing) {
        this.addPoint(point);
      }
    });

    this.canvas.addEventListener("touchend", (e) => {
      e.preventDefault();
      this.endDrawing();
      this.updateAwarenessCursor(null);
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
  }

  private setupAwareness(): void {
    // Awareness 초기 상태 설정
    this.provider.awareness.setLocalStateField("user", {
      id: this.userId,
      color: this.userColor,
      cursor: null,
    });

    // Awareness 변경 감지
    this.provider.awareness.on("change", () => {
      this.updateCursors();
      this.updateUserList();
    });

    console.log(
      "👁️ Awareness 설정 완료 - User:",
      this.userId,
      "Color:",
      this.userColor
    );
  }

  private updateAwarenessCursor(position: Point | null): void {
    const currentState = this.provider.awareness.getLocalState();
    this.provider.awareness.setLocalStateField("user", {
      ...currentState?.user,
      cursor: position,
    });
  }

  private updateCursors(): void {
    // 기존 커서 제거
    this.cursorsContainer.innerHTML = "";

    // 모든 연결된 사용자의 커서 렌더링
    this.provider.awareness.getStates().forEach((state, clientId) => {
      // 자신의 커서는 표시하지 않음
      if (clientId === this.provider.awareness.clientID) return;

      const user = state.user;
      if (user && user.cursor) {
        this.renderUserCursor(user);
      }
    });
  }

  private updateUserList(): void {
    const users = new Map<string, User>();

    this.provider.awareness.getStates().forEach((state) => {
      const user = state.user;
      if (user) {
        users.set(user.id, {
          id: user.id,
          color: user.color,
          cursor: user.cursor,
        });
      }
    });

    this.onUserChangeCallback?.(users);
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
      transition: all 0.1s ease-out;
    `;

    // 사용자 이름 툴팁 추가
    cursor.title = `사용자 ${user.id}`;

    this.cursorsContainer.appendChild(cursor);
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
    const users = new Map<string, User>();

    this.provider.awareness.getStates().forEach((state) => {
      const user = state.user;
      if (user) {
        users.set(user.id, {
          id: user.id,
          color: user.color,
          cursor: user.cursor,
        });
      }
    });

    return users;
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
      "#FF6B6B", // 레드
      "#4ECDC4", // 터콰이즈
      "#45B7D1", // 블루
      "#FFA07A", // 라이트 살몬
      "#98D8C8", // 아쿠아마린
      "#F7DC6F", // 옐로우
      "#BB8FCE", // 퍼플
      "#82E0AA", // 그린
      "#F8C471", // 오렌지
      "#85C1E9", // 라이트 블루
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  public destroy(): void {
    // Awareness에서 사용자 제거
    this.provider.awareness.setLocalStateField("user", null);

    // 커서 컨테이너 정리
    this.cursorsContainer.innerHTML = "";

    // YJS 연결 정리
    this.provider.destroy();
    this.doc.destroy();

    console.log("🗑️ CanvasManager 정리됨 - User:", this.userId);
  }

  // getUserId를 외부에서 접근할 수 있도록 추가
  public getUserId(): string {
    return this.userId;
  }
}
