export interface BrushStroke {
  id: string;
  points: Point[];
  color: string;
  size: number;
  timestamp: number;
  userId: string;
}

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface User {
  id: string;
  color: string;
  cursor?: Point;
}
