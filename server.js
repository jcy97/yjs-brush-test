// server.js
import { WebSocketServer } from "ws";
import { setupWSConnection } from "y-websocket/bin/utils.js";

const port = 1234;
const wss = new WebSocketServer({ port });

console.log(`🚀 Y.js WebSocket 서버가 포트 ${port}에서 실행 중입니다.`);
console.log(`📡 연결 URL: ws://localhost:${port}`);

wss.on("connection", (ws, request) => {
  const url = new URL(request.url, `http://localhost:${port}`);
  const roomName = url.pathname.slice(1) || "default-room";

  console.log(`👤 새 연결: ${roomName} 방`);

  setupWSConnection(ws, request, { docName: roomName });

  ws.on("close", () => {
    console.log(`👋 연결 종료: ${roomName} 방`);
  });
});

process.on("SIGINT", () => {
  console.log("\n🛑 서버를 종료합니다...");
  wss.close(() => {
    process.exit(0);
  });
});
