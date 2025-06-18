import { BrushStroke, Point } from "../types/brush";

export class BrushEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isDrawing: boolean = false;
  private currentStroke: Point[] = [];
  private brushSize: number = 5;
  private brushColor: string = "#000000";

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.setupCanvas();
  }

  private setupCanvas(): void {
    // Canvas 스타일 설정
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.imageSmoothingEnabled = true;
  }

  public setBrushSize(size: number): void {
    this.brushSize = size;
  }

  public setBrushColor(color: string): void {
    this.brushColor = color;
  }

  public startDrawing(point: Point): void {
    this.isDrawing = true;
    this.currentStroke = [point];
  }

  public addPoint(point: Point): void {
    if (!this.isDrawing) return;

    this.currentStroke.push(point);
    this.drawSegment(this.currentStroke[this.currentStroke.length - 2], point);
  }

  public endDrawing(): BrushStroke | null {
    if (!this.isDrawing || this.currentStroke.length < 2) {
      this.isDrawing = false;
      return null;
    }

    this.isDrawing = false;

    const stroke: BrushStroke = {
      id: this.generateStrokeId(),
      points: [...this.currentStroke],
      color: this.brushColor,
      size: this.brushSize,
      timestamp: Date.now(),
      userId: "", // SyncManager에서 설정됨
    };

    this.currentStroke = [];
    return stroke;
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

  public renderStroke(stroke: BrushStroke): void {
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

  public clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private generateStrokeId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}
