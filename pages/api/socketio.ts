import { Server as SocketIOServer } from "socket.io"
import { NextApiRequest, NextApiResponse } from "next"
import {
  initDatabase,
  createRoom,
  getRoom,
  addPlayerToRoom,
  updatePlayer,
  updateRoom,
  removePlayerFromRoom,
  cleanupOldRooms,
  cleanupEmptyRooms,
  cleanupInactiveRooms,
  clearAllRooms,
  updateRoomActivity,
  type Player,
} from "../../lib/database"

// Initialize database on startup
let dbInitialized = false

async function ensureDbInitialized() {
  if (!dbInitialized) {
    try {
      await initDatabase()
      dbInitialized = true
    } catch (error) {
      console.error("❌ Failed to initialize database:", error)
      throw error
    }
  }
}

// Room activity tracking
const roomActivityTracker = new Map<string, {
  lastActivity: Date
  warningIssued: boolean
  players: Set<string>
}>()

// Track socket-player associations for cleanup
const socketPlayerMap = new Map<string, { roomId: string; playerId: string }>();

// Track player heartbeats for individual player monitoring
const playerHeartbeats = new Map<string, { lastSeen: Date; roomId: string }>();

// Track practice timers for each room (for synchronized practice mode timer)
// Use 'any' for interval type to avoid NodeJS.Timeout linter issues in environments without @types/node
const practiceTimers = new Map<string, { timeLeft: number; interval: any }>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!res.socket.server.io) {
    await ensureDbInitialized()

    // Clear all existing rooms immediately
    const clearedRooms = await clearAllRooms();

    const io = new SocketIOServer(res.socket.server, {
      path: "/api/socketio",
      addTrailingSlash: false,
      serveClient: false,
      cors: {
        origin: process.env.NODE_ENV === "production" 
          ? [
              "https://oneplswork.onrender.com", 
              "https://*.onrender.com"
            ]
          : "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["polling"],
      allowUpgrades: false,
      allowEIO3: true,
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 30000,
      maxHttpBufferSize: 1e6,
      cookie: false,
      perMessageDeflate: false,
      httpCompression: false,
    })

    // Enhanced error handling
    io.engine.on("connection_error", (err) => {
      console.log("❌ Socket.IO Engine connection error:")
      console.log("  - Request URL:", err.req?.url)
      console.log("  - Request method:", err.req?.method)
      console.log("  - Error code:", err.code)
      console.log("  - Error message:", err.message)
      
      if (err.message && err.message.includes("namespace")) {
        console.log("🚨 NAMESPACE ERROR DETECTED:")
        console.log("  - This is likely a client-side namespace configuration issue")
      }
    })

    function updateRoomActivityTracker(roomId: string, playerId?: string) {
      const now = new Date();
      const existing = roomActivityTracker.get(roomId);

      if (existing) {
        existing.lastActivity = now;
        existing.warningIssued = false;
        if (playerId) {
          existing.players.add(playerId);
        }
      } else {
        roomActivityTracker.set(roomId, {
          lastActivity: now,
          warningIssued: false,
          players: new Set(playerId ? [playerId] : [])
        });
      }

      updateRoomActivity(roomId).catch(err => {
        console.error(`Failed to update room activity in DB for ${roomId}:`, err);
      });
    }

    async function issueInactivityWarning(roomId: string) {
      const warningMessage = {
        type: "inactivity_warning",
        message: "⚠️ Room will be closed in 30 seconds due to inactivity",
        countdown: 30,
        timestamp: new Date().toISOString()
      };

      io.to(roomId).emit("room-warning", warningMessage);
    }

    // Periodic cleanup process (every 60 seconds)
    const cleanupInterval = setInterval(async () => {
      try {
        const now = new Date();
        const INACTIVITY_THRESHOLD = 120000; // 120 seconds for lobby/finished rooms
        const PLAYING_INACTIVITY_THRESHOLD = 300000; // 300 seconds (5 minutes) for playing rooms
        const WARNING_THRESHOLD = 90000; // 90 seconds

        for (const [roomId, activity] of roomActivityTracker.entries()) {
          const timeSinceLastActivity = now.getTime() - activity.lastActivity.getTime();

          if (timeSinceLastActivity > WARNING_THRESHOLD && !activity.warningIssued) {
            await issueInactivityWarning(roomId);
            activity.warningIssued = true;
          }

          // Get room state to determine appropriate threshold
          const room = await getRoom(roomId);
          const threshold = room?.game_state === "playing" ? PLAYING_INACTIVITY_THRESHOLD : INACTIVITY_THRESHOLD;

          if (timeSinceLastActivity > threshold) {
            io.to(roomId).emit("room-closed", {
              type: "inactivity_cleanup",
              message: "Room closed due to inactivity",
              reason: "inactivity",
              timestamp: new Date().toISOString()
            });

            roomActivityTracker.delete(roomId);
          }
        }

        const cleanedInactive = await cleanupInactiveRooms(io, INACTIVITY_THRESHOLD);
        if (cleanedInactive > 0) {
          broadcastAvailableRooms(io);
        }

        const cleanedEmpty = await cleanupEmptyRooms(io);
        if (cleanedEmpty > 0) {
          broadcastAvailableRooms(io);
        }

        // Check for disconnected players (no heartbeat for 90 seconds) - only in lobby
        const PLAYER_HEARTBEAT_THRESHOLD = 90000; // 90 seconds
        for (const [playerId, heartbeat] of playerHeartbeats.entries()) {
          const timeSinceLastHeartbeat = now.getTime() - heartbeat.lastSeen.getTime();
          if (timeSinceLastHeartbeat > PLAYER_HEARTBEAT_THRESHOLD) {
            // Only remove players if their room is in lobby state
            const room = await getRoom(heartbeat.roomId);
            if (room && room.game_state === "lobby") {
              console.log(`👻 Removing ghost player ${playerId} (no heartbeat for ${Math.round(timeSinceLastHeartbeat / 1000)}s)`);
              try {
                const { roomId: actualRoomId, wasHost, roomDeleted } = await removePlayerFromRoom(playerId, io);
                
                if (actualRoomId) {
                  // Update activity tracker
                  const activity = roomActivityTracker.get(actualRoomId);
                  if (activity) {
                    activity.players.delete(playerId);
                    if (activity.players.size === 0) {
                      roomActivityTracker.delete(actualRoomId);
                    }
                  }
                  
                  if (roomDeleted) {
                    console.log(`🗑️ Room ${actualRoomId} deleted due to ghost player cleanup`);
                  } else {
                    const room = await getRoom(actualRoomId);
                    if (room) {
                      if (wasHost) {
                        console.log(`👑 Ghost host ${playerId} removed from room ${actualRoomId}`);
                        io.to(actualRoomId).emit("host-left");
                        setTimeout(() => {
                          io.to(actualRoomId).emit("error", { message: "Host disconnected", status: 404 })
                        }, 500);
                      } else {
                        console.log(`👤 Ghost player ${playerId} removed from room ${actualRoomId}`);
                        io.to(actualRoomId).emit("room-update", { room });
                      }
                    }
                  }
                }
              } catch (error) {
                console.error(`❌ Error removing ghost player ${playerId}:`, error);
              }
              
              // Remove from heartbeat tracking
              playerHeartbeats.delete(playerId);
            } else {
              // Player is in active game - don't remove them, just log the missed heartbeat
              console.log(`⏰ Player ${playerId} missed heartbeat but is in active game - keeping them`);
            }
          }
        }

        await cleanupOldRooms(io);

      } catch (error) {
        console.error("❌ Error during periodic cleanup:", error);
      }
    }, 60000);

    process.on('SIGTERM', () => {
      clearInterval(cleanupInterval);
    });

    process.on('SIGINT', () => {
      clearInterval(cleanupInterval);
    });

    // Main connection handler
    io.on("connection", (socket) => {
      if (socket.nsp.name !== "/") {
        console.error("❌ Invalid namespace detected:", socket.nsp.name)
        socket.emit("error", { 
          message: "Invalid namespace", 
          namespace: socket.nsp.name,
          expected: "/",
          status: 400 
        })
        socket.disconnect(true)
        return
      }

      socket.emit("connection-success", { 
        socketId: socket.id,
        transport: socket.conn.transport.name,
        namespace: socket.nsp.name
      })

      socket.on("create-room", async ({ roomId, playerId, data }, callback) => {
        try {
          const targetScore = [100, 250, 500].includes(Number(data?.targetScore)) ? Number(data.targetScore) : 100
          const room = await createRoom(roomId, { target_score: targetScore })
          if (!room) {
            return callback({ error: "Failed to create room", status: 500 })
          }
          
          // Join the socket to the room
          socket.join(roomId)
          updateRoomActivityTracker(roomId, playerId)
          
          // Track socket-player association
          socketPlayerMap.set(socket.id, { roomId, playerId })
          
          // Track player heartbeat
          playerHeartbeats.set(playerId, { lastSeen: new Date(), roomId })
          
          callback({ room })
          broadcastAvailableRooms(io)
          
        } catch (error) {
          console.error(`❌ Error creating room ${roomId}:`, error)
          callback({ error: "Failed to create room", status: 500 })
        }
      })

      socket.on("join-room", async ({ roomId, playerId, data }, callback) => {
        try {
          const room = await getRoom(roomId)
          if (!room) {
            return callback({ error: "Room not found", status: 404 })
          }
          
          // Allow reconnection during active gameplay
          if (room.game_state === "playing") {
            // Check if this player was already in the room
            const existingPlayer = room.players.find(p => p.id === playerId);
            if (existingPlayer) {
              // Player is reconnecting - update their last_seen and allow rejoin
              console.log(`🔄 Player ${playerId} reconnecting to room ${roomId}`);
              await updatePlayer(playerId, { last_seen: new Date() });
              
              // Join the socket to the room
              socket.join(roomId)
              updateRoomActivityTracker(roomId, playerId)
              
              // Track socket-player association
              socketPlayerMap.set(socket.id, { roomId, playerId })
              
              // Track player heartbeat
              playerHeartbeats.set(playerId, { lastSeen: new Date(), roomId })
              
              const updatedRoom = await getRoom(roomId)
              
              callback({ room: updatedRoom })
              io.to(roomId).emit("room-update", { room: updatedRoom })
              return
            }
          }
          
          if (room.game_state === "playing") {
            return callback({ 
              error: "Cannot join: Game is already in progress. Please wait for the game to finish.", 
              status: 403 
            })
          }

          if (room.game_mode === "cooperation" && room.players.length >= 2) {
            return callback({
              error: "Cannot join: Cooperation mode is limited to 2 players.",
              status: 403
            })
          }
          
          const player: Omit<Player, "last_seen"> = {
            id: playerId,
            name: data.name,
            language: null,
            ready: false,
            score: 0,
            is_host: data.isHost || false,
            current_question: null,
          }
          
          const success = await addPlayerToRoom(roomId, player)
          if (!success) {
            return callback({ error: "Failed to join room", status: 500 })
          }
          
          // Join the socket to the room
          socket.join(roomId)
          updateRoomActivityTracker(roomId, playerId)
          
          // Track socket-player association
          socketPlayerMap.set(socket.id, { roomId, playerId })
          
          // Track player heartbeat
          playerHeartbeats.set(playerId, { lastSeen: new Date(), roomId })
          
          const updatedRoom = await getRoom(roomId)
          
          callback({ room: updatedRoom })
          io.to(roomId).emit("room-update", { room: updatedRoom })
          broadcastAvailableRooms(io)
          
        } catch (error) {
          console.error(`❌ Error joining room ${roomId}:`, error)
          callback({ error: "Failed to join room", status: 500 })
        }
      })

      socket.on("room-activity-ping", ({ roomId, playerId }) => {
        if (roomId && playerId) {
          updateRoomActivityTracker(roomId, playerId)
          // Update player heartbeat
          playerHeartbeats.set(playerId, { lastSeen: new Date(), roomId })
        }
      })

      socket.on("get-available-rooms", async ({}, callback) => {
        try {
          const availableRooms = await getAvailableRooms()
          callback({ rooms: availableRooms })
        } catch (error) {
          console.error("❌ Error fetching available rooms:", error)
          callback({ error: "Failed to fetch available rooms", rooms: [] })
        }
      })

      socket.on("update-game-mode", async ({ roomId, playerId, data }, callback) => {
        try {
          const room = await getRoom(roomId)
          if (!room) {
            return callback({ error: "Room not found", status: 404 })
          }
          const player = room.players.find((p) => p.id === playerId)
          if (!player || !player.is_host) {
            return callback({ error: "Only the room creator can update the game mode", status: 403 })
          }
          
          updateRoomActivityTracker(roomId, playerId)

          const updateData: any = { game_mode: data.gameMode }
          if (data.gameMode === "cooperation") {
            updateData.cooperation_lives = 3
            updateData.cooperation_score = 0
            updateData.used_words = []
            updateData.current_category = null
            updateData.current_challenge_player = null
            updateData.cooperation_waiting = false
          }
          
          const success = await updateRoom(roomId, updateData)
          if (!success) {
            return callback({ error: "Failed to update game mode", status: 500 })
          }
          const updatedRoom = await getRoom(roomId)
          callback({ room: updatedRoom })
          io.to(roomId).emit("room-update", { room: updatedRoom })
          broadcastAvailableRooms(io)
          
        } catch (error) {
          console.error(`❌ Error updating game mode for room ${roomId}:`, error)
          callback({ error: "Failed to update game mode", status: 500 })
        }
      })

      socket.on("change-game-mode", async ({ roomId, playerId }, callback) => {
        try {
          const room = await getRoom(roomId)
          if (!room) {
            return callback({ error: "Room not found", status: 404 })
          }
          const player = room.players.find((p) => p.id === playerId)
          if (!player || !player.is_host) {
            return callback({ error: "Only the room creator can change the game mode", status: 403 })
          }
          
          updateRoomActivityTracker(roomId, playerId)
          
          const success = await updateRoom(roomId, { 
            game_mode: null,
            host_language: null,
            cooperation_lives: null,
            cooperation_score: null,
            used_words: null,
            current_category: null,
            current_challenge_player: null,
            cooperation_waiting: null
          })
          if (!success) {
            return callback({ error: "Failed to reset game mode", status: 500 })
          }

          for (const p of room.players) {
            await updatePlayer(p.id, { 
              ready: false,
              language: null
            })
          }

          const updatedRoom = await getRoom(roomId)
          callback({ room: updatedRoom })
          
          io.to(roomId).emit("game-mode-changed", {
            type: "mode_reset",
            message: "Host is changing the game mode",
            newMode: "selection",
            timestamp: new Date().toISOString()
          })
          
          io.to(roomId).emit("room-update", { room: updatedRoom })
          broadcastAvailableRooms(io)
          
        } catch (error) {
          console.error(`❌ Error changing game mode for room ${roomId}:`, error)
          callback({ error: "Failed to change game mode", status: 500 })
        }
      })

      socket.on("update-host-language", async ({ roomId, playerId, data }, callback) => {
        try {
          const room = await getRoom(roomId)
          if (!room) {
            return callback({ error: "Room not found", status: 404 })
          }
          const player = room.players.find((p) => p.id === playerId)
          if (!player || !player.is_host) {
            return callback({ error: "Only the room creator can update the host language", status: 403 })
          }
          
          updateRoomActivityTracker(roomId, playerId)
          
          const success = await updateRoom(roomId, { host_language: data.hostLanguage })
          if (!success) {
            return callback({ error: "Failed to update host language", status: 500 })
          }
          const updatedRoom = await getRoom(roomId)
          callback({ room: updatedRoom })
          io.to(roomId).emit("room-update", { room: updatedRoom })
          broadcastAvailableRooms(io)
          
        } catch (error) {
          console.error(`❌ Error updating host language for room ${roomId}:`, error)
          callback({ error: "Failed to update host language", status: 500 })
        }
      })

      socket.on("update-language", async ({ roomId, playerId, data }, callback) => {
        try {
          const room = await getRoom(roomId)
          if (!room) {
            return callback({ error: "Room not found", status: 404 })
          }
          const player = room.players.find((p) => p.id === playerId)
          if (!player) {
            return callback({ error: "Player not found", status: 404 })
          }
          
          updateRoomActivityTracker(roomId, playerId)
          
          const shouldResetReady = !player.language
          const success = await updatePlayer(playerId, {
            language: data.language,
            ready: shouldResetReady ? false : player.ready,
          })
          if (!success) {
            return callback({ error: "Failed to update language", status: 500 })
          }
          const updatedRoom = await getRoom(roomId)
          callback({ room: updatedRoom })
          io.to(roomId).emit("room-update", { room: updatedRoom })
        } catch (error) {
          console.error(`❌ Error updating language for player ${playerId}:`, error)
          callback({ error: "Failed to update language", status: 500 })
        }
      })

      socket.on("toggle-ready", async ({ roomId, playerId }, callback) => {
        try {
          const room = await getRoom(roomId)
          if (!room) {
            return callback({ error: "Room not found", status: 404 })
          }
          const player = room.players.find((p) => p.id === playerId)
          if (!player) {
            return callback({ error: "Player not found", status: 404 })
          }
          
          if ((room.game_mode === "practice" || room.game_mode === "cooperation") && !player.language) {
            return callback({ error: "Select a language first", status: 400 })
          }
          if (room.game_mode === "competition" && !room.host_language) {
            return callback({ error: "Host must select a language first", status: 400 })
          }
          if (!room.game_mode) {
            return callback({ error: "Game mode must be selected first", status: 400 })
          }
          
          updateRoomActivityTracker(roomId, playerId)
          
          const success = await updatePlayer(playerId, { ready: !player.ready })
          if (!success) {
            return callback({ error: "Failed to toggle ready status", status: 500 })
          }
          const updatedRoom = await getRoom(roomId)
          callback({ room: updatedRoom })
          io.to(roomId).emit("room-update", { room: updatedRoom })
        } catch (error) {
          console.error(`❌ Error toggling ready for player ${playerId}:`, error)
          callback({ error: "Failed to toggle ready status", status: 500 })
        }
      })

      socket.on("update-target-score", async ({ roomId, playerId, data }, callback) => {
        try {
          const room = await getRoom(roomId)
          if (!room) {
            return callback({ error: "Room not found", status: 404 })
          }
          const player = room.players.find((p) => p.id === playerId)
          if (!player || !player.is_host) {
            return callback({ error: "Only the room creator can update the target score", status: 403 })
          }
          const targetScore = Number(data.targetScore)
          if (![100, 250, 500].includes(targetScore)) {
            return callback({ error: "Invalid target score", status: 400 })
          }
          
          updateRoomActivityTracker(roomId, playerId)
          
          const success = await updateRoom(roomId, { target_score: targetScore })
          if (!success) {
            return callback({ error: "Failed to update target score", status: 500 })
          }
          const updatedRoom = await getRoom(roomId)
          callback({ room: updatedRoom })
          io.to(roomId).emit("room-update", { room: updatedRoom })
        } catch (error) {
          console.error(`❌ Error updating target score for room ${roomId}:`, error)
          callback({ error: "Failed to update target score", status: 500 })
        }
      })

      socket.on("start-game", async ({ roomId, playerId }, callback) => {
        try {
          const room = await getRoom(roomId)
          if (!room) {
            return callback({ error: "Room not found", status: 404 })
          }
          
          const player = room.players.find((p) => p.id === playerId)
          if (!player || !player.is_host) {
            return callback({ error: "Only the room creator can start the game", status: 403 })
          }
          
          if (!room.game_mode) {
            return callback({ error: "Game mode must be selected first", status: 400 })
          }
          
          if (room.game_mode === "practice") {
            const playersWithoutLanguage = room.players.filter((p) => !p.language)
            if (playersWithoutLanguage.length > 0) {
              return callback({ 
                error: `All players must select a language. Missing: ${playersWithoutLanguage.map(p => p.name).join(", ")}`, 
                status: 400 
              })
            }
          } else if (room.game_mode === "competition") {
            if (!room.host_language) {
              return callback({ error: "Host must select a competition language first", status: 400 })
            }
          } else if (room.game_mode === "cooperation") {
            if (room.players.length !== 2) {
              return callback({ error: "Cooperation mode requires exactly 2 players", status: 400 })
            }
            const playersWithoutLanguage = room.players.filter((p) => !p.language)
            if (playersWithoutLanguage.length > 0) {
              return callback({ 
                error: `All players must select a language. Missing: ${playersWithoutLanguage.map(p => p.name).join(", ")}`, 
                status: 400 
              })
            }
          }
          
          const playersNotReady = room.players.filter((p) => !p.ready)
          if (playersNotReady.length > 0) {
            return callback({ 
              error: `All players must be ready. Not ready: ${playersNotReady.map(p => p.name).join(", ")}`, 
              status: 400 
            })
          }

          updateRoomActivityTracker(roomId, playerId)

          const updateData: any = { game_state: "playing", question_count: 0 }
          if (room.game_mode === "cooperation") {
            updateData.cooperation_waiting = true
            // Set first challenge player randomly
            const randomPlayer = room.players[Math.floor(Math.random() * room.players.length)]
            updateData.current_challenge_player = randomPlayer.id
          }

          const roomUpdateSuccess = await updateRoom(roomId, updateData)
          if (!roomUpdateSuccess) {
            return callback({ error: "Failed to start game", status: 500 })
          }

          const updatedRoom = await getRoom(roomId)

          callback({ room: updatedRoom })
          io.to(roomId).emit("room-update", { room: updatedRoom })

          if (room.game_mode === "cooperation") {
            io.to(roomId).emit("cooperation-waiting", { isWaiting: true })
            setTimeout(() => {
              startCooperationChallenge(roomId, io)
            }, 2000)
          }
          
          broadcastAvailableRooms(io)
        } catch (error) {
          console.error(`❌ Error starting game for room ${roomId}:`, error)
          callback({ error: "Failed to start game", status: 500 })
        }
      })

      socket.on("answer", async ({ roomId, playerId, data }, callback) => {
        try {
          const room = await getRoom(roomId)
          if (!room) {
            return callback({ error: "Room not found", status: 404 })
          }
          
          const player = room.players.find((p) => p.id === playerId)
          if (!player) {
            return callback({ error: "Player not found", status: 404 })
          }

          const { answer, timeLeft, correctAnswer, isPracticeMode } = data
          
          const isCorrect = answer === correctAnswer
          const isTimeout = timeLeft <= 0 || answer === ""
          
          let newScore = player.score
          
          if (isCorrect) {
            // Fixed scoring: earn (10 - timeLeft) points for correct answers
            const pointsChange = isPracticeMode ? 1 : Math.max(1, 10 - timeLeft)
            newScore = player.score + pointsChange
          } else if (!isPracticeMode) {
            newScore = Math.max(0, player.score - 5)
          }
          
          updateRoomActivityTracker(roomId, playerId)
          
          await updatePlayer(playerId, { score: newScore })
          
          if (newScore >= room.target_score && newScore > 0) {
            await updateRoom(roomId, { game_state: "finished", winner_id: playerId })
            const finalRoom = await getRoom(roomId)
            callback({ room: finalRoom })
            io.to(roomId).emit("room-update", { room: finalRoom })
            broadcastAvailableRooms(io)
            return
          }

          const updatedRoom = await getRoom(roomId)
          callback({ room: updatedRoom })
          io.to(roomId).emit("room-update", { room: updatedRoom })
        } catch (error) {
          console.error(`❌ Error processing answer for player ${playerId}:`, error)
          callback({ error: "Failed to process answer", status: 500 })
        }
      })

      // Cooperation mode handlers
      socket.on("cooperation-answer", async ({ roomId, playerId, data }, callback) => {
        try {
          const room = await getRoom(roomId)
          if (!room || room.game_mode !== "cooperation") {
            return callback({ error: "Invalid room or game mode", status: 400 })
          }

          const { challengeId, answer, isCorrect, wordId, remainingTime } = data

          // Handle time bank accumulation for cooperation mode
          if (remainingTime !== undefined) {
            const answeringPlayer = room.players.find(p => p.id === playerId);
            if (answeringPlayer && !answeringPlayer.receivedExtraTime) {
              const currentTimeBank = answeringPlayer.timeBank || 0;
              const newTimeBank = Math.min(10, currentTimeBank + remainingTime);
              await updatePlayer(playerId, { 
                timeBank: newTimeBank,
                receivedExtraTime: false // Reset for next round
              });
              console.log(`⏰ Player ${playerId} time bank updated: ${currentTimeBank} + ${remainingTime} = ${newTimeBank}`);
            }
          }

          if (isCorrect) {
            const newUsedWords = [...(room.used_words || []), wordId]
            const newScore = (room.cooperation_score || 0) + 1

            // Switch to the other player for the next challenge
            const otherPlayer = room.players.find(p => p.id !== playerId)
            
            await updateRoom(roomId, {
              used_words: newUsedWords,
              cooperation_score: newScore,
              cooperation_waiting: true,
              current_challenge_player: otherPlayer?.id || playerId
            })

            // Emit correct answer event to all players for visual feedback
            console.log(`🎉 Emitting cooperation-correct-answer to room ${roomId}: player ${playerId}, word "${answer}"`);
            io.to(roomId).emit("cooperation-correct-answer", {
              playerId: playerId,
              word: answer
            })

            // Send waiting state and start next challenge
            io.to(roomId).emit("cooperation-waiting", { isWaiting: true })
            setTimeout(() => {
              startCooperationChallenge(roomId, io)
            }, 3000)
          }

          const updatedRoom = await getRoom(roomId)
          io.to(roomId).emit("room-update", { room: updatedRoom })

        } catch (error) {
          console.error(`❌ Error processing cooperation answer:`, error)
        }
      })

      socket.on("cooperation-timeout", async ({ roomId, playerId, data }, callback) => {
        try {
          const room = await getRoom(roomId)
          if (!room || room.game_mode !== "cooperation") {
            return
          }

          const { remainingTime } = data;

          // Handle time bank accumulation for cooperation mode (timeout = 0 remaining time)
          if (remainingTime !== undefined) {
            const timingOutPlayer = room.players.find(p => p.id === playerId);
            if (timingOutPlayer && !timingOutPlayer.receivedExtraTime) {
              const currentTimeBank = timingOutPlayer.timeBank || 0;
              const newTimeBank = Math.min(10, currentTimeBank + remainingTime);
              await updatePlayer(playerId, { 
                timeBank: newTimeBank,
                receivedExtraTime: false // Reset for next round
              });
              console.log(`⏰ Player ${playerId} time bank updated on timeout: ${currentTimeBank} + ${remainingTime} = ${newTimeBank}`);
            }
          }

          const newLives = Math.max(0, (room.cooperation_lives || 3) - 1)
          
          // Switch to the other player for the next challenge
          const otherPlayer = room.players.find(p => p.id !== playerId)
          
          if (newLives === 0) {
            await updateRoom(roomId, {
              cooperation_lives: newLives,
              game_state: "finished"
            })
          } else {
            await updateRoom(roomId, {
              cooperation_lives: newLives,
              cooperation_waiting: true,
              current_challenge_player: otherPlayer?.id || playerId
            })

            // Send waiting state and start next challenge
            io.to(roomId).emit("cooperation-waiting", { isWaiting: true })
            setTimeout(() => {
              startCooperationChallenge(roomId, io)
            }, 3000)
          }

          const updatedRoom = await getRoom(roomId)
          io.to(roomId).emit("room-update", { room: updatedRoom })

        } catch (error) {
          console.error(`❌ Error processing cooperation timeout:`, error)
        }
      })

      // Practice mode timeout handler
      socket.on("practice-timeout", async ({ roomId, playerId }, callback) => {
        try {
          console.log(`⏰ Practice timeout for player ${playerId} in room ${roomId}`);
          
          // Clear the synchronized timer for this room if it exists
          if (practiceTimers.has(roomId)) {
            const timerObj = practiceTimers.get(roomId);
            if (timerObj) clearInterval(timerObj.interval);
            practiceTimers.delete(roomId);
          }
          
          const room = await getRoom(roomId)
          if (!room || room.game_mode !== "practice") {
            console.log(`❌ Invalid room or game mode for practice timeout`);
            return
          }

          // End the practice game for all players
          await updateRoom(roomId, {
            game_state: "finished"
          })

          const updatedRoom = await getRoom(roomId)
          
          // Emit practice timeout event to all players in the room
          io.to(roomId).emit("practice-timeout", {
            playerId: playerId,
            correctAnswer: "Practice session ended"
          })
          
          // Update room state for all players
          io.to(roomId).emit("room-update", { room: updatedRoom })
          
          console.log(`✅ Practice mode ended for room ${roomId}`);
          
          if (callback) {
            callback({ success: true, room: updatedRoom })
          }
          
        } catch (error) {
          console.error(`❌ Error processing practice timeout:`, error)
          if (callback) {
            callback({ error: "Failed to process practice timeout", status: 500 })
          }
        }
      })

      // Practice mode first answer handler
      socket.on("practice-first-answer", ({ roomId, playerId }) => {
        try {
          console.log(`🎯 Practice first answer from player ${playerId} in room ${roomId}`);
          // Broadcast to all players in the room to start their timers (legacy, for backward compatibility)
          io.to(roomId).emit("practice-first-answer", { playerId });

          // If a timer is already running for this room, do nothing
          if (practiceTimers.has(roomId)) return;

          // Start a synchronized timer for the room
          let timeLeft = 60;
          const interval = setInterval(() => {
            timeLeft -= 1;
            // Emit the current time left to all clients
            io.to(roomId).emit("practice-timer-tick", { timeLeft });
            if (timeLeft <= 0) {
              clearInterval(interval);
              practiceTimers.delete(roomId);
              // End the practice game for all players
              io.to(roomId).emit("practice-timeout", {
                playerId: playerId,
                correctAnswer: "Practice session ended"
              });
              
              // Update room state to finished for all players
              updateRoom(roomId, {
                game_state: "finished"
              }).then(async () => {
                const updatedRoom = await getRoom(roomId);
                io.to(roomId).emit("room-update", { room: updatedRoom });
              }).catch(error => {
                console.error(`❌ Error updating room state on practice timeout:`, error);
              });
            }
          }, 1000);
          practiceTimers.set(roomId, { timeLeft, interval });
        } catch (error) {
          console.error(`❌ Error processing practice first answer:`, error)
        }
      });

      // Handle cooperation typing events
      socket.on("cooperation-typing", ({ roomId, playerId, text }) => {
        socket.to(roomId).emit("cooperation-typing", { playerId, text })
      })

      // Handle time donation in cooperation mode
      socket.on("donate-time", async ({ roomId, playerId, data }, callback) => {
        try {
          console.log(`🔄 Processing time donation request:`, { roomId, playerId, data });
          const { amount } = data;
          const room = await getRoom(roomId);
          
          console.log(`📋 Room state for donation:`, {
            gameMode: room?.game_mode,
            gameState: room?.game_state,
            currentChallengePlayer: room?.current_challenge_player,
            fromPlayerTimeBank: room?.players.find(p => p.id === playerId)?.timeBank
          });
          
          if (room?.game_mode === 'cooperation' && room.game_state === 'playing') {
            const fromPlayer = room.players.find(p => p.id === playerId);
            const currentChallengePlayer = room.current_challenge_player;
            const toPlayer = room.players.find(p => p.id === currentChallengePlayer);
            
            console.log(`👥 Players for donation:`, {
              fromPlayer: fromPlayer ? { id: fromPlayer.id, name: fromPlayer.name, timeBank: fromPlayer.timeBank } : null,
              toPlayer: toPlayer ? { id: toPlayer.id, name: toPlayer.name } : null,
              amount: amount
            });
            
            if (fromPlayer && toPlayer && fromPlayer.timeBank >= amount && amount > 0 && amount <= 10) {
              // Deduct from donor's time bank
              const newDonorTimeBank = Math.max(0, fromPlayer.timeBank - amount);
              await updatePlayer(playerId, { timeBank: newDonorTimeBank });
              
              // Mark recipient as having received extra time
              await updatePlayer(currentChallengePlayer, { receivedExtraTime: true });
              
              console.log(`⏰ Time donation successful: ${playerId} donated ${amount}s to ${currentChallengePlayer}`);
              console.log(`💰 Time bank updated: ${fromPlayer.timeBank} -> ${newDonorTimeBank}`);
              
              // Emit time-donated event to extend the active player's timer
              const timeDonatedPayload = { 
                donorName: fromPlayer.name, 
                amount: amount 
              };
              console.log(`📤 Emitting time-donated:`, timeDonatedPayload);
              io.to(roomId).emit("time-donated", timeDonatedPayload);
              
              // Broadcast updated room state
              const updatedRoom = await getRoom(roomId);
              if (updatedRoom) {
                console.log(`📤 Broadcasting room-update after donation`);
                io.to(roomId).emit("room-update", { room: updatedRoom });
              }
              
              callback({ success: true });
            } else {
              console.log(`❌ Donation validation failed:`, {
                fromPlayerExists: !!fromPlayer,
                toPlayerExists: !!toPlayer,
                timeBankSufficient: fromPlayer ? fromPlayer.timeBank >= amount : false,
                amountValid: amount > 0 && amount <= 10
              });
              callback({ error: "Invalid donation amount or player not found" });
            }
          } else {
            console.log(`❌ Invalid game state for donation:`, {
              gameMode: room?.game_mode,
              gameState: room?.game_state
            });
            callback({ error: "Invalid game state for time donation" });
          }
        } catch (err) {
          console.error('Error processing time donation:', err);
          callback({ error: 'Failed to process time donation' });
        }
      })

      // Reset receivedExtraTime flag for new challenges
      socket.on("reset-received-extra-time", async ({ roomId, playerId }) => {
        try {
          const room = await getRoom(roomId);
          if (room?.game_mode === 'cooperation' && room.game_state === 'playing') {
            await updatePlayer(playerId, { receivedExtraTime: false });
            console.log(`🔄 Reset receivedExtraTime for player ${playerId}`);
          }
        } catch (err) {
          console.error('Error resetting receivedExtraTime:', err);
        }
      })

      socket.on("restart", async ({ roomId, playerId }, callback) => {
        try {
          const room = await getRoom(roomId)
          if (!room) {
            return callback({ error: "Room not found", status: 404 })
          }
          const player = room.players.find((p) => p.id === playerId)
          if (!player || !player.is_host) {
            return callback({ error: "Only the room creator can restart the game", status: 403 })
          }
          
          updateRoomActivityTracker(roomId, playerId)
          
          await updateRoom(roomId, {
            game_state: "lobby",
            game_mode: null,
            host_language: null,
            winner_id: null,
            question_count: 0,
            target_score: 100,
            cooperation_lives: null,
            cooperation_score: null,
            used_words: null,
            current_category: null,
            current_challenge_player: null,
            cooperation_waiting: null
          })
          
          for (const p of room.players) {
            await updatePlayer(p.id, { 
              score: 0, 
              ready: false, 
              language: null,
              timeBank: 0,
              receivedExtraTime: false
            })
          }

          const updatedRoom = await getRoom(roomId)
          callback({ room: updatedRoom })
          io.to(roomId).emit("room-update", { room: updatedRoom })
          broadcastAvailableRooms(io)
          
        } catch (error) {
          console.error(`❌ Error restarting game for room ${roomId}:`, error)
          callback({ error: "Failed to restart game", status: 500 })
        }
      })

      socket.on("leave-room", async ({ roomId, playerId }) => {
        try {
          const activity = roomActivityTracker.get(roomId)
          if (activity) {
            activity.players.delete(playerId)
            if (activity.players.size === 0) {
              roomActivityTracker.delete(roomId)
            }
          }
          
          const { roomId: actualRoomId, wasHost, roomDeleted } = await removePlayerFromRoom(playerId, io)
          
          if (!actualRoomId) {
            return
          }
          
          socket.leave(actualRoomId)
          
          // Remove socket-player association
          socketPlayerMap.delete(socket.id)
          
          // Remove player heartbeat tracking
          playerHeartbeats.delete(playerId)
          
          if (roomDeleted) {
            broadcastAvailableRooms(io)
            return
          }
          
          const room = await getRoom(actualRoomId)
          
          if (!room) {
            broadcastAvailableRooms(io)
            return
          }
          
          if (wasHost) {
            io.to(actualRoomId).emit("host-left")
            setTimeout(() => {
              io.to(actualRoomId).emit("error", { message: "Host left the room", status: 404 })
            }, 500)
          } else {
            io.to(actualRoomId).emit("room-update", { room })
          }
          
          broadcastAvailableRooms(io)
          
        } catch (error) {
          console.error(`❌ Error handling leave-room for player ${playerId}:`, error)
          io.to(roomId).emit("error", { message: "Failed to leave room", status: 500 })
        }
      })

      socket.on("disconnect", (reason) => {
        console.log(`🔌 Socket ${socket.id} disconnected:`, reason)
        
        // Find the player and room
        const player = socketPlayerMap.get(socket.id)
        if (!player) {
          console.log("❌ Player not found for disconnected socket")
          return
        }
        
        // Handle different disconnect reasons
        if (reason === 'transport close') {
          console.log("🔄 Transport close detected - keeping player in room for potential reconnection")
          // Transport close usually means network issue, don't immediately remove player
          // Update last seen but keep them in the room for a longer period
          player.lastSeen = new Date()
          
          // Only remove after a longer timeout for transport close
          setTimeout(async () => {
            const currentPlayer = socketPlayerMap.get(socket.id)
            if (currentPlayer) {
              const timeSinceLastSeen = new Date().getTime() - currentPlayer.lastSeen.getTime()
              if (timeSinceLastSeen > 30000) { // 30 seconds for transport close
                console.log("⏰ Player timeout after transport close - removing from room")
                try {
                  await removePlayerFromRoom(player.playerId, io)
                } catch (error) {
                  console.error("❌ Error removing player after transport close:", error)
                }
              }
            }
          }, 30000)
          
          return
        } else if (reason === 'io server disconnect') {
          console.log("🔄 Server initiated disconnect - removing player immediately")
          removePlayerFromRoom(player.playerId, io).catch(error => {
            console.error("❌ Error removing player after server disconnect:", error)
          })
        } else if (reason === 'io client disconnect') {
          console.log("🔌 Client initiated disconnect - removing player immediately")
          removePlayerFromRoom(player.playerId, io).catch(error => {
            console.error("❌ Error removing player after client disconnect:", error)
          })
        } else {
          // Other reasons - use standard timeout logic
          console.log("🔄 Unexpected disconnect - using standard timeout")
          player.lastSeen = new Date()
          
          // Standard timeout for other disconnect reasons
          setTimeout(async () => {
            const currentPlayer = socketPlayerMap.get(socket.id)
            if (currentPlayer) {
              const timeSinceLastSeen = new Date().getTime() - currentPlayer.lastSeen.getTime()
              if (timeSinceLastSeen > 15000) { // 15 seconds for other reasons
                console.log("⏰ Player timeout - removing from room")
                try {
                  await removePlayerFromRoom(player.playerId, io)
                } catch (error) {
                  console.error("❌ Error removing player after timeout:", error)
                }
              }
            }
          }, 15000)
        }
      })

      socket.on("error", (error) => {
        console.error("❌ Socket error:", error)
        if (error.message && error.message.includes("namespace")) {
          socket.emit("namespace-error", { 
            message: "Invalid namespace configuration",
            socketId: socket.id,
            namespace: socket.nsp.name
          })
        }
      })
    })

    res.socket.server.io = io
  }

  res.status(200).end()
}

