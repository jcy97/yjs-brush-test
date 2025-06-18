import { ProjectManager, ProjectCanvas } from "./core/ProjectManager";
import { CanvasManager } from "./core/CanvasManager";
import { setupCanvas } from "./utils/canvas";
import { User } from "./types/brush";

class MultiCanvasApp {
  private projectManager: ProjectManager;
  private currentCanvasManager: CanvasManager | null = null;
  private currentCanvasId: string | null = null;
  private projectId: string;
  private persistentUserId: string; // 세션 동안 유지되는 사용자 ID

  // DOM 요소들
  private canvas: HTMLCanvasElement;
  private cursorsContainer: HTMLElement;
  private canvasList: HTMLElement;
  private canvasTitle: HTMLElement;
  private onlineUsers: HTMLElement;
  private toolbar: HTMLElement;
  private emptyState: HTMLElement;
  private canvasWorkspace: HTMLElement;

  // UI 컨트롤들
  private brushSizeInput: HTMLInputElement;
  private brushColorInput: HTMLInputElement;
  private clearButton: HTMLButtonElement;
  private deleteCanvasButton: HTMLButtonElement;
  private sizeValue: HTMLSpanElement;
  private addCanvasBtn: HTMLButtonElement;
  private projectIdElement: HTMLElement;

  // 모달 관련
  private addCanvasModal: HTMLElement;
  private canvasNameInput: HTMLInputElement;
  private confirmAddCanvas: HTMLButtonElement;
  private cancelAddCanvas: HTMLButtonElement;

  constructor() {
    this.projectId = this.getProjectIdFromUrl();
    this.persistentUserId = this.generateUserId(); // 세션 동안 유지되는 사용자 ID
    this.initializeDOM();
    this.initializeProject();
    this.setupEventListeners();
    this.setupModal();
  }

  private getProjectIdFromUrl(): string {
    // URL에서 프로젝트 ID 추출 (예: #project-123)
    const hash = window.location.hash.slice(1);
    if (hash.startsWith("project-")) {
      return hash.substring(8);
    }
    // 기본 프로젝트 ID 생성
    const projectId = "default-" + Date.now().toString(36);
    window.location.hash = `project-${projectId}`;
    return projectId;
  }

  private initializeDOM(): void {
    // DOM 요소들 가져오기
    this.canvas = document.getElementById("canvas") as HTMLCanvasElement;
    this.cursorsContainer = document.getElementById("cursors") as HTMLElement;
    this.canvasList = document.getElementById("canvasList") as HTMLElement;
    this.canvasTitle = document.getElementById("canvasTitle") as HTMLElement;
    this.onlineUsers = document.getElementById("onlineUsers") as HTMLElement;
    this.toolbar = document.getElementById("toolbar") as HTMLElement;
    this.emptyState = document.getElementById("emptyState") as HTMLElement;
    this.canvasWorkspace = document.getElementById(
      "canvasWorkspace"
    ) as HTMLElement;

    // UI 컨트롤들
    this.brushSizeInput = document.getElementById(
      "brushSize"
    ) as HTMLInputElement;
    this.brushColorInput = document.getElementById(
      "brushColor"
    ) as HTMLInputElement;
    this.clearButton = document.getElementById(
      "clearButton"
    ) as HTMLButtonElement;
    this.deleteCanvasButton = document.getElementById(
      "deleteCanvasButton"
    ) as HTMLButtonElement;
    this.sizeValue = document.getElementById("sizeValue") as HTMLSpanElement;
    this.addCanvasBtn = document.getElementById(
      "addCanvasBtn"
    ) as HTMLButtonElement;
    this.projectIdElement = document.getElementById("projectId") as HTMLElement;

    // 모달 관련
    this.addCanvasModal = document.getElementById(
      "addCanvasModal"
    ) as HTMLElement;
    this.canvasNameInput = document.getElementById(
      "canvasNameInput"
    ) as HTMLInputElement;
    this.confirmAddCanvas = document.getElementById(
      "confirmAddCanvas"
    ) as HTMLButtonElement;
    this.cancelAddCanvas = document.getElementById(
      "cancelAddCanvas"
    ) as HTMLButtonElement;

    // Canvas 설정
    setupCanvas(this.canvas);

    // 프로젝트 ID 표시
    this.projectIdElement.textContent = `프로젝트 ID: ${this.projectId}`;
  }

