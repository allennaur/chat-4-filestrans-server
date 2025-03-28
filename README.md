# 实时聊天和文件传输服务器

这是一个基于 Node.js、Express 和 Socket.IO 构建的实时聊天服务器，支持聊天室功能和点对点文件传输。

## 功能特点

- 用户可以通过用户名建立连接，被标记为在线状态
- 创建或加入聊天室
- 实时聊天消息传递
- 查看聊天室内当前在线用户数
- 通过 WebRTC 进行局域网点对点文件传输
- 用户离线自动检测与处理

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务器

```bash
npm start
```

或者使用提供的启动脚本：

- Linux/Mac: `./start.sh`
- Windows: 双击 `start.bat`

服务器将在 http://localhost:3000 上运行。

## API 接口文档

本项目使用 Socket.IO 进行实时通信，以下是所有可用的事件和接口。

### 客户端发送的事件

#### 1. 用户连接 `user-connect`

用户首次连接时发送，建立连接并标记为在线状态。

- **入参示例**：
```javascript
{
  "username": "张三" // 用户名，可选，如未提供则生成默认名称
}
```

- **出参示例** (`connection-established` 事件):
```javascript
{
  "success": true,
  "userId": "socket-id-12345",
  "message": "连接成功，已标记为在线状态"
}
```

#### 2. 加入聊天室 `join-room`

创建或加入指定ID的聊天室。

- **入参示例**：
```javascript
"room-123" // 聊天室ID，字符串
```

- **出参示例** (`room-joined` 事件):
```javascript
{
  "roomId": "room-123",
  "userCount": 2,
  "messages": [
    {
      "id": "msg-123456",
      "content": "你好！",
      "sender": {
        "id": "user-id-123",
        "username": "李四"
      },
      "timestamp": 1634567890123
    }
    // ... 其他消息
  ]
}
```

#### 3. 发送消息 `send-message`

在当前聊天室发送文本消息。

- **入参示例**：
```javascript
{
  "content": "大家好！我是新来的。"
}
```

- **出参示例** (`new-message` 事件，发送给所有人):
```javascript
{
  "id": "msg-234567",
  "content": "大家好！我是新来的。",
  "sender": {
    "id": "socket-id-12345",
    "username": "张三"
  },
  "timestamp": 1634567890123
}
```

#### 4. 发送文件信息 `file-info`

通知聊天室有新文件可供下载。

- **入参示例**：
```javascript
{
  "id": "file-1234567890",
  "name": "report.pdf",
  "type": "application/pdf",
  "size": 1234567,
  "lastModified": 1634567890123
}
```

- **出参示例** (`new-file` 事件，发送给所有人):
```javascript
{
  "id": "file-msg-1234567",
  "type": "file", 
  "fileInfo": {
    "id": "file-1234567890",
    "name": "report.pdf",
    "type": "application/pdf",
    "size": 1234567,
    "lastModified": 1634567890123,
    "senderId": "socket-id-12345"
  },
  "sender": {
    "id": "socket-id-12345",
    "username": "张三"
  },
  "timestamp": 1634567890123
}
```

#### 5. 文件传输信号 `file-transfer-signal`

用于WebRTC点对点通信的信令交换。

- **入参示例** (发送offer):
```javascript
{
  "type": "offer",
  "targetId": "socket-id-67890", // 接收方ID
  "sdp": {
    // WebRTC SDP 信息
  }
}
```

- **入参示例** (请求文件):
```javascript
{
  "type": "file-request",
  "targetId": "socket-id-67890", // 文件拥有者ID
  "fileId": "file-1234567890"
}
```

- **出参示例** (通过 `file-transfer-signal` 事件转发):
```javascript
{
  "type": "offer", // 或 "answer", "ice", "file-request" 等
  "senderId": "socket-id-12345",
  "senderName": "张三",
  "targetId": "socket-id-67890",
  "sdp": {
    // WebRTC SDP 信息
  }
  // 其他可能的字段，取决于原始消息
}
```

#### 6. 离开聊天室 `leave-room`

用户主动离开当前聊天室。

- **入参示例**: 无需参数
- **无直接出参**，但会向聊天室其他用户发送 `user-left` 事件

#### 7. 断开连接 `disconnect`

