const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

// 初始化应用
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 数据存储
const onlineUsers = new Map(); // 存储在线用户: socketId -> userData
const chatRooms = new Map();   // 存储聊天室: roomId -> {users: Map(), messages: Array}

// Socket连接处理
io.on('connection', (socket) => {
  console.log(`新用户连接: ${socket.id}`);
  
  // 用户首次连接 - 标记为在线状态
  socket.on('user-connect', (userData) => {
    // 存储用户信息
    onlineUsers.set(socket.id, {
      id: socket.id,
      username: userData.username || `用户_${socket.id.substring(0, 5)}`,
      ...userData
    });
    
    // 通知用户连接成功
    socket.emit('connection-established', {
      success: true,
      userId: socket.id,
      message: '连接成功，已标记为在线状态'
    });
    
    // 广播在线用户数量
    io.emit('online-users-count', onlineUsers.size);
    console.log(`用户 ${onlineUsers.get(socket.id).username} 已上线，当前在线用户数: ${onlineUsers.size}`);
  });
  
  // 加入/创建聊天室
  socket.on('join-room', (roomId) => {
    // 检查用户是否已登录
    if (!onlineUsers.has(socket.id)) {
      socket.emit('error', { message: '请先连接到服务器' });
      return;
    }
    
    const user = onlineUsers.get(socket.id);
    
    // 处理用户之前可能在的房间
    leaveCurrentRoom(socket);
    
    // 检查聊天室是否存在，不存在则创建
    if (!chatRooms.has(roomId)) {
      chatRooms.set(roomId, {
        users: new Map(),
        messages: []
      });
      console.log(`创建新聊天室: ${roomId}`);
    }
    
    // 将用户添加到聊天室
    const room = chatRooms.get(roomId);
    room.users.set(socket.id, user);
    
    // 加入socket.io房间
    socket.join(roomId);
    
    // 保存用户当前房间信息
    user.currentRoom = roomId;
    
    // 发送聊天室信息给用户
    socket.emit('room-joined', {
      roomId,
      userCount: room.users.size,
      messages: room.messages
    });
    
    // 通知房间内其他用户有新用户加入
    socket.to(roomId).emit('user-joined', {
      user: {
        id: user.id,
        username: user.username
      },
      userCount: room.users.size
    });
    
    console.log(`用户 ${user.username} 加入聊天室 ${roomId}，当前聊天室用户数: ${room.users.size}`);
  });
  
  // 处理聊天消息
  socket.on('send-message', (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user || !user.currentRoom) {
      socket.emit('error', { message: '您未加入任何聊天室' });
      return;
    }
    
    const roomId = user.currentRoom;
    const room = chatRooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: '聊天室不存在' });
      return;
    }
    
    // 创建消息对象
    const message = {
      id: Date.now() + Math.random().toString(36).substr(2, 5),
      content: data.content,
      sender: {
        id: socket.id,
        username: user.username
      },
      timestamp: Date.now()
    };
    
    // 存储消息
    room.messages.push(message);
    
    // 发送消息给房间内所有用户
    io.to(roomId).emit('new-message', message);
    console.log(`用户 ${user.username} 在聊天室 ${roomId} 发送消息`);
  });
  
  // 处理文件传输请求信令
  socket.on('file-transfer-signal', (data) => {
    const user = onlineUsers.get(socket.id);
    if (!user || !user.currentRoom) {
      socket.emit('error', { message: '您未加入任何聊天室' });
      return;
    }
    
    const roomId = user.currentRoom;
    
    // 转发文件传输信令给指定接收者或整个房间
    if (data.targetId) {
      // 点对点信令
      io.to(data.targetId).emit('file-transfer-signal', {
        ...data,
        senderId: socket.id,
        senderName: user.username
      });
    } else {
      // 广播文件信息到整个房间
      socket.to(roomId).emit('file-transfer-signal', {
        ...data,
        senderId: socket.id,
        senderName: user.username
      });
    }
  });

  // 文件元信息广播 (告知其他用户有文件可以下载)
  socket.on('file-info', (fileInfo) => {
    const user = onlineUsers.get(socket.id);
    if (!user || !user.currentRoom) {
      socket.emit('error', { message: '您未加入任何聊天室' });
      return;
    }

    const roomId = user.currentRoom;
    const room = chatRooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: '聊天室不存在' });
      return;
    }
    
    // 创建文件消息对象
    const fileMessage = {
      id: Date.now() + Math.random().toString(36).substr(2, 5),
      type: 'file',
      fileInfo: {
        ...fileInfo,
        senderId: socket.id,
      },
      sender: {
        id: socket.id,
        username: user.username
      },
      timestamp: Date.now()
    };
    
    // 存储文件消息
    room.messages.push(fileMessage);
    
    // 发送消息给房间内所有用户
    io.to(roomId).emit('new-file', fileMessage);
    console.log(`用户 ${user.username} 在聊天室 ${roomId} 分享了文件: ${fileInfo.name}`);
  });
  
  // 处理用户退出聊天室
  socket.on('leave-room', () => {
    leaveCurrentRoom(socket);
  });
  
  // 处理用户断开连接
  socket.on('disconnect', () => {
    console.log(`用户断开连接: ${socket.id}`);
    
    // 处理用户退出房间
    leaveCurrentRoom(socket);
    
    // 从在线用户列表中删除
    if (onlineUsers.has(socket.id)) {
      const username = onlineUsers.get(socket.id).username;
      onlineUsers.delete(socket.id);
      console.log(`用户 ${username} 已下线，当前在线用户数: ${onlineUsers.size}`);
      
      // 广播在线用户数量
      io.emit('online-users-count', onlineUsers.size);
    }
  });
});

// 辅助函数：用户离开当前房间
function leaveCurrentRoom(socket) {
  const user = onlineUsers.get(socket.id);
  if (user && user.currentRoom) {
    const roomId = user.currentRoom;
    const room = chatRooms.get(roomId);
    
    if (room) {
      // 从房间用户列表中删除
      room.users.delete(socket.id);
      
      // 通知其他用户
      socket.to(roomId).emit('user-left', {
        userId: socket.id,
        username: user.username,
        userCount: room.users.size
      });
      
      console.log(`用户 ${user.username} 离开聊天室 ${roomId}，当前聊天室用户数: ${room.users.size}`);
      
      // 如果房间为空，删除房间
      if (room.users.size === 0) {
        chatRooms.delete(roomId);
        console.log(`聊天室 ${roomId} 已删除（无用户）`);
      }
    }
    
    // 离开socket.io房间
    socket.leave(roomId);
    
    // 清除用户当前房间信息
    delete user.currentRoom;
  }
}

// 启动服务器
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`聊天服务器运行在 http://localhost:${PORT}`);
});
