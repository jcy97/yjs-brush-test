import { YjsManager } from "./core/YjsManager";
import { BrushEngine } from "./core/BrushEngine";
import { SyncManager } from "./core/SyncManager";
import { setupCanvas } from "./utils/canvas";

class CollaborativeBrushApp {
  private yjsManager: YjsManager;
  private brushEngine: BrushEngine;
  private syncManager: SyncManager;

  constructor() {
    this.initializeApp();
  }

  private initializeApp(): void {
    // DOM 요소 가져오기
    const canvas = document.getElementById("canvas") as HTMLCanvasElement;
    const cursorsContainer = document.getElementById("cursors") as HTMLElement;
    const brushSizeInput = document.getElementById(
      "brushSize"
    ) as HTMLInputElement;
    const brushColorInput = document.getElementById(
      "brushColor"
    ) as HTMLInputElement;
    const clearButton = document.getElementById(
      "clearButton"
    ) as HTMLButtonElement;
    const sizeValue = document.getElementById("sizeValue") as HTMLSpanElement;

    // Canvas 설정
    setupCanvas(canvas);

    // 핵심 클래스들 초기화
    this.yjsManager = new YjsManager(
      "brush-room-" + (window.location.hash.slice(1) || "default")
    );
    this.brushEngine = new BrushEngine(canvas);
    this.syncManager = new SyncManager(
      this.yjsManager,
      this.brushEngine,
      canvas,
      cursorsContainer
    );

    // UI 이벤트 설정
    this.setupUI(brushSizeInput, brushColorInput, clearButton, sizeValue);

    // 기존 스트로크 렌더링
    this.renderExistingStrokes();
  }

  private setupUI(
    brushSizeInput: HTMLInputElement,
    brushColorInput: HTMLInputElement,
    clearButton: HTMLButtonElement,
    sizeValue: HTMLSpanElement
  ): void {
    brushSizeInput.addEventListener("input", (e) => {
      const size = parseInt((e.target as HTMLInputElement).value);
      this.brushEngine.setBrushSize(size);
      sizeValue.textContent = size.toString();
    });

    brushColorInput.addEventListener("input", (e) => {
      const color = (e.target as HTMLInputElement).value;
      this.brushEngine.setBrushColor(color);
    });

    clearButton.addEventListener("click", () => {
      this.brushEngine.clear();
      // 모든 스트로크 제거 (다른 사용자들과 동기화)
      this.yjsManager.strokes.delete(0, this.yjsManager.strokes.length);
    });
  }

  private renderExistingStrokes(): void {
    // 페이지 로드 시 기존 스트로크들을 렌더링
    this.yjsManager.strokes.forEach((stroke) => {
      this.brushEngine.renderStroke(stroke);
    });
  }

  public destroy(): void {
    this.yjsManager.destroy();
  }
}

// 앱 시작
const app = new CollaborativeBrushApp();

// 페이지 언로드 시 정리
window.addEventListener("beforeunload", () => {
  app.destroy();
});