用户关闭页面或断开连接时自动触发。

- **入参示例**: 自动触发，无需手动发送
- **无直接出参**，但会向聊天室其他用户发送 `user-left` 事件

### 服务器发送的事件

#### 1. 连接建立 `connection-established`

响应 `user-connect` 事件，确认用户连接成功。

```javascript
{
  "success": true,
  "userId": "socket-id-12345",
  "message": "连接成功，已标记为在线状态"
}
```

#### 2. 加入房间成功 `room-joined`

响应 `join-room` 事件，提供房间信息。

```javascript
{
  "roomId": "room-123",
  "userCount": 3,
  "messages": [
    // 聊天室历史消息
  ]
}
```

#### 3. 新消息 `new-message`

向聊天室所有用户广播新消息。

```javascript
{
  "id": "msg-234567",
  "content": "大家好！我是新来的。",
  "sender": {
    "id": "socket-id-12345",
    "username": "张三"
  },
  "timestamp": 1634567890123
}
```

#### 4. 新文件 `new-file`

向聊天室所有用户广播新文件信息。

```javascript
{
  "id": "file-msg-1234567",
  "type": "file",
  "fileInfo": {
    "id": "file-1234567890", 
    "name": "report.pdf",
    "type": "application/pdf",
    "size": 1234567,
    "senderId": "socket-id-12345"
  },
  "sender": {
    "id": "socket-id-12345", 
    "username": "张三"
  },
  "timestamp": 1634567890123
}
```

#### 5. 用户加入 `user-joined`

通知房间内其他用户有新用户加入。

```javascript
{
  "user": {
    "id": "socket-id-12345",
    "username": "张三"
  },
  "userCount": 3
}
```

#### 6. 用户离开 `user-left`

通知房间内其他用户有用户离开。

```javascript
{
  "userId": "socket-id-12345",
  "username": "张三", 
  "userCount": 2
}
```

#### 7. 文件传输信号转发 `file-transfer-signal`

转发WebRTC通信所需的信令。

```javascript
{
  "type": "offer", // 或 "answer", "ice", "file-request"
  "senderId": "socket-id-12345",
  "senderName": "张三",
  // ... 其他信号相关字段
}
```

#### 8. 错误消息 `error`

发送错误消息给客户端。

```javascript
{
  "message": "您未加入任何聊天室"
}
```

#### 9. 在线用户数量 `online-users-count`

向所有连接的客户端广播当前在线用户总数。

```javascript
3 // 数字，表示当前在线用户总数
```

## WebRTC 文件传输流程

1. 文件发送方通过 `file-info` 事件通知聊天室有文件可用
2. 接收方点击"请求下载"按钮，触发 `file-transfer-signal` 事件
3. 服务器转发请求给文件发送方
4. 双方通过 WebRTC 建立点对点连接:
   - 发送 offer/answer 信号
   - 交换 ICE 候选信息
   - 建立数据通道
5. 文件发送方将文件分块传输给接收方
6. 接收方接收完成后，合并文件块并提供下载链接

## 数据结构

### 用户对象
```javascript
{
  "id": "socket-id-12345",
  "username": "张三",
  "currentRoom": "room-123" // 当前所在聊天室ID
}
```

### 聊天室对象
```javascript
{
  "users": Map(), // 用户ID -> 用户对象的映射
  "messages": [] // 消息数组
}
```

### 消息对象
```javascript
{
  "id": "msg-123456",
  "content": "你好！", // 文本消息内容
  "sender": {
    "id": "user-id-123",
    "username": "李四"
  },
  "timestamp": 1634567890123
}
```

### 文件消息对象
```javascript
{
  "id": "file-msg-1234567",
  "type": "file",
  "fileInfo": {
    "id": "file-1234567890",
    "name": "report.pdf",
    "type": "application/pdf",
    "size": 1234567,
    "senderId": "socket-id-12345"
  },
  "sender": {
    "id": "socket-id-12345",
    "username": "张三"
  },
  "timestamp": 1634567890123
}
```

## 技术栈

- Node.js - 服务端运行环境
- Express - Web服务器框架
- Socket.IO - WebSocket实时通信
- WebRTC - 点对点文件传输

## 许可证

MIT
