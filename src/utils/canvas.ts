export function setupCanvas(canvas: HTMLCanvasElement): void {
  const container = canvas.parentElement!;

  function resize() {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  }

  resize();
  window.addEventListener("resize", resize);
}