  private initializeProject(): void {
    console.log("🚀 MultiCanvasApp 초기화 - Project ID:", this.projectId);

    // 프로젝트 매니저 초기화
    this.projectManager = new ProjectManager(this.projectId);

    // 프로젝트 이벤트 리스너 설정
    this.projectManager.onCanvasListChange(() => {
      this.updateCanvasList();
    });

    this.projectManager.onUserLocationChange(() => {
      this.updateCanvasList(); // 사용자 수 업데이트를 위해
    });

    // 초기 캔버스 목록 렌더링
    setTimeout(() => {
      this.updateCanvasList();
      // 첫 번째 캔버스가 있으면 자동 선택
      const canvases = this.projectManager.getCanvasList();
      if (canvases.length > 0) {
        this.selectCanvas(canvases[0].id);
      }
    }, 1500); // YJS 초기화 및 기본 캔버스 생성 대기 시간 증가
  }

  private setupEventListeners(): void {
    // 브러시 설정 이벤트
    this.brushSizeInput.addEventListener("input", (e) => {
      const size = parseInt((e.target as HTMLInputElement).value);
      this.sizeValue.textContent = size.toString();
      this.currentCanvasManager?.setBrushSize(size);
    });

    this.brushColorInput.addEventListener("input", (e) => {
      const color = (e.target as HTMLInputElement).value;
      this.currentCanvasManager?.setBrushColor(color);
    });

    this.clearButton.addEventListener("click", () => {
      if (confirm("정말로 전체 캔버스를 지우시겠습니까?")) {
        this.currentCanvasManager?.clear();
      }
    });

    this.deleteCanvasButton.addEventListener("click", () => {
      if (
        this.currentCanvasId &&
        confirm("정말로 이 캔버스를 삭제하시겠습니까?")
      ) {
        this.deleteCanvas(this.currentCanvasId);
      }
    });

    // 새 캔버스 추가 버튼
    this.addCanvasBtn.addEventListener("click", () => {
      this.showAddCanvasModal();
    });

    // 윈도우 리사이즈 이벤트
    window.addEventListener("resize", () => {
      if (this.currentCanvasManager) {
        setupCanvas(this.canvas);
        this.currentCanvasManager.resizeCanvas(
          this.canvas.width,
          this.canvas.height
        );
      }
    });
  }

