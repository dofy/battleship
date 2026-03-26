// lib/socket.js — 客户端 Socket.IO 单例
// 跨页面导航保持同一连接，避免导航时断线触发服务端销毁房间
import { io } from 'socket.io-client'

let socket = null

export function getSocket() {
  if (!socket) {
    socket = io()
  }
  return socket
}
