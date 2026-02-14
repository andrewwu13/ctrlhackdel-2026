import { io, Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";

/**
 * Create a Socket.IO connection to a specific namespace.
 */
export function createSocket(
  namespace: string,
  query?: Record<string, string>
): Socket {
  const socket = io(`${SOCKET_URL}${namespace}`, {
    query,
    transports: ["websocket", "polling"],
    autoConnect: false,
  });

  socket.on("connect", () => {
    console.log(`[Socket.IO] Connected to ${namespace}`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`[Socket.IO] Disconnected from ${namespace}: ${reason}`);
  });

  socket.on("connect_error", (error) => {
    console.error(`[Socket.IO] Connection error on ${namespace}:`, error.message);
  });

  return socket;
}