  private setupModal(): void {
    this.confirmAddCanvas.addEventListener("click", () => {
      const name = this.canvasNameInput.value.trim();
      if (name) {
        const canvasId = this.projectManager.addCanvas(name);
        this.hideAddCanvasModal();
        this.selectCanvas(canvasId);
      }
    });

    this.cancelAddCanvas.addEventListener("click", () => {
      this.hideAddCanvasModal();
    });

    // 모달 외부 클릭 시 닫기
    this.addCanvasModal.addEventListener("click", (e) => {
      if (e.target === this.addCanvasModal) {
        this.hideAddCanvasModal();
      }
    });

    // Enter 키로 캔버스 추가
    this.canvasNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.confirmAddCanvas.click();
      }
    });
  }

  private updateCanvasList(): void {
    const canvases = this.projectManager.getCanvasList();

    this.canvasList.innerHTML = "";

    canvases.forEach((canvas) => {
      const canvasItem = this.createCanvasListItem(canvas);
      this.canvasList.appendChild(canvasItem);
    });
  }

  private createCanvasListItem(canvas: ProjectCanvas): HTMLElement {
    const item = document.createElement("div");
    item.className = "canvas-item";
    if (canvas.id === this.currentCanvasId) {
      item.classList.add("active");
    }

    const userCount = this.projectManager.getUsersInCanvas(canvas.id).length;
    const lastModified = new Date(canvas.lastModified).toLocaleString();

    item.innerHTML = `
      <div class="canvas-name">${canvas.name}</div>
      <div class="canvas-info">
        <span>수정: ${lastModified}</span>
        <div class="user-count">
          <div class="user-dot"></div>
          <span>${userCount}</span>
        </div>
      </div>
    `;

    item.addEventListener("click", () => {
      this.selectCanvas(canvas.id);
    });

    return item;
  }

  private async selectCanvas(canvasId: string): Promise<void> {
    if (this.currentCanvasId === canvasId) return;

    console.log("🎨 캔버스 선택:", canvasId);

    // 이전 캔버스 매니저 정리
    if (this.currentCanvasManager) {
      this.projectManager.setUserLocation(
        this.currentCanvasManager.userId,
        null
      );
      this.currentCanvasManager.destroy();
    }

    // Canvas 완전히 지우기 (중요!)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.cursorsContainer.innerHTML = "";

    // 새 캔버스 매니저 생성
    this.currentCanvasId = canvasId;
    this.currentCanvasManager = new CanvasManager(
      this.projectId,
      canvasId,
      this.canvas,
      this.cursorsContainer,
      this.persistentUserId // 동일한 사용자 ID 사용
    );

    // 사용자 위치 업데이트
    this.projectManager.setUserLocation(this.persistentUserId, canvasId);

    // UI 업데이트
    const canvasData = this.projectManager.getCanvas(canvasId);
    if (canvasData) {
      this.canvasTitle.textContent = canvasData.name;
      this.projectManager.updateCanvasLastModified(canvasId);
    }

    // 사용자 목록 업데이트 콜백 설정
    this.currentCanvasManager.onUserChange((users) => {
      this.updateOnlineUsers(users);
    });

    // 현재 브러시 설정 적용
    const brushSize = parseInt(this.brushSizeInput.value);
    const brushColor = this.brushColorInput.value;
    this.currentCanvasManager.setBrushSize(brushSize);
    this.currentCanvasManager.setBrushColor(brushColor);

    // UI 상태 업데이트
    this.showCanvas();
    this.updateCanvasList(); // active 상태 업데이트
  }

  private get ctx(): CanvasRenderingContext2D {
    return this.canvas.getContext("2d")!;
  }

  private deleteCanvas(canvasId: string): void {
    const canvases = this.projectManager.getCanvasList();
    if (canvases.length <= 1) {
      alert("마지막 캔버스는 삭제할 수 없습니다.");
      return;
    }

    this.projectManager.removeCanvas(canvasId);

    // 현재 캔버스가 삭제된 경우 다른 캔버스로 이동
    if (this.currentCanvasId === canvasId) {
      const remainingCanvases = this.projectManager.getCanvasList();
      if (remainingCanvases.length > 0) {
        this.selectCanvas(remainingCanvases[0].id);
      } else {
        this.hideCanvas();
      }
    }
  }

  private updateOnlineUsers(users: Map<string, User>): void {
    this.onlineUsers.innerHTML = "";

    users.forEach((user) => {
      const userElement = document.createElement("div");
      userElement.className = "online-user";
      userElement.style.backgroundColor = user.color;
      userElement.textContent = user.id.substring(0, 2).toUpperCase();
      userElement.title = `사용자 ${user.id}`;
      this.onlineUsers.appendChild(userElement);
    });
  }

  private showCanvas(): void {
    this.emptyState.style.display = "none";
    this.canvas.style.display = "block";
    this.toolbar.style.display = "flex";
  }

  private hideCanvas(): void {
    this.emptyState.style.display = "flex";
    this.canvas.style.display = "none";
    this.toolbar.style.display = "none";
    this.canvasTitle.textContent = "캔버스를 선택해주세요";
    this.onlineUsers.innerHTML = "";
  }

  private showAddCanvasModal(): void {
    this.canvasNameInput.value = "";
    this.addCanvasModal.classList.add("show");
    this.canvasNameInput.focus();
  }

  private hideAddCanvasModal(): void {
    this.addCanvasModal.classList.remove("show");
  }

  private generateUserId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  public destroy(): void {
    // 현재 캔버스 매니저 정리
    if (this.currentCanvasManager) {
      this.projectManager.setUserLocation(this.persistentUserId, null);
      this.currentCanvasManager.destroy();
    }

    // 프로젝트 매니저 정리
    this.projectManager.destroy();
  }
}

// 앱 시작
const app = new MultiCanvasApp();

// 페이지 언로드 시 정리
window.addEventListener("beforeunload", () => {
  app.destroy();
});
