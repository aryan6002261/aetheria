import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/config.js';
import { query } from '../db/db.js';

let ioInstance = null;
const userSockets = new Map(); // profileId -> Set of socketIds

export function initSocket(server) {
  ioInstance = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  // Socket Authentication Middleware
  ioInstance.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || 
                    socket.handshake.headers?.cookie?.split('aetheria_token=')[1]?.split(';')[0];

      if (!token) {
        // Allow guest / spectator or reject
        return next();
      }

      jwt.verify(token, config.jwtSecret, (err, decoded) => {
        if (!err && decoded) {
          socket.user = decoded;
        }
        next();
      });
    } catch {
      next();
    }
  });

  ioInstance.on('connection', async (socket) => {
    const profileId = socket.user?.profile_id;
    const characterName = socket.user?.character_name || 'Anonymous Wanderer';

    if (profileId) {
      if (!userSockets.has(profileId)) {
        userSockets.set(profileId, new Set());
      }
      userSockets.get(profileId).add(socket.id);

      // Join personal room for notifications
      socket.join(`user_${profileId}`);

      // Mark player online in database
      await query(`UPDATE player_profiles SET is_online = TRUE, last_active_at = CURRENT_TIMESTAMP WHERE id = $1;`, [profileId]).catch(() => {});
      ioInstance.emit('citizen_status', { profileId, isOnline: true });
    }

    // Auto-join global & default planet channel
    const planetId = socket.user?.planet_id || 1;
    socket.join(`planet_${planetId}`);

    // Join specific room (e.g. lounge, city, conversation)
    socket.on('join_room', ({ room }) => {
      if (room) {
        socket.join(room);
        socket.emit('joined_room', { room });
      }
    });

    socket.on('leave_room', ({ room }) => {
      if (room) {
        socket.leave(room);
      }
    });

    // Send Message
    socket.on('send_message', async (data) => {
      try {
        const { room, conversationId, content, messageType = 'text' } = data;
        if (!content || content.trim().length === 0) return;

        const senderId = profileId || null;
        const senderName = socket.user?.character_name || 'Guest Citizen';

        let targetRoom = room;

        // If conversationId is provided, save to DB
        let savedMessageId = null;
        if (conversationId) {
          const insertRes = await query(`
            INSERT INTO messages (conversation_id, sender_profile_id, sender_name, content, message_type)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
          `, [conversationId, senderId, senderName, content.trim(), messageType]);
          savedMessageId = insertRes.rows[0].id;
          targetRoom = `conv_${conversationId}`;
        }

        const payload = {
          id: savedMessageId || Date.now(),
          conversationId,
          senderProfileId: senderId,
          senderName,
          content: content.trim(),
          messageType,
          createdAt: new Date().toISOString(),
        };

        if (targetRoom) {
          ioInstance.to(targetRoom).emit('new_message', payload);
        } else {
          // Broadcast to planet
          ioInstance.to(`planet_${planetId}`).emit('new_message', payload);
        }
      } catch (err) {
        socket.emit('error', { message: 'Failed to send message: ' + err.message });
      }
    });

    // Typing Indicators
    socket.on('typing_start', ({ room }) => {
      if (room) socket.to(room).emit('user_typing', { characterName, isTyping: true });
    });

    socket.on('typing_stop', ({ room }) => {
      if (room) socket.to(room).emit('user_typing', { characterName, isTyping: false });
    });

    // Disconnect
    socket.on('disconnect', async () => {
      if (profileId && userSockets.has(profileId)) {
        const set = userSockets.get(profileId);
        set.delete(socket.id);
        if (set.size === 0) {
          userSockets.delete(profileId);
          await query(`UPDATE player_profiles SET is_online = FALSE, last_active_at = CURRENT_TIMESTAMP WHERE id = $1;`, [profileId]).catch(() => {});
          ioInstance.emit('citizen_status', { profileId, isOnline: false });
        }
      }
    });
  });

  console.log('[SOCKET] Socket.IO initialized for real-time multiplayer communications.');
  return ioInstance;
}

export function getIO() {
  return ioInstance;
}

export function sendNotificationToProfile(profileId, notification) {
  if (ioInstance) {
    ioInstance.to(`user_${profileId}`).emit('new_notification', notification);
  }
}

export default {
  initSocket,
  getIO,
  sendNotificationToProfile,
};

