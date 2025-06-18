import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { BrushStroke, User, Point } from "../types/brush";

export class YjsManager {
  public doc: Y.Doc;
  public provider: WebsocketProvider;
  public strokes: Y.Array<BrushStroke>;
  public users: Y.Map<User>;
  public userId: string;

  constructor(roomId: string = "default-room") {
    console.log("🚀 YjsManager 초기화 - Room ID:", roomId);

    // Y.js Document 생성
    this.doc = new Y.Doc();

    // 개발 환경에서는 로컬 서버, 프로덕션에서는 외부 서버 사용
    const wsUrl = "ws://localhost:1234"; // 개발 환경: 로컬 서버

    console.log("🔗 WebSocket 서버 연결:", wsUrl);

    // WebSocket Provider 설정
    this.provider = new WebsocketProvider(wsUrl, roomId, this.doc);

    // 연결 상태 모니터링
    this.provider.on("status", (event: any) => {
      console.log("📡 연결 상태:", event.status);
    });

    this.provider.on("connection-close", (event: any) => {
      console.log("❌ 연결 종료:", event);
    });

    this.provider.on("connection-error", (event: any) => {
      console.log("🚨 연결 오류:", event);
    });

    // 공유 데이터 구조 정의
    this.strokes = this.doc.getArray<BrushStroke>("strokes");
    this.users = this.doc.getMap<User>("users");

    // 고유 사용자 ID 생성
    this.userId = this.generateUserId();

    console.log("👤 사용자 ID:", this.userId);

    this.initializeUser();
  }

  private generateUserId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private initializeUser(): void {
    const userColor = this.generateRandomColor();
    this.users.set(this.userId, {
      id: this.userId,
      color: userColor,
    });
  }

  private generateRandomColor(): string {
    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#FFA07A",
      "#98D8C8",
      "#F7DC6F",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  public addStroke(stroke: BrushStroke): void {
    this.strokes.push([stroke]);
  }

  public updateUserCursor(position: Point): void {
    const currentUser = this.users.get(this.userId);
    if (currentUser) {
      this.users.set(this.userId, {
        ...currentUser,
        cursor: position,
      });
    }
  }

  public destroy(): void {
    this.provider.destroy();
    this.doc.destroy();
  }
}