// Enhanced function to start a cooperation challenge with proper language-based turn system
async function startCooperationChallenge(roomId: string, io: SocketIOServer) {
  try {
    const room = await getRoom(roomId)
    if (!room || room.game_mode !== "cooperation" || room.game_state !== "playing") {
      return
    }

    // Check if game should end
    if ((room.cooperation_lives || 3) <= 0) {
      await updateRoom(roomId, { game_state: "finished" })
      const finalRoom = await getRoom(roomId)
      io.to(roomId).emit("room-update", { room: finalRoom })
      return
    }

    // Get the current challenge player and their language
    const currentChallengePlayer = room.players.find(p => p.id === room.current_challenge_player)
    if (!currentChallengePlayer || !currentChallengePlayer.language) {
      console.error("❌ [COOPERATION] No valid challenge player found")
      return
    }

    const challengeLanguage = currentChallengePlayer.language

    // Create challenge directly instead of using external fetch
    const categories = ["colors", "animals", "food", "vehicles", "clothing", "sports", "household"]
    const randomCategory = categories[Math.floor(Math.random() * categories.length)]
    
    const categoryTranslations = {
      colors: { french: "Couleurs", spanish: "Colores", german: "Farben", japanese: "色", russian: "Цвета" },
      animals: { french: "Animaux", spanish: "Animales", german: "Tiere", japanese: "動物", russian: "Животные" },
      food: { french: "Nourriture", spanish: "Comida", german: "Essen", japanese: "食べ物", russian: "Еда" },
      vehicles: { french: "Véhicules", spanish: "Vehículos", german: "Fahrzeuge", japanese: "乗り物", russian: "Транспорт" },
      clothing: { french: "Vêtements", spanish: "Ropa", german: "Kleidung", japanese: "服", russian: "Одежда" },
      sports: { french: "Sports", spanish: "Deportes", german: "Sport", japanese: "スポーツ", russian: "Спорт" },
      household: { french: "Objets ménagers", spanish: "Artículos del hogar", german: "Haushaltsgegenstände", japanese: "家庭用品", russian: "Предметы быта" }
    }

    const translatedName = categoryTranslations[randomCategory]?.[challengeLanguage] || randomCategory

    const challenge = {
      categoryId: randomCategory,
      categoryName: translatedName,
      englishName: randomCategory.charAt(0).toUpperCase() + randomCategory.slice(1),
      language: challengeLanguage,
      challengeId: `coop-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    }

    // Update room with current challenge info
    await updateRoom(roomId, {
      current_category: challenge.categoryId,
      cooperation_waiting: false
    })

    // Send challenge to all players
    io.to(roomId).emit("cooperation-challenge", { challenge })

  } catch (error) {
    console.error("❌ [COOPERATION] Error starting cooperation challenge:", error)
    // Send error to room
    io.to(roomId).emit("cooperation-error", { 
      message: "Failed to start cooperation challenge",
      error: error.message 
    })
  }
}

// Function to get available rooms with enhanced game mode information
async function getAvailableRooms() {
  try {
    const { Pool } = require("pg")
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    })

    const client = await pool.connect()
    
    try {
      const roomsResult = await client.query(`
        SELECT r.id, r.target_score, r.game_mode, r.host_language, COUNT(p.id) as player_count
        FROM rooms r
        LEFT JOIN players p ON r.id = p.room_id
        WHERE r.game_state = 'lobby'
        AND r.last_activity > NOW() - INTERVAL '1 hour'
        GROUP BY r.id, r.target_score, r.game_mode, r.host_language
        HAVING COUNT(p.id) > 0 AND COUNT(p.id) < 8
        ORDER BY r.created_at DESC
        LIMIT 20
      `)

      const availableRooms = roomsResult.rows.map(row => ({
        id: row.id,
        playerCount: parseInt(row.player_count),
        maxPlayers: row.game_mode === "cooperation" ? 2 : 8,
        status: "waiting" as const,
        targetScore: row.target_score || 100,
        gameMode: row.game_mode,
        hostLanguage: row.host_language,
      }))

      return availableRooms
    } finally {
      client.release()
    }
  } catch (error) {
    console.error("❌ Error fetching available rooms:", error)
    return []
  }
}

// Function to broadcast available rooms to all connected clients
async function broadcastAvailableRooms(io: SocketIOServer) {
  try {
    const availableRooms = await getAvailableRooms()
    io.emit("available-rooms-update", { rooms: availableRooms })
  } catch (error) {
    console.error("❌ Error broadcasting available rooms:", error)
  }
}

// Disable body parsing for Socket.IO
export const config = {
  api: {
    bodyParser: false,
  },
}