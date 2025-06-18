import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

export interface ProjectCanvas {
  id: string;
  name: string;
  createdAt: number;
  lastModified: number;
}

export interface ProjectData {
  id: string;
  name: string;
  canvases: ProjectCanvas[];
  createdAt: number;
}

/**
 * 프로젝트 메타데이터 관리 클래스
 * 프로젝트의 캔버스 목록과 사용자 현재 위치를 관리합니다.
 */
export class ProjectManager {
  public doc: Y.Doc;
  public provider: WebsocketProvider;
  public canvases: Y.Array<ProjectCanvas>;
  public userLocations: Y.Map<string>; // userId -> canvasId
  public projectId: string;

  private onCanvasListChangeCallback?: () => void;
  private onUserLocationChangeCallback?: () => void;

  constructor(projectId: string) {
    this.projectId = projectId;

    console.log("🚀 ProjectManager 초기화 - Project ID:", projectId);

    // 프로젝트 메타데이터용 Y.Doc
    this.doc = new Y.Doc();

    // 프로젝트 메타데이터용 WebSocket 연결
    const wsUrl = "ws://localhost:1234";
    const roomName = `project-meta-${projectId}`;

    console.log("🔗 프로젝트 메타데이터 서버 연결:", wsUrl, roomName);

    this.provider = new WebsocketProvider(wsUrl, roomName, this.doc);

    // 연결 상태 모니터링
    this.provider.on("status", (event: any) => {
      console.log("📡 프로젝트 메타데이터 연결 상태:", event.status);
    });

    // 공유 데이터 구조
    this.canvases = this.doc.getArray<ProjectCanvas>("canvases");
    this.userLocations = this.doc.getMap<string>("userLocations");

    this.setupEventListeners();
    this.initializeDefaultCanvas();
  }

  private setupEventListeners(): void {
    // 캔버스 목록 변경 감지
    this.canvases.observe(() => {
      console.log("📋 캔버스 목록 변경됨:", this.getCanvasList());
      this.onCanvasListChangeCallback?.();
    });

    // 사용자 위치 변경 감지
    this.userLocations.observe(() => {
      console.log(
        "👥 사용자 위치 변경됨:",
        Object.fromEntries(this.userLocations.entries())
      );
      this.onUserLocationChangeCallback?.();
    });
  }

  private initializeDefaultCanvas(): void {
    // YJS 문서가 완전히 로드될 때까지 대기 후 기본 캔버스 확인
    setTimeout(() => {
      if (this.canvases.length === 0) {
        console.log("🎨 기본 캔버스 생성");
        this.addCanvas("메인 캔버스");
      } else {
        console.log("📋 기존 캔버스 발견:", this.canvases.length, "개");
      }
    }, 500);
  }

  public addCanvas(name: string): string {
    const canvasId = this.generateCanvasId();
    const canvas: ProjectCanvas = {
      id: canvasId,
      name,
      createdAt: Date.now(),
      lastModified: Date.now(),
    };

    this.canvases.push([canvas]);
    console.log("🎨 새 캔버스 추가됨:", canvas);

    return canvasId;
  }

  public removeCanvas(canvasId: string): boolean {
    const index = this.canvases.toArray().findIndex((c) => c.id === canvasId);
    if (index !== -1) {
      this.canvases.delete(index, 1);

      // 해당 캔버스에 있던 사용자들의 위치 정보 제거
      const usersToRemove: string[] = [];
      this.userLocations.forEach((location, userId) => {
        if (location === canvasId) {
          usersToRemove.push(userId);
        }
      });

      usersToRemove.forEach((userId) => {
        this.userLocations.delete(userId);
      });

      console.log("🗑️ 캔버스 삭제됨:", canvasId);
      return true;
    }
    return false;
  }

  public updateCanvasLastModified(canvasId: string): void {
    const canvases = this.canvases.toArray();
    const index = canvases.findIndex((c) => c.id === canvasId);

    if (index !== -1) {
      const canvas = { ...canvases[index], lastModified: Date.now() };
      this.canvases.delete(index, 1);
      this.canvases.insert(index, [canvas]);
    }
  }

  public setUserLocation(userId: string, canvasId: string | null): void {
    if (canvasId === null) {
      this.userLocations.delete(userId);
    } else {
      this.userLocations.set(userId, canvasId);
    }
  }

  public getUsersInCanvas(canvasId: string): string[] {
    const users: string[] = [];
    this.userLocations.forEach((location, userId) => {
      if (location === canvasId) {
        users.push(userId);
      }
    });
    return users;
  }

  public getCanvasList(): ProjectCanvas[] {
    return this.canvases
      .toArray()
      .sort((a, b) => b.lastModified - a.lastModified);
  }

  public getCanvas(canvasId: string): ProjectCanvas | undefined {
    return this.canvases.toArray().find((c) => c.id === canvasId);
  }

  public onCanvasListChange(callback: () => void): void {
    this.onCanvasListChangeCallback = callback;
  }

  public onUserLocationChange(callback: () => void): void {
    this.onUserLocationChangeCallback = callback;
  }

  private generateCanvasId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  public destroy(): void {
    this.provider.destroy();
    this.doc.destroy();
  }
}
