# 🚢 Battleship — 1v1 联网海战棋

实时多人海战棋游戏，支持创建/加入房间、布局阶段倒计时、回合制对战、本地战绩记录。

## 技术栈

- **Next.js 14** — Pages Router + Custom Server
- **Socket.IO 4** — 实时双向通信（共享同一 HTTP Server）
- **Tailwind CSS** — 样式
- **内存状态** — 游戏状态存于 Node.js 进程内存（`Map`），无外部数据库

## 功能特性

- 创建公开/私有房间，或通过 6 位房间码加入
- 公开房间大厅列表
- 布局阶段：手动或随机放置舰船，90 秒倒计时（超时自动随机布置）
- 回合制对战：命中 / 未中 / 击沉提示，显示击沉位置
- 游戏结束后可发起再战投票
- 对手断线自动判定胜负
- 本地 localStorage 战绩记录（胜/败场数）

## 舰船配置

| 舰船 | 格数 | 数量 |
|------|------|------|
| 航空母舰 | 5 | 1 |
| 战列舰 | 4 | 1 |
| 巡洋舰 | 3 | 1 |
| 驱逐舰 | 3 | 1 |
| 潜水艇 | 2 | 1 |

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 生产模式
npm run build && npm start
```

访问 `http://localhost:3000` 即可开始游戏。

## 项目结构

```
battleship/
├── server.js                   # Next.js Custom Server + Socket.IO 初始化
├── lib/
│   ├── gameStore.js            # 内存游戏状态管理
│   ├── socketHandlers.js       # Socket.IO 事件处理器
│   ├── shipUtils.js            # 游戏核心逻辑（随机布局、命中检测）
│   └── socket.js               # 客户端 Socket.IO 单例
├── pages/
│   ├── index.js                # 首页（大厅、创建/加入房间）
│   └── room/[id].js            # 游戏房间（布局 + 对战）
├── components/
│   ├── Board.js                # 10×10 棋盘组件
│   ├── ShipPlacer.js           # 布局阶段交互
│   ├── LobbyTable.js           # 公开房间列表
│   └── GameStats.js            # 战况侧边栏
└── hooks/
    └── useLocalStats.js        # localStorage 战绩 hook
```

## 运行测试

```bash
npm test
```
