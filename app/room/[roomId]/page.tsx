"use client";

import React from "react";
import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SoundButton } from "@/components/ui/sound-button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { FlagIcon, getCountryCode } from "@/components/ui/flag-icon";
import { 
  BookOpen, 
  Zap, 
  Heart, 
  Users, 
  Crown, 
  Check, 
  X, 
  Play, 
  RotateCcw, 
  LogOut, 
  Clock, 
  Target, 
  Award, 
  Trophy, 
  Sparkles, 
  TrendingUp, 
  Globe, 
  Languages, 
  Loader2, 
  Timer,
  Star,
  Gamepad2,
  Settings
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import { useAudio } from "@/lib/audio";
import { getLocalizedStrings, Language } from "@/lib/localization";
import { WORD_DATABASE } from "@/lib/word-database";
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

interface Question {
  questionId: string;
  english: string;
  correctAnswer: string;
  options: string[];
  timeLimit: number; // Added time limit
}

interface Player {
  id: string;
  name: string;
  language: "french" | "german" | "russian" | "japanese" | "spanish" | "english" | null;
  ready: boolean;
  score: number;
  is_host: boolean;
  current_question: Question | null;
  last_seen: Date;
  timeBank: number; // Store accumulated time (0-10 seconds)
}

interface Room {
  id: string;
  players: Player[];
  game_state: "lobby" | "playing" | "finished";
  game_mode: "practice" | "competition" | "cooperation" | null;
  host_language: "french" | "german" | "russian" | "japanese" | "spanish" | "english" | null;
  winner_id?: string;
  last_activity: Date;
  created_at: Date;
  question_count: number;
  target_score: number;
  cooperation_lives?: number;
  cooperation_score?: number;
  used_words?: string[];
  current_category?: string;
  current_challenge_player?: string;
  cooperation_waiting?: boolean;
  receivedExtraTime?: boolean; // Track if current player received donated time
}

interface CooperationChallenge {
  categoryId: string;
  categoryName: string;
  englishName: string;
  language: string;
  challengeId: string;
}

const LANGUAGES = [
  { value: "french", label: "French", country: "fr" },
  { value: "german", label: "German", country: "de" },
  { value: "russian", label: "Russian", country: "ru" },
  { value: "japanese", label: "Japanese", country: "jp" },
  { value: "spanish", label: "Spanish", country: "es" },
] as const;

const TARGET_SCORES = [100, 250, 500] as const;

// Add English to the list of selectable game languages
const GAME_LANGUAGES = [
  { value: "english", label: "English", country: "gb" },
  { value: "french", label: "French", country: "fr" },
  { value: "german", label: "German", country: "de" },
  { value: "russian", label: "Russian", country: "ru" },
  { value: "japanese", label: "Japanese", country: "jp" },
  { value: "spanish", label: "Spanish", country: "es" },
] as const;

// Replace the old BACKGROUND_CHARS with the denser version
const BACKGROUND_CHARS = {
  japanese: ['あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ', 'さ', 'し', 'す', 'せ', 'そ', 'た', 'ち', 'つ', 'て', 'と', 'な', 'に', 'ぬ', 'ね', 'の', 'は', 'ひ', 'ふ', 'へ', 'ほ', 'ま', 'み', 'む', 'め', 'も'],
  russian: ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ё', 'Ж', 'З', 'И', 'Й', 'К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С', 'Т', 'У', 'Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Щ', 'Ъ', 'Ы', 'Ь', 'Э', 'Ю', 'Я'],
  chinese: ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '人', '大', '小', '中', '国', '你', '好', '我', '是', '的', '在', '有', '和', '这', '为', '上', '个', '以', '要', '他', '她', '它', '们', '们', '们'],
  korean: ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하', '기', '니', '디', '리', '미', '비', '시', '이', '지', '치', '키', '티', '피', '히', '구', '누', '두', '루', '무', '부', '수'],
  arabic: ['ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي', 'ة', 'ى', 'ء', 'ئ', 'ؤ', 'إ', 'أ']
};

export default function RoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const audio = useAudio();
  
  // Extract parameters from URL
  const roomId = params.roomId as string;
  const playerId = searchParams.get('playerId');
  const playerName = searchParams.get('name');
  const isHost = searchParams.get('isHost') === 'true';

  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Game state
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState(10);
  const [isAnswering, setIsAnswering] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [questionLoadingError, setQuestionLoadingError] = useState<string | null>(null);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false);
  const [answerFeedback, setAnswerFeedback] = useState<{
    show: boolean;
    isCorrect: boolean;
    correctAnswer: string;
    selectedAnswer: string;
    fadeOut?: boolean;
  } | null>(null);

  // Practice mode timer state
  const [practiceTimer, setPracticeTimer] = useState(60);
  const [practiceTimerActive, setPracticeTimerActive] = useState(false);
  const [practiceWordsAnswered, setPracticeWordsAnswered] = useState(0);
  const [practiceCorrectAnswers, setPracticeCorrectAnswers] = useState(0);
  const [practiceIncorrectAnswers, setPracticeIncorrectAnswers] = useState(0);
  const [practiceAccuracy, setPracticeAccuracy] = useState(0);
  const [practiceFirstAnswerSubmitted, setPracticeFirstAnswerSubmitted] = useState(false);

  // Practice mode background pulse state
  const [practiceBackgroundPulse, setPracticeBackgroundPulse] = useState<'correct' | 'incorrect' | null>(null);

  // Cooperation mode state
  const [cooperationChallenge, setCooperationChallenge] = useState<CooperationChallenge | null>(null);
  const [cooperationAnswer, setCooperationAnswer] = useState("");
  const [cooperationTyping, setCooperationTyping] = useState<{ playerId: string; text: string } | null>(null);
  const [isCooperationWaiting, setIsCooperationWaiting] = useState(false);
  const [cooperationCountdown, setCooperationCountdown] = useState(10);
  const [cooperationTimerActive, setCooperationTimerActive] = useState(false);
  const [cooperationFeedback, setCooperationFeedback] = useState<{
    show: boolean;
    word: string;
    playerName: string;
    fadeOut?: boolean;
  } | null>(null);

  // Competition mode feedback state
  const [competitionFeedback, setCompetitionFeedback] = useState<{
    show: boolean;
    type: 'correct' | 'incorrect' | 'timeout';
    word?: string;
    playerName?: string;
    fadeOut?: boolean;
  } | null>(null);

  // Practice/Competition mode feedback state
  const [practiceCompetitionFeedback, setPracticeCompetitionFeedback] = useState<{
    show: boolean;
    type: 'correct' | 'incorrect' | 'timeout';
    word?: string;
    playerName?: string;
    correctAnswer?: string;
    selectedAnswer?: string;
    fadeOut?: boolean;
  } | null>(null);

  // Mobile UI state
  const [showPlayersDetails, setShowPlayersDetails] = useState(false);
  const [showTimeBank, setShowTimeBank] = useState(false);
  
  // Word suggestion state
  const [wordSuggestion, setWordSuggestion] = useState<{ original: string; suggestion: string } | null>(null);
  const [lastTypedAnswer, setLastTypedAnswer] = useState<string>('');
  
  // Time Bank state
  const [donatedTimeAmount, setDonatedTimeAmount] = useState<number>(1);
  const [isDonating, setIsDonating] = useState(false);

  // Refs to store data before clearing for word suggestions
  const lastAnswerRef = useRef<string>('');
  const lastChallengeRef = useRef<CooperationChallenge | null>(null);
  const preserveFeedbackRef = useRef(false);

  const timerRef = useRef<any>(null);
  const activityPingRef = useRef<any>(null);
  const questionUpdateTimeoutRef = useRef<any>(null);
  const cooperationTimerRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uiLanguage = (searchParams.get('uiLanguage') as Language) || 'english';
  const strings = getLocalizedStrings(uiLanguage);

  // Ref to access current room state in socket event handlers
  const roomRef = useRef<Room | null>(null);
  roomRef.current = room;

  // Ref to access audio object to prevent unnecessary re-renders
  const audioRef = useRef(audio);
  audioRef.current = audio;

  // Add connection retry logic
  const [connectionRetries, setConnectionRetries] = useState(0);
  const maxRetries = 3;
  const retryTimeoutRef = useRef<any>(null);

  // Add heartbeat to keep connection alive
  const heartbeatRef = useRef<any>(null);

  // Add flag to track first question
  const [isFirstQuestion, setIsFirstQuestion] = useState(true);

  // --- FEEDBACK TIMER STATE ---
  const feedbackTimeoutRef = useRef<any>(null);

  // Add new cooperation feedback state
  const [cooperationFeedbackNew, setCooperationFeedbackNew] = useState<{
    show: boolean;
    type: 'correct' | 'timeout';
    word?: string;
    playerName?: string;
    fadeOut?: boolean;
  } | null>(null);

  // Add rules collapse state
  const [rulesCollapsed, setRulesCollapsed] = useState(true);

  // Add at the top level of the RoomPage component:
  const [lobbyTab, setLobbyTab] = useState<'main' | 'rules'>('main');

  // Validate required parameters
  useEffect(() => {
    if (!roomId || !playerId || !playerName) {
      console.error('Missing required parameters:', { roomId, playerId, playerName });
      alert('Missing required parameters. Redirecting to home page.');
      router.push('/');
    }
  }, [roomId, playerId, playerName, router]);

  // Monitor wordSuggestion state changes for debugging
  useEffect(() => {
    console.log('🔍 [WORD SUGGESTION DEBUG] wordSuggestion state changed:', wordSuggestion);
  }, [wordSuggestion]);

  // Monitor lastTypedAnswer state changes for debugging
  useEffect(() => {
    console.log('🔍 [WORD SUGGESTION DEBUG] lastTypedAnswer state changed:', lastTypedAnswer);
  }, [lastTypedAnswer]);

  // Debug wordDatabase import
  useEffect(() => {
    console.log('🔍 [WORD SUGGESTION DEBUG] wordDatabase loaded:', {
      totalWords: WORD_DATABASE.length,
      sampleWords: WORD_DATABASE.slice(0, 3).map(w => ({ word: w.english, category: w.category, language: 'english' })),
      categories: Array.from(new Set(WORD_DATABASE.map(w => w.category))).slice(0, 5)
    });
    
    // Test if we can find vehicles category
    const vehiclesWords = WORD_DATABASE.filter(w => w.category === 'vehicles');
    console.log('🔍 [WORD SUGGESTION DEBUG] Vehicles words found:', vehiclesWords.length);
    if (vehiclesWords.length > 0) {
      console.log('🔍 [WORD SUGGESTION DEBUG] Sample vehicles:', vehiclesWords.slice(0, 3).map(w => ({ english: w.english, french: w.french, spanish: w.spanish })));
    }
  }, []);

  // Load initial question when game starts
  useEffect(() => {
    if (
      room?.game_state === "playing" &&
      (room.game_mode === "practice" || room.game_mode === "competition") &&
      !currentQuestion &&
      !isLoadingQuestion
    ) {
      loadQuestion(room);
    }
  }, [room, currentQuestion, isLoadingQuestion]);

    // Start cooperation timer and focus input when conditions are met
  useEffect(() => {
    if (
      room?.game_state === "playing" &&
      room.game_mode === "cooperation" &&
      cooperationChallenge &&
      !cooperationTimerActive
    ) {
      console.log("Starting cooperation timer for all players");
      startCooperationTimer();
      
      // Auto-focus input only for the active player
      if (room.current_challenge_player === playerId && inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [room, cooperationChallenge, cooperationTimerActive, playerId]);

  // Handle time donation events
  useEffect(() => {
    if (!socket) return;
    const handler = ({ donorName, amount }: { donorName: string; amount: number }) => {
      // Only extend timer if this player is the current challenge player (active player)
      if (room?.current_challenge_player === playerId) {
        if (cooperationTimerRef.current) {
          setCooperationCountdown((prev: number) => {
            const newTime = prev + amount;
            console.log(`⏰ Timer extended: ${prev} + ${amount} = ${newTime}`);
            return newTime;
          });
        }
        setError(`⏰ ${donorName} donated ${amount} seconds! Timer extended.`);
        setTimeout(() => setError(null), 3000);
      } else {
        setError(`${donorName} donated ${amount} seconds to the active player.`);
        setTimeout(() => setError(null), 2000);
      }
    };
    socket.on("time-donated", handler);
    return () => {
      socket.off("time-donated", handler);
    };
  }, [socket, room?.current_challenge_player, playerId]);

  // Handle clocktick sound when current challenge player changes
  useEffect(() => {
    if (room?.game_mode === "cooperation" && room?.game_state === "playing") {
      if (room.current_challenge_player === playerId && cooperationTimerActive) {
        // It's this player's turn and timer is active, start clocktick
        audioRef.current.startClocktick();
      } else {
        // It's not this player's turn or timer is not active, stop clocktick
        audioRef.current.stopClocktick();
      }
    } else {
      // Not in cooperation mode or game not playing, stop clocktick
      audioRef.current.stopClocktick();
    }
  }, [room?.current_challenge_player, playerId, cooperationTimerActive, room?.game_mode, room?.game_state]);

  // Start cooperation timer for all players when challenge starts
  useEffect(() => {
    if (
      room?.game_state === "playing" &&
      room.game_mode === "cooperation" &&
      cooperationChallenge &&
      !cooperationTimerActive
    ) {
      console.log("Starting cooperation timer for all players");
      startCooperationTimer();
    }
  }, [room?.game_state, room?.game_mode, cooperationChallenge, cooperationTimerActive]);

  // Stop clocktick when game finishes (lives reach 0)
  useEffect(() => {
    if (room?.game_mode === "cooperation" && room?.cooperation_lives === 0) {
      audioRef.current.stopClocktick();
    }
  }, [room?.cooperation_lives, room?.game_mode]);

  // Play lost sound when cooperation game finishes (only once)
  const [hasPlayedLostSound, setHasPlayedLostSound] = useState(false);

    // Listen for server-synchronized timer ticks
  useEffect(() => {
    if (!socket) return;
    const handleTick = ({ timeLeft }: { timeLeft: number }) => {
      setPracticeTimer(timeLeft);
      if (timeLeft <= 0) {
        setPracticeTimerActive(false);
      }
    };
    socket.on("practice-timer-tick", handleTick);
    return () => {
      socket.off("practice-timer-tick", handleTick);
    };
  }, [socket]);

  // Stop timer and set to 0 on practice-timeout
  useEffect(() => {
    if (!socket) return;
    const handleTimeout = () => {
      setPracticeTimer(0);
      setPracticeTimerActive(false);
      setRoom((prevRoom: Room | null) => prevRoom ? { ...prevRoom, game_state: "finished" } : prevRoom);
      // Calculate final accuracy for practice mode
      const totalAnswers = practiceCorrectAnswers + practiceIncorrectAnswers;
      const accuracy = totalAnswers > 0 ? Math.round((practiceCorrectAnswers / totalAnswers) * 100) : 0;
      setPracticeAccuracy(accuracy);
      // Show final feedback
      setPracticeCompetitionFeedback({
        show: true,
        type: 'timeout',
        word: "Practice session ended",
        playerName: room?.players.find(p => p.id === playerId)?.name || 'Player',
        correctAnswer: "Practice session ended",
        fadeOut: false
      });
      // Clear feedback after 3 seconds
      setTimeout(() => {
        setPracticeCompetitionFeedback((fb: typeof practiceCompetitionFeedback | null) => fb ? { ...fb, fadeOut: true } : null);
        setTimeout(() => setPracticeCompetitionFeedback(null), 500);
      }, 3000);
    };
    socket.on("practice-timeout", handleTimeout);
    return () => {
      socket.off("practice-timeout", handleTimeout);
    };
  }, [socket, practiceCorrectAnswers, practiceIncorrectAnswers, room, playerId]);

    // After all function declarations, add:
    useEffect(() => {
      if (!socket) return;
      const handler = ({ playerId: answerPlayerId }: { playerId: string }) => {
        console.log("🎯 First answer submitted in practice mode by player:", answerPlayerId);
        if (!practiceTimerActive && !practiceFirstAnswerSubmitted) {
          console.log("🚀 Starting practice timer on first answer");
          setPracticeFirstAnswerSubmitted(true);
          setPracticeTimerActive(true);
        }
      };
      socket.on("practice-first-answer", handler);
      return () => {
        socket.off("practice-first-answer", handler);
      };
    }, [socket, practiceTimerActive, practiceFirstAnswerSubmitted]);
  
  useEffect(() => {
    if (room?.game_state === "finished" && room?.game_mode === "cooperation" && !hasPlayedLostSound) {
      audioRef.current.playLost();
      setHasPlayedLostSound(true);
    }
  }, [room?.game_state, room?.game_mode, hasPlayedLostSound]);

  // Reset lost sound flag when game starts
  useEffect(() => {
    if (room?.game_state === "playing") {
      setHasPlayedLostSound(false);
    }
  }, [room?.game_state]);

  // Cleanup clocktick sound when component unmounts
  useEffect(() => {
    return () => {
      audioRef.current.stopClocktick();
    };
  }, []);

  // Handle page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (socket && playerId) {
        console.log("🚪 Page unloading - leaving room...");
        socket.emit("leave-room", { roomId, playerId });
      }
    };

    const handlePageHide = () => {
      if (socket && playerId) {
        console.log("📱 Page hidden - leaving room...");
        socket.emit("leave-room", { roomId, playerId });
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && socket && playerId) {
        console.log("👁️ Page visibility changed to hidden - updating activity...");
        // Instead of leaving the room, just update activity to prevent timeout
        socket.emit("update-activity", { roomId, playerId });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [socket, roomId, playerId]);

  // Initialize socket connection
  useEffect(() => {
    if (!roomId || !playerId || !playerName) return;

    console.log("🔌 Initializing Socket.IO connection for room...");
    console.log("📋 Room parameters:", { roomId, playerId, playerName, isHost });
    
    const newSocket = io({
      path: "/api/socketio",
      addTrailingSlash: false,
      transports: ["polling"],
      upgrade: false,
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      autoConnect: true,
      rememberUpgrade: false,
      // Add these options to handle session issues
      query: {
        roomId,
        playerId,
        timestamp: Date.now().toString()
      },
      // Ensure proper session handling
      withCredentials: false,
      // Add connection timeout
      connectTimeout: 20000,
    });

    newSocket.on("connect", () => {
      console.log("✅ Connected to server successfully");
      console.log("  - Socket ID:", newSocket.id);
      setConnectionStatus('connected');
      setError(null);
      
      // Start heartbeat to keep connection alive
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      heartbeatRef.current = setInterval(() => {
        if (newSocket.connected) {
          newSocket.emit("ping");
        }
      }, 30000); // Send ping every 30 seconds
      
      // Start periodic room activity updates
      if (activityPingRef.current) {
        clearInterval(activityPingRef.current);
      }
      activityPingRef.current = setInterval(() => {
        if (newSocket.connected && roomId) {
          newSocket.emit("update-activity", { roomId, playerId });
        }
      }, 60000); // Update activity every 60 seconds
      
      // Join or create room with proper error handling
      if (isHost) {
        console.log(`🏠 Creating room ${roomId} as host`);
        newSocket.emit("create-room", { 
          roomId, 
          playerId, 
          data: { targetScore: 100 } 
        }, (response: any) => {
          console.log("📡 Create room response:", response);
          if (response.error) {
            console.error("❌ Failed to create room:", response.error);
            setError(response.error);
            setIsLoading(false);
          } else {
            console.log("✅ Room created successfully:", response.room);
            setRoom(response.room);
            
            // Now add the host player to the room
            newSocket.emit("join-room", { 
              roomId, 
              playerId, 
              data: { name: decodeURIComponent(playerName), isHost: true } 
            }, (joinResponse: any) => {
              console.log("📡 Join room response:", joinResponse);
              if (joinResponse.error) {
                console.error("❌ Failed to join created room:", joinResponse.error);
                setError(joinResponse.error);
              } else {
                console.log("✅ Host joined room successfully:", joinResponse.room);
                setRoom(joinResponse.room);
              }
              setIsLoading(false);
            });
          }
        });
      } else {
        console.log(`👤 Joining room ${roomId} as player`);
        newSocket.emit("join-room", { 
          roomId, 
          playerId, 
          data: { name: decodeURIComponent(playerName), isHost: false } 
        }, (response: any) => {
          console.log("📡 Join room response:", response);
          if (response.error) {
            console.error("❌ Failed to join room:", response.error);
            setError(response.error);
            setIsLoading(false);
          } else {
            console.log("✅ Joined room successfully:", response.room);
            setRoom(response.room);
            setIsLoading(false);
          }
        });
      }
    });

    newSocket.on("connect_error", (error: any) => {
      console.error("❌ Socket connection error:", error);
      setConnectionStatus('error');
      
      // Handle specific session ID errors
      if (error.message && error.message.includes("Session ID unknown")) {
        console.log("🔄 Session ID unknown - attempting reconnection...");
        setError("Connection issue detected. Reconnecting...");
        
        // Force a new connection after a short delay
        setTimeout(() => {
          if (newSocket) {
            newSocket.disconnect();
            newSocket.connect();
          }
        }, 1000);
      } else if (error.message?.includes('Room closed') || error.status === 404) {
        // Handle room closure errors more gracefully
        console.log("🚪 Room closure detected, attempting to rejoin...");
        setError("Room connection lost. Attempting to reconnect...");
        
        // Try to rejoin the room after a delay
        setTimeout(() => {
          if (newSocket && newSocket.connected) {
            newSocket.emit("join-room", { 
              roomId, 
              playerId, 
              data: { name: decodeURIComponent(playerName), isHost } 
            });
          }
        }, 2000);
      } else {
        setError(`Connection failed: ${error.message || 'Unknown error'}`);
      }
      setIsLoading(false);
    });

    newSocket.on("disconnect", (reason) => {
      console.log(`🔌 Socket ${newSocket.id} disconnected:`, reason)
      setConnectionStatus('error')
      
      // Handle different disconnect reasons
      if (reason === 'transport close') {
        console.log("🔄 Transport close detected - attempting reconnection...")
        // Transport close usually means network issue, try to reconnect
        setTimeout(() => {
          if (newSocket.disconnected) {
            console.log("🔄 Attempting to reconnect after transport close...")
            newSocket.connect()
          }
        }, 1000)
      } else if (reason === 'io server disconnect') {
        // Server initiated disconnect
        console.log("🔄 Server initiated disconnect - attempting reconnection...")
        setTimeout(() => {
          if (newSocket.disconnected) {
            newSocket.connect()
          }
        }, 2000)
      } else if (reason === 'io client disconnect') {
        // Client initiated disconnect - don't auto-reconnect
        console.log("🔌 Client initiated disconnect")
      } else {
        // Other reasons - try to reconnect if in active game
        if (room?.game_state === "playing" && roomId && playerId) {
          console.log("🔄 Unexpected disconnect during active game - attempting reconnection...")
          setTimeout(() => {
            if (newSocket.disconnected) {
              newSocket.connect()
            }
          }, 2000)
        }
      }
    });

    newSocket.on("room-update", ({ room: updatedRoom }: { room: Room }) => {
      console.log('Room update (hyphen) received:', updatedRoom);
      setRoom(updatedRoom);
      setError(null);
      // Clear word suggestion when returning to lobby
      if (updatedRoom.game_state === 'lobby') {
        setWordSuggestion(null);
        setCompetitionFeedback(null);
      }
    });

    // Handle pong responses from server
    newSocket.on("pong", () => {
      console.log("💓 Heartbeat response received from server");
    });

    newSocket.on("cooperation-challenge", ({ challenge }: { challenge: CooperationChallenge }) => {
      console.log("🤝 Cooperation challenge received:", challenge);
      // If you see a TS error here, set 'lib' to 'es2016' or later in tsconfig.json. This is a string[] and should support includes.
      const validCategoryIds: string[] = ['colors', 'animals', 'food', 'vehicles', 'clothing', 'sports', 'household'];
      if (!validCategoryIds.includes(challenge.categoryId)) {
        console.warn("⚠️ Received invalid categoryId:", challenge.categoryId);
        newSocket?.emit("error-report", {
          roomId,
          playerId,
          data: { message: `Invalid categoryId received: ${challenge.categoryId}` }
        });
        setError("Invalid category received from server");
        setTimeout(() => setError(null), 3000);
        return;
      }
      
      // Check if we should preserve feedback (if it was just shown)
      const shouldPreserveFeedback = preserveFeedbackRef.current;
      preserveFeedbackRef.current = false;
      
      setCooperationChallenge(challenge);
      setIsCooperationWaiting(false);
      setCooperationAnswer("");
      setCooperationTyping(null);
      setWordSuggestion(null); // Clear word suggestion when new challenge starts
      setLastTypedAnswer(''); // Clear stored answer when new challenge starts
      
      // Only clear cooperation feedback if we shouldn't preserve it
      if (!shouldPreserveFeedback) {
        setCooperationFeedback(null);
      } else {
        // If we're preserving feedback, show it for a short time while the question loads
        setTimeout(() => {
          setCooperationFeedback((prev: any) => prev ? { ...prev, fadeOut: true } : null);
          setTimeout(() => {
            setCooperationFeedback(null);
            preserveFeedbackRef.current = false;
          }, 500); // Fade-out animation duration
        }, 3000); // Show feedback for 3 seconds while question loads
      }
      
      // Auto-focus input when it's the player's turn
      if (room?.current_challenge_player === playerId && inputRef.current) {
        inputRef.current.focus();
      }
    });

    newSocket.on("cooperation-waiting", ({ isWaiting }: { isWaiting: boolean }) => {
      console.log("⏳ Cooperation waiting state:", isWaiting);
      console.log('🔍 [WORD SUGGESTION DEBUG] Waiting event - lastAnswerRef:', lastAnswerRef.current);
      console.log('🔍 [WORD SUGGESTION DEBUG] Waiting event - lastChallengeRef:', lastChallengeRef.current);
      console.log('🔍 [WORD SUGGESTION DEBUG] Waiting event - current player:', playerId);
      console.log('🔍 [WORD SUGGESTION DEBUG] Waiting event - active player:', room?.current_challenge_player);
      
      setIsCooperationWaiting(isWaiting);
      if (isWaiting) {
        // Use data from refs (stored before clearing)
        const currentAnswer = lastAnswerRef.current;
        const currentChallenge = lastChallengeRef.current;
        
        // Show word suggestion if the player has typed something
        if (currentAnswer.trim() && currentChallenge) {
          console.log('🔍 [WORD SUGGESTION DEBUG] Processing suggestion for:', currentAnswer);
          const suggestion = findClosestWord(
            currentAnswer, 
            currentChallenge.categoryId, 
            currentChallenge.language
          );
          console.log('🔍 [WORD SUGGESTION DEBUG] Found suggestion:', suggestion);
          
          if (suggestion && suggestion.toLowerCase() !== currentAnswer.toLowerCase()) {
            console.log('🔍 [WORD SUGGESTION DEBUG] Setting word suggestion:', { original: currentAnswer, suggestion });
            setWordSuggestion({
              original: currentAnswer,
              suggestion: suggestion
            });
          } else {
            console.log('🔍 [WORD SUGGESTION DEBUG] No valid suggestion found or suggestion same as original');
          }
        } else {
          console.log('🔍 [WORD SUGGESTION DEBUG] No answer or challenge to process');
        }
        
        // Clear state after processing suggestion
        setCooperationChallenge(null);
        setCooperationAnswer("");
        setCooperationTyping(null);
        setLastTypedAnswer(""); // Clear stored answer
        stopCooperationTimer();
        
        // Clear refs after processing
        lastAnswerRef.current = '';
        lastChallengeRef.current = null;
      }
    });

    newSocket.on("cooperation-typing", ({ playerId: typingPlayerId, text }: { playerId: string; text: string }) => {
      if (typingPlayerId !== playerId) {
        setCooperationTyping({ playerId: typingPlayerId, text });
      }
    });

    newSocket.on("cooperation-correct-answer", ({ playerId: answerPlayerId, word }: { playerId: string; word: string }) => {
      const currentRoom = roomRef.current;
      const answeringPlayer = currentRoom?.players.find((p: Player) => p.id === answerPlayerId);
      if (answeringPlayer) {
        // Set flag to preserve feedback when next challenge arrives
        preserveFeedbackRef.current = true;
        
        setCooperationFeedback({
          show: true,
          word: word,
          playerName: answeringPlayer.name
        });
        
        // Don't auto-hide the feedback - let it display until the next question loads
        // The feedback will be cleared when the next cooperation challenge arrives
      }
    });

    // Cooperation feedback events for both players
    newSocket.on("cooperation-feedback", ({ playerId: answerPlayerId, word, type }: { playerId: string; word: string; type: 'correct' | 'timeout' }) => {
      const currentRoom = roomRef.current;
      const answeringPlayer = currentRoom?.players.find((p: Player) => p.id === answerPlayerId);
      if (answeringPlayer) {
        setCooperationFeedback({
          show: true,
          word: word,
          playerName: answeringPlayer.name,
          fadeOut: false
        });
        
        // Clear feedback after 2 seconds
        setTimeout(() => {
          setCooperationFeedback((fb: typeof cooperationFeedback | null) => fb ? { ...fb, fadeOut: true } : null);
          setTimeout(() => setCooperationFeedback(null), 500);
        }, 2000);
      }
    });

    // Competition feedback events
    newSocket.on("competition-correct-answer", ({ playerId: answerPlayerId, word }: { playerId: string; word: string }) => {
      const currentRoom = roomRef.current;
      const answeringPlayer = currentRoom?.players.find((p: Player) => p.id === answerPlayerId);
      if (answeringPlayer) {
        // Calculate points: 10 - (time taken to answer)
        const points = Math.max(1, 10 - (currentQuestion.timeLimit - timeLeft));
        // Update score for current player
        setRoom((prevRoom: Room | null) => {
          if (!prevRoom) return prevRoom;
          return {
            ...prevRoom,
            players: prevRoom.players.map(p =>
              p.id === playerId ? { ...p, score: (p.score || 0) + points } : p
            )
          };
        });
        setCompetitionFeedback({
          show: true,
          type: 'correct',
          word: word,
          playerName: answeringPlayer.name,
          fadeOut: false
        });
      }
    });

    newSocket.on("competition-incorrect-answer", ({ playerId: answerPlayerId, correctAnswer }: { playerId: string; correctAnswer: string }) => {
      const currentRoom = roomRef.current;
      const answeringPlayer = currentRoom?.players.find((p: Player) => p.id === answerPlayerId);
      if (answeringPlayer) {
        setCompetitionFeedback({
          show: true,
          type: 'incorrect',
          word: correctAnswer,
          playerName: answeringPlayer.name,
          fadeOut: false
        });
      }
    });

    newSocket.on("competition-timeout", ({ playerId: timeoutPlayerId }: { playerId: string }) => {
      const currentRoom = roomRef.current;
      const timeoutPlayer = currentRoom?.players.find((p: Player) => p.id === timeoutPlayerId);
      if (timeoutPlayer) {
        setCompetitionFeedback({
          show: true,
          type: 'timeout',
          playerName: timeoutPlayer.name,
          fadeOut: false
        });
      }
    });

    // Practice feedback events
    newSocket.on("practice-correct-answer", ({ playerId: answerPlayerId, word }: { playerId: string; word: string }) => {
      const currentRoom = roomRef.current;
      const answeringPlayer = currentRoom?.players.find((p: Player) => p.id === answerPlayerId);
      if (answeringPlayer) {
        setPracticeCompetitionFeedback({
          show: true,
          type: 'correct',
          word: word,
          playerName: answeringPlayer.name,
          correctAnswer: word,
          fadeOut: false
        });
        // Clear feedback after 2 seconds
        setTimeout(() => {
          setPracticeCompetitionFeedback((fb: typeof practiceCompetitionFeedback | null) => fb ? { ...fb, fadeOut: true } : null);
          setTimeout(() => setPracticeCompetitionFeedback(null), 500);
        }, 2000);
      }
    });

    newSocket.on("practice-incorrect-answer", ({ playerId: answerPlayerId, correctAnswer, selectedAnswer }: { playerId: string; correctAnswer: string; selectedAnswer: string }) => {
      const currentRoom = roomRef.current;
      const answeringPlayer = currentRoom?.players.find((p: Player) => p.id === answerPlayerId);
      if (answeringPlayer) {
        setPracticeCompetitionFeedback({
          show: true,
          type: 'incorrect',
          word: correctAnswer,
          playerName: answeringPlayer.name,
          correctAnswer: correctAnswer,
          selectedAnswer: selectedAnswer,
          fadeOut: false
        });
        // Clear feedback after 2 seconds
        setTimeout(() => {
          setPracticeCompetitionFeedback((fb: typeof practiceCompetitionFeedback | null) => fb ? { ...fb, fadeOut: true } : null);
          setTimeout(() => setPracticeCompetitionFeedback(null), 500);
        }, 2000);
      }
    });

    newSocket.on("practice-timeout", ({ playerId: timeoutPlayerId, correctAnswer }: { playerId: string; correctAnswer: string }) => {
      console.log("⏰ Practice timeout received for player:", timeoutPlayerId);
      // Stop the practice timer (no longer needed)
      // stopPracticeTimer();
      const currentRoom = roomRef.current;
      const timeoutPlayer = currentRoom?.players.find((p: Player) => p.id === timeoutPlayerId);
      if (timeoutPlayer) {
        setPracticeCompetitionFeedback({
          show: true,
          type: 'timeout',
          word: correctAnswer,
          playerName: timeoutPlayer.name,
          correctAnswer: correctAnswer,
          fadeOut: false
        });
        // Clear feedback after 2 seconds
        setTimeout(() => {
          setPracticeCompetitionFeedback((fb: typeof practiceCompetitionFeedback | null) => fb ? { ...fb, fadeOut: true } : null);
          setTimeout(() => setPracticeCompetitionFeedback(null), 500);
        }, 2000);
      }
    });

    newSocket.on("practice-score-update", (updatedRoom: Room) => {
      console.log('Practice score update:', updatedRoom);
      setRoom(updatedRoom);
    });

    // Practice mode first answer detection
    newSocket.on("practice-first-answer", ({ playerId: answerPlayerId }: { playerId: string }) => {
      console.log("🎯 First answer submitted in practice mode by player:", answerPlayerId);
      
      // Start the timer if it hasn't been started yet
      if (!practiceTimerActive && !practiceFirstAnswerSubmitted) {
        console.log("🚀 Starting practice timer on first answer");
        setPracticeFirstAnswerSubmitted(true);
        setPracticeTimerActive(true);
      }
    });

    newSocket.on("host-left", () => {
      console.log("👑 Host left the room");
      setError("Host left the room. You will be redirected to the home page.");
      setTimeout(() => {
        router.push('/');
      }, 3000);
    });

    newSocket.on("error", (errorData: any) => {
      console.log("❌ Socket error:", errorData);
      
      // Handle specific error types
      if (errorData.message === "Room closed - no players remaining") {
        setError("Room was closed because all players left.");
        setTimeout(() => {
          router.push('/');
        }, 3000);
      } else if (errorData.message === "Host disconnected") {
        // Don't immediately redirect - give time for reconnection
        setError("Host disconnected. Attempting to reconnect...");
        setTimeout(() => {
          if (connectionStatus === 'error') {
            setError("Unable to reconnect. Redirecting to home page.");
            setTimeout(() => {
              router.push('/');
            }, 2000);
          }
        }, 5000);
      } else {
        setError(`Connection error: ${errorData.message}`);
      }
    });

    newSocket.on("disconnect", (reason: any) => {
      setConnectionStatus('connecting');
    });

    newSocket.on("reconnect", (attemptNumber: any) => {
      setConnectionStatus('connected');
      setError(null);
    });

    newSocket.on('cooperation_game_finished', (data: any) => {
      console.log('Cooperation game finished:', data);
      setRoom((prev: Room | null) => {
        if (!prev) return prev;
        return {
          ...prev,
          game_state: 'finished',
          cooperation_score: (data as any).final_score,
          cooperation_lives: 0
        };
      });
      
      // Play lost sound only once when game finishes
      audioRef.current.playLost();
      
      // Show word suggestion if game ended due to timeout and there was typed text
      // Note: cooperationAnswer might be cleared by this point, so we check if there's a stored suggestion
      if (data.reason === 'timeout' && cooperationAnswer.trim()) {
        const suggestion = findClosestWord(
          cooperationAnswer, 
          cooperationChallenge?.categoryId || '', 
          cooperationChallenge?.language || ''
        );
        
        if (suggestion && suggestion.toLowerCase() !== cooperationAnswer.toLowerCase()) {
          setWordSuggestion({
            original: cooperationAnswer,
            suggestion: suggestion
          });
        }
      }
    });

    newSocket.on('game_finished', (data: any) => {
      console.log('Game finished:', data);
      setRoom((prev: Room | null) => {
        if (!prev) return prev;
        return {
          ...prev,
          game_state: 'finished',
          winner_id: (data as any).winner_id
        };
      });
      
      // Play appropriate sound based on result
      if (data.winner_id === playerId) {
        audioRef.current.playSuccess();
      } else {
        audioRef.current.playFailure();
      }
    });

    newSocket.on('game_started', (updatedRoom: Room) => {
      console.log('Game started:', updatedRoom);
      setRoom(updatedRoom);
      setError(null);
      setCooperationAnswer('');
      // Don't clear cooperation feedback immediately - let it display for its full duration
      // setCooperationFeedback(null);
      setWordSuggestion(null); // Clear word suggestion for new game
      setLastTypedAnswer(''); // Clear stored answer for new game
      setCompetitionFeedback(null); // Clear competition feedback for new game
      setPracticeCompetitionFeedback(null); // Clear practice/competition feedback for new game
      setIsFirstQuestion(true); // Reset first question flag
      // Reset timer-related state
      setPracticeTimer(60);
      setPracticeFirstAnswerSubmitted(false);
      if (updatedRoom.game_mode === "practice") {
        setPracticeTimerActive(true);
        console.log("🎮 Practice mode game started - initializing state");
        setPracticeWordsAnswered(0);
        setPracticeCorrectAnswers(0);
        setPracticeIncorrectAnswers(0);
        setPracticeAccuracy(0);
        setPracticeBackgroundPulse(null);
        // Load first question for practice mode
        setTimeout(() => {
          loadQuestion(updatedRoom);
        }, 1000);
      } else {
        setPracticeTimerActive(false);
      }
    });

    newSocket.on('room_restarted', (updatedRoom: Room) => {
      console.log('Room restarted:', updatedRoom);
      setRoom(updatedRoom);
      setError(null);
      setCooperationAnswer('');
      setCooperationFeedback(null);
      setWordSuggestion(null);
      setLastTypedAnswer('');
      setCurrentQuestion(null);
      // Don't clear answer feedback immediately - let it fade out naturally
      // setAnswerFeedback(null);
      setCompetitionFeedback(null);
      setPracticeCompetitionFeedback(null); // Clear practice/competition feedback for new game
      setIsFirstQuestion(true); // Reset first question flag
      // Reset timer-related state
      setPracticeTimer(60);
      setPracticeFirstAnswerSubmitted(false);
      if (updatedRoom.game_mode === "practice") {
        setPracticeTimerActive(true);
        console.log("🔄 Practice mode room restarted - initializing state");
        setPracticeWordsAnswered(0);
        setPracticeCorrectAnswers(0);
        setPracticeIncorrectAnswers(0);
        setPracticeAccuracy(0);
        setPracticeBackgroundPulse(null);
        // Load first question for practice mode
        setTimeout(() => {
          loadQuestion(updatedRoom);
        }, 1000);
      } else {
        setPracticeTimerActive(false);
      }
    });

    setSocket(newSocket);

    // Set up activity ping
    activityPingRef.current = setInterval(() => {
      if (newSocket.connected) {
        newSocket.emit("room-activity-ping", { roomId, playerId });
      }
    }, 30000); // Ping every 30 seconds

    return () => {
      if (activityPingRef.current) {
        clearInterval(activityPingRef.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (questionUpdateTimeoutRef.current) {
        clearTimeout(questionUpdateTimeoutRef.current);
      }
      if (cooperationTimerRef.current) {
        clearInterval(cooperationTimerRef.current);
      }
      newSocket.close();
    };
  }, [roomId, playerId, playerName, isHost, router]);

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      // Cleanup function that runs when component unmounts
      if (socket && playerId) {
        console.log("🧹 Component unmounting - cleaning up socket connection...");
        socket.emit("leave-room", { roomId, playerId });
        socket.disconnect();
      }
      
      // Clear all timers
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (activityPingRef.current) {
        clearInterval(activityPingRef.current);
      }
      if (questionUpdateTimeoutRef.current) {
        clearTimeout(questionUpdateTimeoutRef.current);
      }
      if (cooperationTimerRef.current) {
        clearInterval(cooperationTimerRef.current);
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, [socket, roomId, playerId]);

  // Enhanced question loading with proper language detection
  const loadQuestion = async (currentRoom: Room) => {
    if (isLoadingQuestion) {
      console.log("⏳ Question already loading, skipping...");
      return;
    }

    setIsLoadingQuestion(true);
    setQuestionLoadingError(null);

    try {
      // Determine source and target languages
      let sourceLanguage = uiLanguage;
      let targetLanguage = currentRoom.game_mode === "practice" 
        ? currentPlayer?.language 
        : currentRoom.host_language;

      // Ensure we have valid languages
      if (!targetLanguage) {
        throw new Error("No target language selected");
      }

      const response = await fetch('/api/get-question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceLanguage,
          targetLanguage,
          roomId: currentRoom.id,
          playerId: playerId
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.question) {
        setCurrentQuestion(data.question);
        setSelectedAnswer("");
        
        // Clear feedback when new question loads
        setAnswerFeedback(null);
        setCompetitionFeedback(null);
        setIsAnswering(false);
        
        setTimeLeft(10);
        setQuestionStartTime(Date.now());
        
        // Clear any existing timer first
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        
        // Start timer for competition mode only (practice mode has its own 60-second timer)
        if (currentRoom.game_mode === "competition") {
          timerRef.current = setInterval(() => {
            setTimeLeft((prev: number) => {
              if (prev <= 1) {
                clearInterval(timerRef.current!);
                timerRef.current = null;
                // Auto-submit when time runs out
                handleAnswerSubmit("", true);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
        
        // Always mark first question as done
        setIsFirstQuestion(false);
      } else {
        throw new Error('Invalid question data received');
      }
    } catch (error: any) {
      setQuestionLoadingError(`Failed to load question: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoadingQuestion(false);
    }
  };

  // Cooperation timer with proper functionality
  const startCooperationTimer = () => {
    setCooperationCountdown(10);
    setCooperationTimerActive(true);
    
    // Start clocktick sound for the current player
    if (room.current_challenge_player === playerId) {
      audioRef.current.startClocktick();
    }
    
    // Reset receivedExtraTime flag for new challenge
    if (socket) {
      socket.emit("reset-received-extra-time", { roomId, playerId });
    }
    
    if (cooperationTimerRef.current) {
      clearInterval(cooperationTimerRef.current);
    }
    
    cooperationTimerRef.current = setInterval(() => {
      setCooperationCountdown((prev: number) => {
        const newTime = prev - 1;
        if (newTime <= 0) {
          clearInterval(cooperationTimerRef.current!);
          handleCooperationTimeout();
          return 0;
        }
        return newTime;
      });
    }, 1000);
  };

  const stopCooperationTimer = () => {
    setCooperationTimerActive(false);
    audioRef.current.stopClocktick();
    
    if (cooperationTimerRef.current) {
      clearInterval(cooperationTimerRef.current);
      cooperationTimerRef.current = null;
    }
  };

  // Handle cooperation answer submissions
  const handleCooperationAnswer = async () => {
    if (!cooperationAnswer.trim() || !cooperationChallenge) return;

    const normalizedAnswer = cooperationAnswer.trim();
    console.log('🔍 [WORD SUGGESTION DEBUG] Submitting answer:', normalizedAnswer);
    
    try {
      const response = await fetch('/api/validate-cooperation-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categoryId: cooperationChallenge.categoryId,
          answer: normalizedAnswer,
          language: cooperationChallenge.language,
          usedWords: room?.used_words || []
        }),
      });

      const result = await response.json();
      console.log('🔍 [WORD SUGGESTION DEBUG] Validation result:', result);

      if (response.ok && result.isCorrect && !result.isUsed) {
        console.log('🔍 [WORD SUGGESTION DEBUG] Correct answer, clearing lastTypedAnswer');
        audioRef.current.playSuccess();
        stopCooperationTimer();
        
        // Show new cooperation feedback
        setCooperationFeedbackNew({
          show: true,
          type: 'correct',
          word: normalizedAnswer,
          playerName: currentPlayer?.name || 'Player',
          fadeOut: false
        });
        
        // Hide feedback after 2 seconds
        setTimeout(() => {
          setCooperationFeedbackNew((fb: typeof cooperationFeedbackNew) => fb ? { ...fb, fadeOut: true } : null);
          setTimeout(() => setCooperationFeedbackNew(null), 500);
        }, 2000);
        
        socket?.emit("cooperation-answer", {
          roomId,
          playerId,
          data: {
            challengeId: cooperationChallenge.challengeId,
            answer: normalizedAnswer,
            isCorrect: true,
            wordId: result.wordId,
            remainingTime: cooperationCountdown
          }
        });
        setCooperationAnswer("");
        setLastTypedAnswer(""); // Clear lastTypedAnswer on correct answer
        
        // Add timeout function after submission
        setTimeout(() => {
          console.log('🔍 [WORD SUGGESTION DEBUG] Timeout after correct answer submission');
          // This ensures the feedback has time to display before any new challenges arrive
        }, 3000);
      } else {
        console.log('🔍 [WORD SUGGESTION DEBUG] Incorrect answer, storing data in refs');
        audioRef.current.playFailure();
        // Show error message for incorrect answers or used words
        if (result.message) {
          setError(result.message);
          setTimeout(() => setError(null), 3000);
        }
        
        // Store data in refs for word suggestion
        lastAnswerRef.current = normalizedAnswer;
        lastChallengeRef.current = cooperationChallenge;
        console.log('🔍 [WORD SUGGESTION DEBUG] Stored in refs - answer:', lastAnswerRef.current, 'challenge:', lastChallengeRef.current);
        
        setCooperationAnswer("");
      }
    } catch (error) {
      console.error('🔍 [WORD SUGGESTION DEBUG] Error submitting cooperation answer:', error);
      audioRef.current.playFailure();
      setError('Failed to submit answer. Please try again.');
      setTimeout(() => setError(null), 3000);
      setLastTypedAnswer(normalizedAnswer); // Store last attempt for suggestion
    }
  };

  // Cooperation timeout handler with life reduction and turn switching
  const handleCooperationTimeout = () => {
    console.log('🔍 [WORD SUGGESTION DEBUG] Timeout occurred, checking refs');
    console.log('🔍 [WORD SUGGESTION DEBUG] cooperationAnswer:', cooperationAnswer);
    console.log('🔍 [WORD SUGGESTION DEBUG] cooperationChallenge:', cooperationChallenge);
    console.log('🔍 [WORD SUGGESTION DEBUG] lastAnswerRef.current:', lastAnswerRef.current);
    
    // Only store data in refs if they're empty (don't overwrite data from incorrect answers)
    if (!lastAnswerRef.current.trim()) {
      console.log('🔍 [WORD SUGGESTION DEBUG] Storing timeout data in refs');
      lastAnswerRef.current = cooperationAnswer;
      lastChallengeRef.current = cooperationChallenge;
    } else {
      console.log('🔍 [WORD SUGGESTION DEBUG] Refs already have data, not overwriting');
    }
    
    audioRef.current.playFailure();
    stopCooperationTimer();
    
    // Show new cooperation feedback for timeout
    setCooperationFeedbackNew({
      show: true,
      type: 'timeout',
      playerName: currentPlayer?.name || 'Player',
      fadeOut: false
    });
    
    // Hide feedback after 2 seconds
    setTimeout(() => {
      setCooperationFeedbackNew((fb: typeof cooperationFeedbackNew) => fb ? { ...fb, fadeOut: true } : null);
      setTimeout(() => setCooperationFeedbackNew(null), 500);
    }, 2000);
    
    socket?.emit("cooperation-timeout", {
      roomId,
      playerId,
      data: { 
        challengeId: cooperationChallenge?.challengeId,
        remainingTime: cooperationCountdown
      }
    });
  };

  // Get current player
  const currentPlayer = room?.players.find((p: Player) => p.id === playerId);
  const isCurrentPlayerHost = currentPlayer?.is_host || false;

  // Handle answer submission with improved feedback logic
  const handleAnswerSubmit = async (answer: string, isTimeout: boolean = false) => {
    if (isAnswering || !currentQuestion || !socket) return;
    
    setIsAnswering(true);
    
    const isCorrect = answer === currentQuestion.correctAnswer;
    const currentTimeLeft = isTimeout ? 0 : timeLeft;
    
    // Clear timer immediately
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Handle practice mode differently
    if (room?.game_mode === "practice") {
      // Show feedback immediately on answer
      if (isTimeout) {
        setPracticeCompetitionFeedback({
          show: true,
          type: 'timeout',
          word: currentQuestion.correctAnswer,
          playerName: currentPlayer?.name || 'Player',
          correctAnswer: currentQuestion.correctAnswer,
          fadeOut: false
        });
      } else if (isCorrect) {
        audioRef.current.playSuccess();
        setPracticeCompetitionFeedback({
          show: true,
          type: 'correct',
          word: currentQuestion.correctAnswer,
          playerName: currentPlayer?.name || 'Player',
          correctAnswer: currentQuestion.correctAnswer,
          fadeOut: false
        });
      } else {
        audioRef.current.playFailure();
        setPracticeCompetitionFeedback({
          show: true,
          type: 'incorrect',
          word: currentQuestion.correctAnswer,
          playerName: currentPlayer?.name || 'Player',
          correctAnswer: currentQuestion.correctAnswer,
          selectedAnswer: answer,
          fadeOut: false
        });
      }
      // Keep feedback and highlights for 1 second, then load next question
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = setTimeout(() => {
        setPracticeCompetitionFeedback((fb: typeof practiceCompetitionFeedback | null) => fb ? { ...fb, fadeOut: true } : null);
        setTimeout(() => setPracticeCompetitionFeedback(null), 500);
        setCurrentQuestion(null);
        setSelectedAnswer("");
        setIsAnswering(false);
      }, 1000);
      // Emit answer to server with 1 point for correct answers
      socket.emit("answer", {
        roomId,
        playerId,
        data: {
          questionId: currentQuestion.questionId,
          answer: answer,
          isCorrect: isCorrect,
          timeLeft: currentTimeLeft,
          isTimeout: isTimeout,
          isPracticeMode: true,
          points: isCorrect ? 1 : 0,
          correctAnswer: currentQuestion.correctAnswer
        }
      }, () => {});
      // Don't reset the practice timer - let it continue counting down
      return;
    }
    
    // Handle visual feedback for competition mode
    if (room?.game_mode === "competition") {
      if (isTimeout) {
        setPracticeCompetitionFeedback({
          show: true,
          type: 'timeout',
          word: currentQuestion.correctAnswer,
          playerName: currentPlayer?.name || 'Player',
          correctAnswer: currentQuestion.correctAnswer,
          fadeOut: false
        });
      } else if (isCorrect) {
        // Calculate points: 10 - (time taken to answer)
        const points = Math.max(1, 10 - (currentQuestion.timeLimit - timeLeft));
        // Update score for current player
        setRoom((prevRoom: Room | null) => {
          if (!prevRoom) return prevRoom;
          return {
            ...prevRoom,
            players: prevRoom.players.map(p =>
              p.id === playerId ? { ...p, score: (p.score || 0) + points } : p
            )
          };
        });
        setCompetitionFeedback({
          show: true,
          type: 'correct',
          word: currentQuestion.correctAnswer,
          playerName: currentPlayer?.name || 'Player',
          fadeOut: false
        });
      } else {
        setPracticeCompetitionFeedback({
          show: true,
          type: 'incorrect',
          word: currentQuestion.correctAnswer,
          playerName: currentPlayer?.name || 'Player',
          correctAnswer: currentQuestion.correctAnswer,
          selectedAnswer: answer,
          fadeOut: false
        });
      }
      
      // Clear feedback after 0.75 seconds for competition mode
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = setTimeout(() => {
        setPracticeCompetitionFeedback((fb: typeof practiceCompetitionFeedback | null) => fb ? { ...fb, fadeOut: true } : null);
        setTimeout(() => setPracticeCompetitionFeedback(null), 500);
      }, 750);
    }
    
    // Handle competition mode feedback only (for other players)
    if (room?.game_mode === "competition") {
      if (isTimeout) {
        setCompetitionFeedback({
          show: true,
          type: 'timeout',
          playerName: currentPlayer?.name || 'Player',
          fadeOut: false
        });
      } else if (isCorrect) {
        setCompetitionFeedback({
          show: true,
          type: 'correct',
          word: currentQuestion.correctAnswer,
          playerName: currentPlayer?.name || 'Player',
          fadeOut: false
        });
      } else {
        setCompetitionFeedback({
          show: true,
          type: 'incorrect',
          word: currentQuestion.correctAnswer,
          playerName: currentPlayer?.name || 'Player',
          fadeOut: false
        });
      }
      // Clear any previous feedback timeout
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      // Hide feedback after 2 seconds
      feedbackTimeoutRef.current = setTimeout(() => {
        setCompetitionFeedback((fb: typeof competitionFeedback | null) => fb ? { ...fb, fadeOut: true } : null);
        setTimeout(() => setCompetitionFeedback(null), 500); // fade out duration
      }, 2000);
    }
    
    // Emit answer to server
    socket.emit("answer", {
      roomId,
      playerId,
      data: {
        questionId: currentQuestion.questionId,
        answer: answer,
        isCorrect: isCorrect,
        timeLeft: currentTimeLeft,
        isTimeout: isTimeout
      }
    }, () => {});
    
    // Clear current question and selected answer
    setCurrentQuestion(null);
    setSelectedAnswer("");
    setIsAnswering(false);
  };

  // Handle language selection
  const handleLanguageChange = (language: string) => {
    if (!socket || !currentPlayer) return;

    console.log(`🌐 Player ${playerId} selecting language: ${language}`);
    
    socket.emit("update-language", {
      roomId,
      playerId,
      data: { language }
    }, (response: any) => {
      if (response.error) {
        console.error("❌ Failed to update language:", response.error);
        setError(response.error);
      } else {
        console.log(`✅ Language updated successfully to ${language}`);
      }
    });
  };

  // Handle ready toggle
  const handleReadyToggle = () => {
    if (!socket) return;

    console.log(`⚡ Player ${playerId} toggling ready status`);
    
    socket.emit("toggle-ready", { roomId, playerId }, (response: any) => {
      if (response.error) {
        console.error("❌ Failed to toggle ready:", response.error);
        setError(response.error);
      } else {
        console.log(`✅ Ready status toggled successfully`);
      }
    });
  };

  // Handle game mode selection
  const handleGameModeChange = (gameMode: string) => {
    if (!socket || !isCurrentPlayerHost) return;

    console.log(`🎮 Host selecting game mode: ${gameMode}`);
    
    socket.emit("update-game-mode", {
      roomId,
      playerId,
      data: { gameMode }
    }, (response: any) => {
      if (response.error) {
        console.error("❌ Failed to update game mode:", response.error);
        setError(response.error);
      } else {
        console.log(`✅ Game mode updated to ${gameMode}`);
      }
    });
  };

  // Handle host language selection (for competition mode)
  const handleHostLanguageChange = (hostLanguage: string) => {
    if (!socket || !isCurrentPlayerHost) return;

    console.log(`🌐 Host selecting competition language: ${hostLanguage}`);
    
    socket.emit("update-host-language", {
      roomId,
      playerId,
      data: { hostLanguage }
    }, (response: any) => {
      if (response.error) {
        console.error("❌ Failed to update host language:", response.error);
        setError(response.error);
      } else {
        console.log(`✅ Host language updated to ${hostLanguage}`);
      }
    });
  };

  // Handle target score change
  const handleTargetScoreChange = (targetScore: string) => {
    if (!socket || !isCurrentPlayerHost) return;

    socket.emit("update-target-score", {
      roomId,
      playerId,
      data: { targetScore: parseInt(targetScore) }
    }, (response: any) => {
      if (response.error) {
        console.error("❌ Failed to update target score:", response.error);
        setError(response.error);
      }
    });
  };

  // Handle game start
  const handleStartGame = () => {
    if (!socket || !isCurrentPlayerHost) return;

    // Check if competition mode has at least 2 players
    if (room?.game_mode === "competition" && room.players.length < 2) {
      setError("Competition mode requires at least 2 players to start");
      setTimeout(() => setError(null), 3000);
      return;
    }

    console.log(`🎮 Starting game in ${room?.game_mode} mode`);
    
    socket.emit("start-game", { roomId, playerId }, (response: any) => {
      if (response.error) {
        console.error("❌ Failed to start game:", response.error);
        setError(response.error);
      } else {
        console.log(`✅ Game started successfully`);
      }
    });
  };

  // Handle restart
  const handleRestart = () => {
    if (!socket || !isCurrentPlayerHost) return;

    console.log("🔄 Restarting game...");
    
    socket.emit("restart", { roomId, playerId }, (response: any) => {
      if (response.error) {
        console.error("❌ Failed to restart game:", response.error);
        setError(response.error);
        // Don't redirect on restart error, just show the error
        setTimeout(() => setError(null), 5000);
      } else {
        console.log("✅ Game restarted successfully");
        setError(null);
      }
    });
  };

  // Enhanced leave room with direct redirect
  const handleLeaveRoom = () => {
    console.log("🚪 Leaving room...");
    
    // Emit leave event if socket is available
    if (socket) {
      socket.emit("leave-room", { roomId, playerId });
    }
    
    // Direct redirect to home URL
    window.location.href = "https://oneplswork.onrender.com/";
  };

  // Handle cooperation typing
  const handleCooperationTyping = (text: string) => {
    setCooperationAnswer(text);
    if (socket) {
      socket.emit("cooperation-typing", { roomId, playerId, text });
    }
  };

  // Handle time donation
  const handleDonateTime = () => {
    if (!socket || !currentPlayer || isDonating) return;
    
    // Validate donation amount
    if (donatedTimeAmount < 1 || donatedTimeAmount > currentPlayer.timeBank || donatedTimeAmount > 10) {
      setError("Invalid donation amount");
      setTimeout(() => setError(null), 3000);
      return;
    }
    
    console.log(`🔄 Donating ${donatedTimeAmount} seconds from time bank (current: ${currentPlayer.timeBank})`);
    setIsDonating(true);
    
    const payload = {
      roomId,
      playerId,
      data: { amount: donatedTimeAmount }
    };
    
    console.log("📤 Emitting donate-time:", payload);
    socket.emit("donate-time", payload, (response: any) => {
      console.log("📥 Donate-time response:", response);
      if (response.error) {
        console.error("❌ Failed to donate time:", response.error);
        setError(response.error);
        setTimeout(() => setError(null), 3000);
      } else {
        console.log("✅ Time donated successfully");
        setDonatedTimeAmount(1); // Reset to default
      }
      setIsDonating(false);
    });
  };

  // When rendering the language selection for the game (host language or player language),
  // filter out the user's own UI language, but always allow English
  function getSelectableGameLanguages() {
    return GAME_LANGUAGES.filter(lang => {
      // Always allow English as a selectable option
      if (lang.value === 'english') return true;
      // For other languages, don't allow users to select their own UI language
      return lang.value !== uiLanguage;
    });
  }

  // Calculate Levenshtein distance for fuzzy matching
  const calculateSimilarity = (str1: string, str2: string): number => {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : (maxLength - matrix[str2.length][str1.length]) / maxLength;
  };

  // Find closest word in the same category and language
  const findClosestWord = (typedWord: string, category: string, language: string): string | null => {
    console.log('🔍 [WORD SUGGESTION DEBUG] findClosestWord called with:', { typedWord, category, language });
    console.log('🔍 [WORD SUGGESTION DEBUG] WORD_DATABASE length:', WORD_DATABASE.length);
    console.log('🔍 [WORD SUGGESTION DEBUG] WORD_DATABASE sample:', WORD_DATABASE.slice(0, 3).map(w => ({ id: w.id, category: w.category, english: w.english })));
    
    if (!typedWord.trim()) {
      console.log('🔍 [WORD SUGGESTION DEBUG] No typed word provided');
      return null;
    }
    
    const normalizedTyped = typedWord.toLowerCase().trim();
    
    // Get words in the specified category
    const categoryWords = WORD_DATABASE.filter(word => word.category === category);
    
    console.log('🔍 [WORD SUGGESTION DEBUG] Found category words:', categoryWords.length);
    console.log('🔍 [WORD SUGGESTION DEBUG] Category words:', categoryWords.slice(0, 3).map(w => ({ 
      english: w.english, 
      spanish: w.spanish, 
      french: w.french,
      german: w.german,
      japanese: w.japanese,
      russian: w.russian
    })));
    
    if (categoryWords.length === 0) {
      console.log('🔍 [WORD SUGGESTION DEBUG] No words found for category:', category);
      console.log('🔍 [WORD SUGGESTION DEBUG] Available categories:', Array.from(new Set(WORD_DATABASE.map(w => w.category))));
      return null;
    }
    
    let bestMatch: string | null = null;
    let bestSimilarity = 0.6; // Minimum similarity threshold
    
    for (const word of categoryWords) {
      // Get the word in the target language
      let targetWord: string;
      switch (language) {
        case 'spanish':
          targetWord = word.spanish;
          break;
        case 'french':
          targetWord = word.french;
          break;
        case 'german':
          targetWord = word.german;
          break;
        case 'japanese':
          targetWord = word.japanese;
          break;
        case 'russian':
          targetWord = word.russian;
          break;
        case 'english':
          targetWord = word.english;
          break;
        default:
          console.log('🔍 [WORD SUGGESTION DEBUG] Unknown language:', language);
          continue;
      }
      
      if (!targetWord) {
        console.log('🔍 [WORD SUGGESTION DEBUG] No translation for language:', language, 'in word:', word);
        continue;
      }
      
      const similarity = calculateSimilarity(normalizedTyped, targetWord.toLowerCase());
      console.log('🔍 [WORD SUGGESTION DEBUG] Comparing:', { typed: normalizedTyped, word: targetWord, similarity });
      
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = targetWord;
        console.log('🔍 [WORD SUGGESTION DEBUG] New best match:', { word: targetWord, similarity });
      }
    }
    
    console.log('🔍 [WORD SUGGESTION DEBUG] Final result:', { bestMatch, bestSimilarity });
    return bestMatch;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {isHost ? strings.createRoom : strings.joinRoom}
            </h2>
            <p className="text-gray-600 text-center">
              {connectionStatus === 'connecting' ? strings.connecting : strings.settingUpRoom}
            </p>
            <div className="mt-4 text-sm text-gray-500">
              <p>{strings.room}: {roomId}</p>
              <p>{strings.players}: {decodeURIComponent(playerName || '')}</p>
              <p>{strings.role}: {isHost ? strings.host : strings.players}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error && !room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <div className="text-red-500 text-6xl mb-4">❌</div>
            <h2 className="text-xl font-semibold mb-2 text-red-700">{strings.error}</h2>
            <p className="text-gray-600 text-center mb-4">{error}</p>
            <Button onClick={() => router.push('/')} className="w-full">
              {strings.returnToHome}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
            <h2 className="text-xl font-semibold mb-2">{strings.loadingRoom}</h2>
            <p className="text-gray-600 text-center">{strings.pleaseWaitForRoomData}</p>
            <div className="mt-4 text-sm text-gray-500">
              <p>{strings.connection}: {connectionStatus}</p>
              <p>{strings.room}: {roomId}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Remove the local interval logic from startPracticeTimer
  const startPracticeTimer = () => {
    setPracticeTimer(60);
    setPracticeTimerActive(true);
  };

  // ... existing code ...
  {/* MOBILE TABS FOR LOBBY */}
  <div className="block sm:hidden w-full max-w-2xl mx-auto mb-4">
    <div className="flex border-b border-gray-200">
      <button
        className={`flex-1 py-2 text-center font-semibold ${lobbyTab === 'main' ? 'border-b-2 border-blue-500 text-blue-700' : 'text-gray-500'}`}
        onClick={() => setLobbyTab('main')}
      >
        {strings.players} & {strings.gameModes}
      </button>
      <button
        className={`flex-1 py-2 text-center font-semibold ${lobbyTab === 'rules' ? 'border-b-2 border-blue-500 text-blue-700' : 'text-gray-500'}`}
        onClick={() => setLobbyTab('rules')}
      >
        {strings.gameRules}
      </button>
    </div>
  </div>

  {/* Main Tab: Players and Game Modes */}
  {lobbyTab === 'main' && (
    <div className="block sm:hidden">
      {/* Players List */}
      {/* ...existing players list code... */}
      {/* Game Mode Selection */}
      {/* ...existing game mode selection code... */}
      {/* Game Settings, Language Selection, etc. */}
      {/* ...existing code... */}
    </div>
  )}

  {/* Rules Tab */}
  {lobbyTab === 'rules' && (
    <div className="block sm:hidden">
      {/* Rules Section - Collapsible */}
      {/* ...existing rules section code... */}
    </div>
  )}

  {/* Desktop: Show all sections as before */}
  <div className="hidden sm:block">
    {/* Players List, Game Modes, Rules, etc. */}
    {/* ...existing code... */}
  </div>
  // ... existing code ...

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Static Animated Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className={`absolute inset-0 transition-all duration-700 ease-in-out ${
          practiceBackgroundPulse === 'correct' 
            ? 'bg-gradient-to-br from-green-50 via-green-100 to-green-50' 
            : practiceBackgroundPulse === 'incorrect'
            ? 'bg-gradient-to-br from-red-50 via-red-100 to-red-50'
            : 'bg-gradient-to-br from-white via-blue-50 to-white'
        }`}></div>
        {Object.entries(BACKGROUND_CHARS).map(([lang, chars]) =>
          chars.map((char, index) => {
            const baseLeft = (index * 8 + lang.length * 3) % 100;
            const baseTop = (index * 12 + lang.length * 5) % 100;
            const floatDuration = 40 + (index % 30);
            const floatDelay = -1 * ((index * 2.7 + lang.length * 1.3) % floatDuration);
            const flashDelay = (index * 0.2 + lang.length * 0.1) % 6;
            const startPosition = (index * 137.5) % 360;
            return (
              <div
                key={`${lang}-${index}`}
                className="absolute text-black/20 text-3xl md:text-5xl font-bold select-none blur-[0.5px]"
                style={{
                  left: `${baseLeft}%`,
                  top: `${baseTop}%`,
                  animation: `float ${floatDuration}s linear infinite, flash ${6 + (index % 3)}s ease-in-out infinite`,
                  animationDelay: `${floatDelay}s, ${flashDelay}s`,
                  transform: `rotate(${startPosition}deg)`,
                  animationPlayState: 'running',
                }}
              >
                {char}
              </div>
            );
          })
        )}
        <div className="absolute inset-0 bg-blue-500/5 animate-pulse"></div>
      </div>
      <div className="relative z-10 min-h-screen flex flex-col">
      <div className="mobile-container mobile-padding">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Users className="h-4 w-4 text-white" />
                </div>
                <h1 className="mobile-text-xl font-bold text-gray-900">{strings.room} {roomId}</h1>
            </div>
            {isCurrentPlayerHost && (
                <Badge variant={"outline" as any} className="bg-yellow-50 text-yellow-700 border-yellow-200 rounded-full">
                <Crown className="h-3 w-3 mr-1" />
                {strings.host}
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant={"outline" as any} className={
              connectionStatus === 'connected' 
                  ? "bg-green-50 text-green-700 border-green-200 rounded-full"
                  : "bg-red-50 text-red-700 border-red-200 rounded-full"
            }>
              {connectionStatus === 'connected' ? `✅ ${strings.connected}` : `❌ ${strings.disconnected}`}
            </Badge>
            <SoundButton
              onClick={handleLeaveRoom}
              variant={"outline" as any}
                className="mobile-btn-sm border-gray-300 text-gray-700 hover:bg-gray-50 rounded-2xl shadow-sm"
            >
              <LogOut className="h-4 w-4" />
            </SoundButton>
          </div>
        </div>

        {/* Error Display */}
        {error && (
            <Card className="mb-6 border-red-200 bg-red-50 rounded-3xl shadow-lg">
            <CardContent className="p-4">
              <p className="text-red-700 text-center">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Question Loading Errors */}
        {questionLoadingError && (
            <Card className="mb-6 border-orange-200 bg-orange-50 rounded-3xl shadow-lg">
            <CardContent className="p-4">
              <p className="text-orange-700 text-center">⚠️ {questionLoadingError}</p>
            </CardContent>
          </Card>
        )}

        {/* Game Content */}
        {room.game_state === "lobby" && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
            {/* Players List */}
            <Card className="mobile-card bg-white/80 border-gray-200/50 backdrop-blur-sm shadow-lg rounded-3xl w-full max-w-2xl">
              <CardHeader className="mobile-padding">
                <CardTitle className="flex items-center gap-3 mobile-text-lg text-gray-900">
                  <div className="w-6 h-6 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Users className="h-3 w-3 text-white" />
                  </div>
                  {strings.players} ({room.players.length}/{room.game_mode === "cooperation" ? 2 : 8})
                </CardTitle>
              </CardHeader>
              <CardContent className="mobile-spacing-sm mobile-padding">
                {room.players.map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between p-4 bg-white/60 rounded-2xl border border-gray-200/50 hover:bg-white/80 transition-all duration-300 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {player.is_host && <Crown className="h-4 w-4 text-yellow-600" />}
                        <span className="font-medium mobile-text-base text-gray-900">{player.name}</span>
                        {player.id === playerId && (
                          <Badge variant={"outline" as any} className="text-xs border-blue-300 text-blue-700 rounded-full">{strings.you}</Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {player.language && (
                        <Badge variant={"outline" as any} className="text-xs border-gray-300 text-gray-700 rounded-full">
                          {GAME_LANGUAGES.find(l => l.value === player.language)?.label}
                        </Badge>
                      )}
                      <div className="flex items-center gap-1">
                        {player.ready ? (
                          <Badge variant="default" className="text-xs bg-green-600 text-white rounded-full">
                            <Check className="h-3 w-3 mr-1" />
                            {strings.ready}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs border-gray-300 text-gray-700 rounded-full">
                            <X className="h-3 w-3 mr-1" />
                            {strings.notReady}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Game Mode Selection */}
            {isCurrentPlayerHost && !room.game_mode && (
              <Card className="mobile-card bg-white/80 border-gray-200/50 backdrop-blur-sm shadow-lg rounded-3xl w-full max-w-2xl">
                <CardHeader className="mobile-padding">
                  <CardTitle className="mobile-text-lg text-gray-900">{strings.selectGameMode}</CardTitle>
                  <CardDescription className="mobile-text-base text-gray-600">
                    {strings.chooseHowToPlay}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mobile-spacing-md mobile-padding">
                  <div className="space-y-3 mobile-spacing-sm">
                    <SoundButton
                      onClick={() => handleGameModeChange("practice")}
                      variant={"outline" as any}
                      className="w-full mobile-btn-lg justify-start border-gray-300 text-gray-700 hover:bg-gray-50 rounded-2xl shadow-sm transition-all duration-300"
                    >
                      <div className="w-8 h-8 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg mr-3">
                        <BookOpen className="h-4 w-4 text-white" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-gray-900">{strings.practiceMode}</div>
                      </div>
                    </SoundButton>
                    
                    <SoundButton
                      onClick={() => handleGameModeChange("competition")}
                      variant={"outline" as any}
                      className="w-full mobile-btn-lg justify-start border-gray-300 text-gray-700 hover:bg-gray-50 rounded-2xl shadow-sm transition-all duration-300"
                    >
                      <div className="w-8 h-8 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg mr-3">
                        <Zap className="h-4 w-4 text-white" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-gray-900">{strings.competitionMode}</div>
                      </div>
                    </SoundButton>
                    
                    <SoundButton
                      onClick={() => handleGameModeChange("cooperation")}
                      variant={"outline" as any}
                      className="w-full mobile-btn-lg justify-start border-gray-300 text-gray-700 hover:bg-gray-50 rounded-2xl shadow-sm transition-all duration-300"
                    >
                      <div className="w-8 h-8 bg-purple-600 rounded-2xl flex items-center justify-center shadow-lg mr-3">
                        <Heart className="h-4 w-4 text-white" />
                      </div>
                      <div className="text-left">
                        <div className="font-medium text-gray-900">{strings.cooperationMode}</div>
                      </div>
                    </SoundButton>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Game Settings */}
            {room.game_mode && (
              <Card className="mobile-card bg-white/80 border-gray-200/50 backdrop-blur-sm shadow-lg rounded-3xl w-full max-w-2xl">
                <CardHeader className="mobile-padding">
                  <CardTitle className="flex items-center gap-3 mobile-text-lg text-gray-900">
                    <div className="w-6 h-6 bg-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <Settings className="h-3 w-3 text-white" />
                    </div>
                    {strings.gameSettings}
                  </CardTitle>
                </CardHeader>
                <CardContent className="mobile-spacing-md mobile-padding">
                  {/* Current Game Mode */}
                  <div className="flex items-center justify-between">
                    <span className="mobile-text-base font-medium text-gray-900">{strings.currentGameMode}:</span>
                    <div className="flex items-center gap-2">
                      {room.game_mode === "practice" && (
                        <Badge variant={"outline" as any} className="bg-blue-50 text-blue-700 border-blue-200 rounded-full">
                          <BookOpen className="h-3 w-3 mr-1" />
                          {strings.practiceMode}
                        </Badge>
                      )}
                      {room.game_mode === "competition" && (
                        <Badge variant={"outline" as any} className="bg-orange-50 text-orange-700 border-orange-200 rounded-full">
                          <Zap className="h-3 w-3 mr-1" />
                          {strings.competitionMode}
                        </Badge>
                      )}
                      {room.game_mode === "cooperation" && (
                        <Badge variant={"outline" as any} className="bg-purple-50 text-purple-700 border-purple-200 rounded-full">
                          <Heart className="h-3 w-3 mr-1" />
                          {strings.cooperationMode}
                        </Badge>
                      )}
                      {isCurrentPlayerHost && (
                        <SoundButton
                          onClick={() => handleGameModeChange("")}
                          variant="outline"
                          size="sm"
                          className="border-gray-300 text-gray-700 hover:bg-gray-50 rounded-2xl shadow-sm"
                        >
                          {strings.change}
                        </SoundButton>
                      )}
                    </div>
                  </div>

                  {/* Target Score */}
                  {room.game_mode !== "cooperation" && room.game_mode !== "practice" && (
                    <div className="flex items-center justify-between">
                      <span className="mobile-text-base font-medium text-gray-900">{strings.targetScore}:</span>
                      {isCurrentPlayerHost ? (
                        <Select value={room.target_score.toString()} onValueChange={handleTargetScoreChange}>
                          <SelectTrigger className="w-24 border-gray-300 rounded-2xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TARGET_SCORES.map(score => (
                              <SelectItem key={score} value={score.toString()}>
                                {score}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={"outline" as any} className="border-gray-300 text-gray-700 rounded-full">
                          <Target className="h-3 w-3 mr-1" />
                          {room.target_score}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Host Language (Competition Mode) */}
                  {room.game_mode === "competition" && (
                    <div className="flex items-center justify-between">
                      <span className="mobile-text-base font-medium text-gray-900">{strings.language}:</span>
                      {isCurrentPlayerHost ? (
                        <Select value={room.host_language || ""} onValueChange={handleHostLanguageChange}>
                          <SelectTrigger className="w-32 border-gray-300 rounded-2xl">
                            <SelectValue placeholder={strings.chooseLanguage} />
                          </SelectTrigger>
                          <SelectContent>
                            {getSelectableGameLanguages().map(lang => (
                              <SelectItem key={lang.value} value={lang.value}>
                                <span className="flex items-center gap-1">
                                  <FlagIcon country={lang.country} size="sm" />
                                  {lang.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={"outline" as any} className="border-gray-300 text-gray-700 rounded-full">
                          <Globe className="h-3 w-3 mr-1" />
                          <span className="flex items-center gap-1">
                            {room.host_language ? (
                              <>
                                <FlagIcon country={GAME_LANGUAGES.find(l => l.value === room.host_language)?.country || "gb"} size="sm" />
                                {GAME_LANGUAGES.find(l => l.value === room.host_language)?.label || strings.notSet}
                              </>
                            ) : (
                              strings.notSet
                            )}
                          </span>
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Language Selection (Practice/Cooperation Mode) */}
            {(room.game_mode === "practice" || room.game_mode === "cooperation") && (
              <Card className="mobile-card bg-white/80 border-gray-200/50 backdrop-blur-sm shadow-lg rounded-3xl w-full max-w-2xl">
                <CardHeader className="mobile-padding">
                  <CardTitle className="mobile-text-lg text-gray-900">{strings.selectYourLanguage}</CardTitle>
                  <CardDescription className="mobile-text-base text-gray-600">
                    {strings.chooseLanguageToPractice}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mobile-padding">
                  <Select value={currentPlayer?.language || ""} onValueChange={handleLanguageChange}>
                    <SelectTrigger className="w-full border-gray-300 rounded-2xl">
                      <SelectValue placeholder={strings.chooseLanguage} />
                    </SelectTrigger>
                    <SelectContent>
                      {getSelectableGameLanguages().map(lang => (
                        <SelectItem key={lang.value} value={lang.value}>
                          <span className="flex items-center gap-1">
                            <FlagIcon country={lang.country} size="sm" />
                            {lang.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            )}

            {/* Rules Section - Collapsible */}
            <Card className="mobile-card bg-white/80 border-gray-200/50 backdrop-blur-sm shadow-lg rounded-3xl w-full max-w-2xl">
              <CardHeader className="mobile-padding">
                <CardTitle className="mobile-text-lg text-gray-900 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                      <BookOpen className="h-3 w-3 text-white" />
                    </div>
                    {strings.gameRules}
                  </div>
                  <SoundButton
                    onClick={() => setRulesCollapsed(!rulesCollapsed)}
                    variant="outline"
                    size="sm"
                    className="border-gray-300 text-gray-700 hover:bg-gray-50 rounded-2xl shadow-sm"
                  >
                    {rulesCollapsed ? '▼' : '▲'}
                  </SoundButton>
                </CardTitle>
              </CardHeader>
              {!rulesCollapsed && (
                <CardContent className="mobile-spacing-sm mobile-text-sm mobile-padding">
                  <div className="space-y-2 mobile-spacing-sm">
                    <p className="font-medium mobile-text-base text-gray-900">🎮 {strings.gameModes}:</p>
                    <div className="space-y-2 ml-4">
                      <div className="flex items-start gap-2">
                        <BookOpen className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-blue-600 mobile-text-sm">{strings.practiceMode}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Zap className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-orange-600 mobile-text-sm">{strings.competitionMode}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Heart className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium text-purple-600 mobile-text-sm">{strings.cooperationMode}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mobile-spacing-sm">
                    <p className="font-medium mobile-text-base text-gray-900">🎮 {strings.howToPlay}:</p>
                    <ul className="space-y-1 text-gray-600 ml-4">
                      <li className="mobile-text-sm">• {strings.chooseGameMode}</li>
                      <li className="mobile-text-sm">• {strings.translateEnglishWords}</li>
                      <li className="mobile-text-sm">• {strings.earnPoints}</li>
                      <li className="mobile-text-sm">• {strings.firstToReach}</li>
                    </ul>
                  </div>

                  <div className="space-y-2 mobile-spacing-sm">
                    <p className="font-medium mobile-text-base text-gray-900">🌍 {strings.languages}:</p>
                    <div className="flex flex-wrap gap-2">
                      {GAME_LANGUAGES.map((lang) => (
                        <Badge key={lang.value} variant="outline" className="mobile-text-sm flex items-center gap-1 border-gray-300 text-gray-700 rounded-full">
                          <FlagIcon country={lang.country} size="sm" />
                          {lang.label}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {connectionStatus === 'error' && (
                    <div className="space-y-2 mt-4 p-3 bg-red-50 rounded-2xl border border-red-200">
                      <p className="font-medium text-red-700 mobile-text-sm">🔧 {strings.connectionIssues}:</p>
                      <ul className="space-y-1 text-red-600 mobile-text-sm ml-4">
                        <li>• {strings.tryRefreshing}</li>
                        <li>• {strings.checkInternet}</li>
                        <li>• {strings.disableAdBlockers}</li>
                        <li>• {strings.tryDifferentBrowser}</li>
                        <li>• {strings.clearCache}</li>
                      </ul>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>

            {/* Ready/Start Button */}
            {room.game_mode && (
              <div className="space-y-4 w-full max-w-2xl">
                {/* Ready Button */}
                <div className="flex justify-center">
                  <SoundButton
                    onClick={handleReadyToggle}
                    className={`mobile-btn-lg px-8 rounded-2xl shadow-lg transition-all duration-300 transform hover:scale-105 ${
                      currentPlayer?.ready 
                        ? "bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white" 
                        : "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
                    }`}
                    disabled={
                      (room.game_mode === "practice" || room.game_mode === "cooperation") && !currentPlayer?.language ||
                      room.game_mode === "competition" && !room.host_language
                    }
                  >
                    {currentPlayer?.ready ? (
                      <>
                        <Check className="h-5 w-5 mr-2" />
                        {strings.ready}!
                      </>
                    ) : (
                      strings.readyToPlay
                    )}
                  </SoundButton>
                </div>

                {/* Start Game Button (Host Only) */}
                {isCurrentPlayerHost && room.players.every(p => p.ready) && (
                  <div className="flex justify-center">
                    <SoundButton
                      onClick={handleStartGame}
                      className="mobile-btn-lg px-8 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white rounded-2xl shadow-lg transition-all duration-300 transform hover:scale-105"
                    >
                      <Play className="h-5 w-5 mr-2" />
                      {strings.startGame}
                    </SoundButton>
                  </div>
                )}
              </div>
            )}
            
          </div>
        )}

        {/* Practice/Competition Mode Gameplay */}
        {room.game_state === "playing" && (room.game_mode === "practice" || room.game_mode === "competition") && (
          <div className="flex flex-col items-center justify-center w-full min-h-[70vh]">
            {/* Practice Mode Timer Display */}
            {room.game_mode === "practice" && (
              <div className="w-full flex justify-center mb-4">
                <div className="bg-gradient-to-r from-blue-50 to-green-50 border-2 border-blue-200 rounded-3xl px-6 py-3 shadow-lg flex flex-col items-center lg:fixed lg:top-6 lg:left-1/2 lg:-translate-x-1/2 lg:z-30 lg:w-[420px] lg:py-6 lg:px-10 lg:shadow-2xl">
                  <div className="flex items-center gap-2">
                    <Clock className="h-7 w-7 text-blue-600 lg:h-10 lg:w-10" />
                    <span className="text-3xl font-bold text-blue-700 lg:text-5xl">{practiceTimer}s</span>
                  </div>
                  <span className="text-sm text-gray-600 mt-1 lg:text-lg">{strings.timeRemaining}</span>
                </div>
              </div>
            )}
            {/* Responsive layout for question and leaderboard */}
            <div className="flex flex-col lg:flex-row gap-8 w-full">
              <div className="flex-1 min-w-0">
                {/* Question Card */}
                {currentQuestion ? (
                  <Card className="mobile-card bg-white/80 border-gray-200/50 backdrop-blur-sm shadow-lg rounded-3xl max-w-lg mx-auto lg:max-w-2xl lg:p-8">
                    <CardHeader className="mobile-padding text-center p-6 lg:p-8">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-gray-600">{strings.questionNumber} #{(room.question_count || 0) + 1}</div>
                      </div>
                      {room.game_mode === "practice" && (
                        <CardTitle className="mobile-text-xl mb-2 text-gray-900">
                          {currentPlayer?.language === "english" ? (
                            <>
                              {strings.translateToEnglish}: <span className="text-blue-600">{currentQuestion.english}</span>
                            </>
                          ) : (
                            <>
                              {strings.translate}: <span className="text-blue-600">{currentQuestion.english}</span>
                            </>
                          )}
                        </CardTitle>
                      )}
                      {room.game_mode === "competition" && (
                        <CardTitle className="mobile-text-xl mb-2 text-gray-900">
                          {room.host_language === "english" ? (
                            <>
                              {strings.translateToEnglish}: <span className="text-blue-600">{currentQuestion.english}</span>
                            </>
                          ) : (
                            <>
                              {strings.translate}: <span className="text-blue-600">{currentQuestion.english}</span>
                            </>
                          )}
                        </CardTitle>
                      )}
                    </CardHeader>
                    <CardContent className="mobile-padding p-2">
                      <div className="flex flex-col items-center w-full">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl mx-auto">
                          {currentQuestion.options.map((option, index) => {
                            let highlightClass = 'bg-white text-black';
                            if (room.game_mode === "competition") {
                              highlightClass = 'bg-blue-500 text-white font-bold';
                              if (competitionFeedback?.show) {
                                if (option === currentQuestion.correctAnswer) {
                                  highlightClass = 'bg-green-500 text-white font-bold';
                                } else if (option === selectedAnswer) {
                                  highlightClass = 'bg-red-500 text-white font-bold';
                                }
                              }
                            } else if (practiceCompetitionFeedback?.show) {
                              if (option === currentQuestion.correctAnswer) {
                                highlightClass = 'bg-green-500 text-white';
                              } else {
                                highlightClass = 'bg-red-500 text-white';
                              }
                            }
                            return (
                              <SoundButton
                                key={index}
                                onClick={() => handleAnswerSubmit(option)}
                                disabled={isAnswering}
                                className={`answer-option rounded-2xl shadow-lg flex items-center justify-center text-lg font-semibold h-12 w-full mx-auto ${practiceCompetitionFeedback?.fadeOut || competitionFeedback?.fadeOut ? 'opacity-70 scale-95' : ''} ${highlightClass}`}
                                style={{
                                  minHeight: '48px',
                                  maxWidth: '320px',
                                  margin: '0 auto',
                                  transition: 'all 0.3s',
                                }}
                              >
                                {option}
                              </SoundButton>
                            );
                          })}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="mobile-card bg-white/80 border-gray-200/50 backdrop-blur-sm shadow-lg rounded-3xl min-h-[220px] flex items-center justify-center">
                    <CardContent className="mobile-padding text-center py-12 flex flex-col items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
                      <p className="text-gray-600 text-center">{strings.nextQuestionWillAppear}</p>
                    </CardContent>
                  </Card>
                )}
                {/* Practice Mode Feedback Section */}
                {room.game_mode === "practice" && practiceCompetitionFeedback?.show && (
                  <div className="fixed inset-0 flex items-start justify-center z-40 pointer-events-none" style={{ top: '30%' }}>
                    <div className="w-full max-w-xs sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl mx-auto">
                      <Card className="bg-white/90 border-gray-200/70 backdrop-blur-lg shadow-2xl rounded-3xl">
                        <CardContent className="p-6">
                          <div className={`text-center transition-all duration-500 ${practiceCompetitionFeedback.fadeOut ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'}`}>
                            {practiceCompetitionFeedback.type === 'correct' && (
                              <div className="space-y-2">
                                <div className="text-3xl font-bold text-green-600 mb-2">✅ {strings.correct}!</div>
                                <div className="text-xl font-semibold text-green-700 mb-2">{practiceCompetitionFeedback.word}</div>
                                <div className="text-lg font-bold text-green-600">+1 {strings.point}</div>
                              </div>
                            )}
                            {practiceCompetitionFeedback.type === 'incorrect' && (
                              <div className="space-y-2">
                                <div className="text-3xl font-bold text-red-600 mb-2">❌ {strings.incorrect}</div>
                                <div className="text-lg text-red-700 mb-2">{strings.youSelected}: <strong>{practiceCompetitionFeedback.selectedAnswer}</strong></div>
                                <div className="text-lg text-green-700">{strings.correctAnswerWas}: <strong>{practiceCompetitionFeedback.correctAnswer}</strong></div>
                              </div>
                            )}
                            {practiceCompetitionFeedback.type === 'timeout' && (
                              <div className="space-y-2">
                                <div className="text-3xl font-bold text-yellow-600 mb-2">⏰ {strings.timesUp}!</div>
                                <div className="text-lg text-green-700">{strings.correctAnswerWas}: <strong>{practiceCompetitionFeedback.correctAnswer}</strong></div>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </div>
              {/* Leaderboard Section - below on mobile, side on desktop */}
              <div className="w-full lg:w-[340px] min-w-[280px] max-w-xs mt-8 lg:mt-0 self-center">
                <Card className="bg-white/90 backdrop-blur-sm border-blue-200 shadow rounded-2xl">
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="flex items-center justify-center gap-2 text-base text-blue-800">
                      <Trophy className="h-4 w-4" />
                      {strings.leaderboard}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2">
                    <div className="flex flex-col gap-1">
                      {/* Leaderboard content remains unchanged for now */}
                      {room.players
                        .sort((a, b) => {
                          if (room.game_mode === "cooperation") {
                            return 0;
                          } else if (room.game_mode === "practice") {
                            return b.score - a.score;
                          } else {
                            return b.score - a.score;
                          }
                        })
                        .map((player, index) => {
                          const getDisplayScore = (player: Player) => {
                            if (room.game_mode === "cooperation") {
                              return room.cooperation_score || 0;
                            } else {
                              return player.score;
                            }
                          };
                          const displayScore = getDisplayScore(player);
                          return (
                            <div key={player.id} className={`leaderboard-player${player.id === playerId ? ' current-player' : ''}`}>
                              <span className="player-name flex items-center gap-2">
                                {player.name} {player.id === playerId && <span className="text-xs text-blue-500">(You)</span>}
                              </span>
                              <Badge variant="outline" className={`text-xs font-bold rounded-full px-2 py-0.5 ${
                                index === 0
                                  ? 'bg-yellow-100 border-yellow-300 text-yellow-800'
                                  : 'bg-gray-100 border-gray-300 text-gray-800'
                              }`}>
                                {room.game_mode === "practice" ? `${displayScore} correct` : `${displayScore} ${strings.points}`}
                              </Badge>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* Cooperation Mode Gameplay */}
        {room.game_state === "playing" && room.game_mode === "cooperation" && (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Prominent Timer Display - Top Center */}
              <div className="text-center mb-6">
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-3xl p-6 shadow-lg">
                  <div className="flex items-center justify-center gap-4">
                    <Clock className="h-10 w-10 text-purple-600" />
                    <div>
                      <p className="text-lg font-medium text-gray-600 mb-2">{strings.timeRemaining}</p>
                      <p className={`text-6xl md:text-7xl font-bold transition-all duration-300 ${
                        cooperationCountdown <= 3 ? 'text-red-600 animate-pulse' : 'text-purple-700'
                      }`}>
                        {cooperationCountdown}s
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Game Header */}
                  <div className="text-center">
                <div className="flex items-center justify-center gap-4 mb-4">
                  <Badge variant={"outline" as any} className="bg-purple-50 text-purple-700 border-purple-200 rounded-full">
                    <Heart className="h-3 w-3 mr-1" />
                    {strings.cooperationMode}
                  </Badge>
                  <Badge variant="outline" className="border-gray-300 text-gray-700 rounded-full">
                    <Target className="h-3 w-3 mr-1" />
                    {strings.target}: {room.target_score}
                  </Badge>
                  <Badge variant="outline" className="border-red-300 text-red-700 rounded-full">
                    <Heart className="h-3 w-3 mr-1" />
                    {strings.lives}: {room.cooperation_lives || 3}
                  </Badge>
                    </div>
                  </div>
                
              {/* Cooperation Challenge */}
              {cooperationChallenge ? (
                <Card className="mobile-card bg-white/80 border-gray-200/50 backdrop-blur-sm shadow-lg rounded-3xl">
                  <CardHeader className="mobile-padding text-center">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-blue-600" />
                        <span className={`font-bold text-lg ${cooperationCountdown <= 3 ? 'text-red-600' : 'text-blue-600'}`}>{cooperationCountdown}{strings.seconds}</span>
                      </div>
                      <div className="text-sm text-gray-600">{strings.questionNumber} #{(room.question_count || 0) + 1}</div>
                    </div>
                    {/* Whose turn indicator */}
                    <div className="mb-2">
                      <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-800 font-semibold text-base">
                        {strings.turn}: {room.players.find(p => p.id === room.current_challenge_player)?.name || strings.partner}
                      </span>
                    </div>
                    <CardTitle className="mobile-text-2xl mb-2 text-gray-900">
                      {strings.translate}: <span className="text-blue-600">{cooperationChallenge.englishName}</span>
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                      {strings.category}: {cooperationChallenge.categoryName}
                    </CardDescription>
                    
                    {/* Prominent typing indicator - always visible and centered */}
                    {cooperationTyping && cooperationTyping.playerId !== playerId && (
                      <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border-2 border-blue-200 shadow-lg">
                  <div className="text-center">
                          <p className="text-lg font-bold text-blue-800 mb-1">
                            {room.players.find(p => p.id === cooperationTyping.playerId)?.name || strings.partner} {strings.isTyping}...
                          </p>
                          <p className="text-xl font-semibold text-gray-800 bg-white/80 rounded-xl p-2 border border-gray-200">
                            "{cooperationTyping.text}"
                          </p>
                    </div>
                  </div>
                    )}
                    
                    {/* Time bank indicator for both players */}
                    <div className="flex justify-center gap-4 mt-2">
                    {room.players.map((player) => (
                        <span key={player.id} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${player.id === room.current_challenge_player ? 'bg-blue-200 text-blue-900' : 'bg-gray-100 text-gray-600'}`}>
                          <Timer className="h-3 w-3" />
                          {player.name}: {player.timeBank || 0}s
                        </span>
                    ))}
                  </div>
                </CardHeader>
                  <CardContent className="mobile-padding">
                    {room.game_mode === "practice" || room.game_mode === "competition" ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {currentQuestion.options.map((option, index) => (
                          <SoundButton
                            key={index}
                            onClick={() => handleAnswerSubmit(option)}
                            disabled={isAnswering}
                              className={`answer-option rounded-2xl shadow-lg transition-all duration-300 transform hover:scale-105 ${
                              answerFeedback?.show 
                                ? option === currentQuestion.correctAnswer 
                                  ? 'correct' 
                                  : option === answerFeedback.selectedAnswer 
                                    ? 'incorrect' 
                                    : ''
                                : ''
                            }`}
                            style={{
                              backgroundColor: answerFeedback?.show 
                                ? option === currentQuestion.correctAnswer 
                                  ? '#4CAF50' 
                                  : option === answerFeedback.selectedAnswer 
                                    ? '#F44336' 
                                    : 'white'
                                : 'white',
                              color: answerFeedback?.show 
                                ? option === currentQuestion.correctAnswer || option === answerFeedback.selectedAnswer
                                  ? 'white' 
                                  : 'black'
                                : 'black',
                              height: '80px',
                              width: '85%',
                              transition: 'all 0.5s ease-in-out',
                              opacity: answerFeedback?.fadeOut ? 0.7 : 1,
                              transform: answerFeedback?.fadeOut ? 'scale(0.98)' : 'scale(1)'
                            }}
                          >
                            {option}
                          </SoundButton>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Only show input bar for the active player and not waiting */}
                        {room.current_challenge_player === playerId && !isCooperationWaiting && (
                          <div>
                            <label htmlFor="cooperationAnswer" className="block text-gray-900 font-medium mb-2">
                              {strings.yourAnswer}:
                            </label>
                          <Input
                            ref={inputRef}
                              id="cooperationAnswer"
                              type="text"
                            value={cooperationAnswer}
                              onChange={(e) => {
                                setCooperationAnswer(e.target.value);
                                handleCooperationTyping(e.target.value);
                              }}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleCooperationAnswer();
                              }
                            }}
                              placeholder={strings.typeYourAnswer}
                              className="bg-white/80 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 rounded-2xl"
                              disabled={isCooperationWaiting}
                              autoComplete="off"
                            />
                        </div>
                        )}

                        <div className="flex gap-3">
                          <SoundButton
                            onClick={handleCooperationAnswer}
                            disabled={!cooperationAnswer.trim() || isCooperationWaiting}
                            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium transition-all duration-300 transform hover:scale-105 shadow-lg rounded-2xl"
                          >
                            {isCooperationWaiting ? strings.submitting : strings.submit}
                          </SoundButton>
                          
                          {currentPlayer?.timeBank > 0 && (
                            <div className="flex gap-2">
                              <Select 
                                value={donatedTimeAmount.toString()} 
                                onValueChange={(value) => setDonatedTimeAmount(parseInt(value))}
                              >
                                <SelectTrigger className="w-20 border-gray-300 rounded-2xl">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: Math.min(currentPlayer.timeBank, 10) }, (_, i) => i + 1).map(amount => (
                                    <SelectItem key={amount} value={amount.toString()}>
                                      {amount}s
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <SoundButton
                                onClick={handleDonateTime}
                                disabled={isDonating}
                                variant="outline"
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 h-12 px-4 transition-all duration-300 rounded-2xl shadow-sm"
                              >
                                <Timer className="h-4 w-4 mr-2" />
                                {strings.donateTime}
                              </SoundButton>
                            </div>
                          )}
                            </div>
                      </div>
                    )}

                    {/* Answer feedback for practice/competition modes */}
                    {answerFeedback?.show && (room.game_mode === "practice" || room.game_mode === "competition") && (
                      <div className={`correct-answer-display mt-4 text-center transition-all duration-500 p-4 rounded-2xl shadow-lg ${
                        answerFeedback.fadeOut ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'
                      } animate-in fade-in slide-in-from-bottom-2 ${!answerFeedback.fadeOut ? 'animate-pulse' : ''} ${
                        answerFeedback.isCorrect 
                          ? 'bg-green-50 border-2 border-green-200 shadow-green-200' 
                          : answerFeedback.selectedAnswer 
                          ? 'bg-red-50 border-2 border-red-200 shadow-red-200' 
                          : 'bg-orange-50 border-2 border-orange-200 shadow-orange-200'
                      }`}>
                        {answerFeedback.isCorrect ? (
                          <span className="text-green-700 font-semibold text-lg">✅ {strings.correct} {strings.wellDone}!</span>
                        ) : answerFeedback.selectedAnswer ? (
                          <span className="text-red-700 font-semibold text-lg">❌ {strings.incorrect} {strings.youSelected}: <strong>{answerFeedback.selectedAnswer}</strong>. {strings.correctAnswerWas}: <strong>{answerFeedback.correctAnswer}</strong></span>
                        ) : (
                          <span className="text-orange-700 font-semibold text-lg">⏰ {strings.timesUp}! {strings.correctAnswerWas}: <strong>{answerFeedback.correctAnswer}</strong></span>
                        )}
                      </div>
                    )}

                    {/* Removed old fixed-position feedback */}
                  </CardContent>
                </Card>
              ) : isCooperationWaiting ? (
                <Card className="mobile-card bg-white/80 border-gray-200/50 backdrop-blur-sm shadow-lg rounded-3xl">
                  <CardContent className="flex flex-col items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-600 mb-4" />
                    <h3 className="mobile-text-lg font-semibold mb-2 text-gray-900">{strings.waitingForPartner}</h3>
                    <p className="text-gray-600 text-center">{strings.partnerWillAnswer}</p>
                    
                    {/* Word suggestion display */}
                    {wordSuggestion && (
                      <div className="mt-6 p-4 bg-blue-50 rounded-2xl border border-blue-200 max-w-md w-full">
                        <div className="text-center">
                          <p className="text-sm text-blue-700 mb-2">{strings.didYouMean}:</p>
                          <div className="space-y-2">
                            <p className="text-lg font-semibold text-gray-800">
                              "{wordSuggestion.original}" → <span className="text-blue-600 font-bold">"{wordSuggestion.suggestion}"</span>
                            </p>
                          </div>
                        </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
                <Card className="mobile-card bg-white/80 border-gray-200/50 backdrop-blur-sm shadow-lg rounded-3xl">
                <CardContent className="flex flex-col items-center justify-center p-8">
                  <Timer className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="mobile-text-lg font-semibold mb-2 text-gray-900">{strings.waitingForQuestion}</h3>
                  <p className="text-gray-600 text-center">{strings.nextQuestionWillAppear}</p>
                </CardContent>
              </Card>
            )}

              {/* Cooperation Leaderboard */}
              <div className="w-full mt-4 flex justify-center">
                <div className="max-w-xl w-full">
                  <Card className="bg-white/90 backdrop-blur-sm border-blue-200 shadow rounded-2xl">
                    <CardHeader className="text-center pb-2">
                      <CardTitle className="flex items-center justify-center gap-2 text-base text-blue-800">
                        <Trophy className="h-4 w-4" />
                        {strings.leaderboard}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-2">
                      <div className="flex flex-col gap-1">
                        {room.players
                          .sort((a, b) => {
                            if (room.game_mode === "cooperation") {
                              return 0;
                            } else if (room.game_mode === "practice") {
                              return b.score - a.score;
                            } else {
                              return b.score - a.score;
                            }
                          })
                          .map((player, index) => {
                            const getDisplayScore = (player: Player) => {
                              if (room.game_mode === "cooperation") {
                                return room.cooperation_score || 0;
                              } else {
                                return player.score;
                              }
                            };
                            const displayScore = getDisplayScore(player);
                            return (
                              <div
                                key={player.id}
                                className={`flex flex-wrap items-center justify-between px-2 py-1 rounded-xl border transition-all duration-300 shadow-sm text-xs gap-2 ${
                                  index === 0
                                    ? 'bg-gradient-to-r from-yellow-100 to-amber-100 border-yellow-300'
                                    : index === 1
                                    ? 'bg-gradient-to-r from-gray-100 to-slate-100 border-gray-300'
                                    : index === 2
                                    ? 'bg-gradient-to-r from-orange-100 to-red-100 border-orange-300'
                                    : 'bg-white/60 border-gray-200/50 hover:bg-white/80'
                                }`}
                                style={{wordBreak: 'break-word'}}
                              >
                                <div className="flex items-center gap-1 min-w-0">
                                  <div className="flex items-center justify-center w-5 h-5 rounded-full bg-yellow-100 border-2 border-yellow-300">
                                    {index === 0 && <Trophy className="h-3 w-3 text-yellow-600" />}
                                    {index === 1 && <Star className="h-3 w-3 text-gray-600" />}
                                    {index === 2 && <Award className="h-3 w-3 text-orange-600" />}
                                    {index > 2 && <span className="text-xs font-bold text-gray-600">{index + 1}</span>}
                                  </div>
                                  <span className={`font-semibold truncate ${index === 0 ? 'text-yellow-800' : 'text-gray-900'}`}>{player.name}</span>
                                  {player.id === playerId && (
                                    <Badge variant="outline" className="text-xxs bg-blue-100 border-blue-300 text-blue-800 rounded-full px-1 py-0.5 ml-1">
                                      {strings.you}
                                    </Badge>
                                  )}
                                  {player.language && (
                                    <span className="flex items-center gap-1 ml-1">
                                      <FlagIcon country={getCountryCode(player.language)} className="h-3 w-3" />
                                      <span className="text-xs text-gray-600 truncate">
                                        {GAME_LANGUAGES.find(l => l.value === player.language)?.label}
                                      </span>
                                    </span>
                                  )}
                                </div>
                                <Badge variant="outline" className={`text-xs font-bold rounded-full px-2 py-0.5 ${
                                  index === 0
                                    ? 'bg-yellow-100 border-yellow-300 text-yellow-800'
                                    : 'bg-gray-100 border-gray-300 text-gray-800'
                                }`}>
                                  {room.game_mode === "practice" ? `${displayScore} correct` : `${displayScore} ${strings.points}`}
                                </Badge>
                              </div>
                            );
                          })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Cooperation Feedback Section */}
              {cooperationFeedback?.show && (
                <div className="mt-6">
                  <Card className="bg-white/80 border-gray-200/50 backdrop-blur-sm shadow-lg rounded-3xl">
                    <CardContent className="p-6">
                      <div className={`text-center transition-all duration-500 ${
                        cooperationFeedback.fadeOut ? 'opacity-0 transform scale-95' : 'opacity-100 transform scale-100'
                      }`}>
                        <div className="space-y-2">
                          <div className="text-3xl font-bold text-green-600 mb-2">✅ {strings.correct}!</div>
                          <div className="text-xl font-semibold text-green-700 mb-2">{cooperationFeedback.word}</div>
                          <div className="text-lg font-bold text-green-600">+1 {strings.point}</div>
                          <div className="text-sm text-gray-600">{cooperationFeedback.playerName} {strings.correctlyAnswered}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}

          {/* Finished Game Screen */}
          {room.game_state === "finished" && (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Game Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Game Mode */}
                <Card className="bg-white/90 backdrop-blur-sm border-yellow-200 shadow-xl rounded-3xl">
                  <CardHeader className="text-center pb-4">
                    <CardTitle className="flex items-center justify-center gap-2 text-xl text-yellow-800">
                      <Gamepad2 className="h-5 w-5" />
                      {strings.gameMode}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      {room.game_mode === "practice" && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 rounded-full">
                          <BookOpen className="h-3 w-3 mr-1" />
                          {strings.practiceMode}
                        </Badge>
                      )}
                      {room.game_mode === "competition" && (
                        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 rounded-full">
                          <Zap className="h-3 w-3 mr-1" />
                          {strings.competitionMode}
                        </Badge>
                      )}
                      {room.game_mode === "cooperation" && (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 rounded-full">
                          <Heart className="h-3 w-3 mr-1" />
                          {strings.cooperationMode}
                        </Badge>
                      )}
                </div>
              </CardContent>
            </Card>

                {/* Language */}
                <Card className="bg-white/90 backdrop-blur-sm border-yellow-200 shadow-xl rounded-3xl">
                  <CardHeader className="text-center pb-4">
                    <CardTitle className="flex items-center justify-center gap-2 text-xl text-yellow-800">
                      <Globe className="h-5 w-5" />
                      {strings.language}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      {room.game_mode === "competition" && room.host_language ? (
                        <div className="flex items-center justify-center gap-2">
                          <FlagIcon country={GAME_LANGUAGES.find(l => l.value === room.host_language)?.country || "gb"} size="sm" />
                          <span className="text-gray-800">
                            {GAME_LANGUAGES.find(l => l.value === room.host_language)?.label}
                          </span>
          </div>
                      ) : (
                        <span className="text-gray-600">{strings.multipleLanguages}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Target Score */}
                {room.game_mode !== "cooperation" && (
                  <Card className="bg-white/90 backdrop-blur-sm border-yellow-200 shadow-xl rounded-3xl">
                    <CardHeader className="text-center pb-4">
                      <CardTitle className="flex items-center justify-center gap-2 text-xl text-yellow-800">
                        <Target className="h-5 w-5" />
                        {strings.targetScore}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center">
                        <Badge variant="outline" className="bg-yellow-100 border-yellow-300 text-yellow-800 rounded-full">
                          {room.target_score} {strings.points}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Player Count */}
                <Card className="bg-white/90 backdrop-blur-sm border-yellow-200 shadow-xl rounded-3xl">
                  <CardHeader className="text-center pb-4">
                    <CardTitle className="flex items-center justify-center gap-2 text-xl text-yellow-800">
                      <Users className="h-5 w-5" />
                      {strings.players}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <Badge variant="outline" className="bg-blue-100 border-blue-300 text-blue-800 rounded-full">
                        {room.players.length} {strings.participants}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Lives Remaining (Cooperation) */}
                {room.game_mode === "cooperation" && (
                  <Card className="bg-white/90 backdrop-blur-sm border-yellow-200 shadow-xl rounded-3xl">
                    <CardHeader className="text-center pb-4">
                      <CardTitle className="flex items-center justify-center gap-2 text-xl text-yellow-800">
                        <Heart className="h-5 w-5" />
                        {strings.livesRemaining}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center">
                        <Badge variant="outline" className="bg-red-100 border-red-300 text-red-800 rounded-full">
                          {room.cooperation_lives || 0} {strings.lives}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Performance Metrics */}
                <Card className="bg-white/90 backdrop-blur-sm border-yellow-200 shadow-xl rounded-3xl">
                  <CardHeader className="text-center pb-4">
                    <CardTitle className="flex items-center justify-center gap-2 text-xl text-yellow-800">
                      <TrendingUp className="h-5 w-5" />
                      {strings.performance}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{strings.questionsAnswered}:</span>
                        <Badge variant="outline" className="bg-green-100 border-green-300 text-green-800 rounded-full">
                          {room.question_count || 0}
                        </Badge>
                      </div>
                      {room.game_mode === "cooperation" && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">{strings.teamScore}:</span>
                          <Badge variant="outline" className="bg-purple-100 border-purple-300 text-purple-800 rounded-full">
                            {room.cooperation_score || 0}
                          </Badge>
                        </div>
                      )}
                      {room.game_mode === "practice" && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Words Answered:</span>
                          <Badge variant="outline" className="bg-blue-100 border-blue-300 text-blue-800 rounded-full">
                            {practiceWordsAnswered}
                          </Badge>
                        </div>
                      )}
                      {room.game_mode === "practice" && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Time Remaining:</span>
                          <Badge variant="outline" className="bg-green-100 border-green-300 text-green-800 rounded-full">
                            {practiceTimer}s
                          </Badge>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Game Duration */}
                <Card className="bg-white/90 backdrop-blur-sm border-yellow-200 shadow-xl rounded-3xl">
                  <CardHeader className="text-center pb-4">
                    <CardTitle className="flex items-center justify-center gap-2 text-xl text-yellow-800">
                      <Clock className="h-5 w-5" />
                      {strings.duration}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center">
                      <Badge variant="outline" className="bg-indigo-100 border-indigo-300 text-indigo-800 rounded-full">
                        {(() => {
                          const startTime = new Date(room.created_at);
                          const endTime = new Date(room.last_activity);
                          const durationMs = endTime.getTime() - startTime.getTime();
                          const minutes = Math.floor(durationMs / 60000);
                          const seconds = Math.floor((durationMs % 60000) / 1000);
                          return `${minutes}m ${seconds}s`;
                        })()}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Achievements Section */}
              <Card className="bg-white/90 backdrop-blur-sm border-yellow-200 shadow-xl mb-8 rounded-3xl">
                <CardHeader className="text-center pb-4">
                  <CardTitle className="flex items-center justify-center gap-2 text-2xl text-yellow-800">
                    <Sparkles className="h-6 w-6" />
                    Achievements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Language Diversity Achievement */}
                    {new Set(room.players.filter(p => p.language).map(p => p.language)).size >= 3 && (
                      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl border border-purple-200">
                        <Languages className="h-6 w-6 text-purple-600" />
                        <div>
                          <p className="font-semibold text-purple-800">Polyglot Party</p>
                          <p className="text-sm text-purple-600">3+ languages used</p>
                        </div>
                      </div>
                    )}
                    
                    {/* High Score Achievement */}
                    {room.game_mode !== "cooperation" && Math.max(...room.players.map(p => p.score)) >= room.target_score && (
                      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-emerald-100 to-green-100 rounded-2xl border border-emerald-200">
                        <Target className="h-6 w-6 text-emerald-600" />
                        <div>
                          <p className="font-semibold text-emerald-800">Target Master</p>
                          <p className="text-sm text-emerald-600">Reached target score</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Cooperation Achievement */}
                    {room.game_mode === "cooperation" && (room.cooperation_score || 0) >= 20 && (
                      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-2xl border border-blue-200">
                        <Heart className="h-6 w-6 text-blue-600" />
                        <div>
                          <p className="font-semibold text-blue-800">Team Spirit</p>
                          <p className="text-sm text-blue-600">20+ words together</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Perfect Game Achievement */}
                    {room.game_mode === "cooperation" && room.cooperation_lives === 3 && (
                      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-yellow-100 to-amber-100 rounded-2xl border border-yellow-200">
                        <Star className="h-6 w-6 text-yellow-600" />
                        <div>
                          <p className="font-semibold text-yellow-800">Perfect Run</p>
                          <p className="text-sm text-yellow-600">No lives lost</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Speed Achievement */}
                    {(() => {
                      const startTime = new Date(room.created_at);
                      const endTime = new Date(room.last_activity);
                      const durationMs = endTime.getTime() - startTime.getTime();
                      const durationMinutes = durationMs / 60000;
                      return durationMinutes < 5;
                    })() && (
                      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-red-100 to-orange-100 rounded-2xl border border-red-200">
                        <Zap className="h-6 w-6 text-red-600" />
                        <div>
                          <p className="font-semibold text-red-800">Speed Demon</p>
                          <p className="text-sm text-red-600">Completed in under 5 minutes</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Participation Achievement */}
                    {room.players.length >= 4 && (
                      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-indigo-100 to-purple-100 rounded-2xl border border-indigo-200">
                        <Users className="h-6 w-6 text-indigo-600" />
                        <div>
                          <p className="font-semibold text-indigo-800">Party Time</p>
                          <p className="text-sm text-indigo-600">4+ players joined</p>
                        </div>
                      </div>
                    )}

                    {/* Practice Mode Achievements */}
                    {room.game_mode === "practice" && practiceWordsAnswered >= 20 && (
                      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-2xl border border-blue-200">
                        <BookOpen className="h-6 w-6 text-blue-600" />
                        <div>
                          <p className="font-semibold text-blue-800">Word Explorer</p>
                          <p className="text-sm text-blue-600">20+ words answered</p>
                        </div>
                      </div>
                    )}
                    {room.game_mode === "practice" && practiceWordsAnswered >= 30 && (
                      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-100 to-emerald-100 rounded-2xl border border-green-200">
                        <Zap className="h-6 w-6 text-green-600" />
                        <div>
                          <p className="font-semibold text-green-800">Speed Learner</p>
                          <p className="text-sm text-green-600">30+ words answered</p>
                        </div>
                      </div>
                    )}
                    {room.game_mode === "practice" && practiceWordsAnswered >= 40 && (
                      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl border border-purple-200">
                        <Star className="h-6 w-6 text-purple-600" />
                        <div>
                          <p className="font-semibold text-purple-800">Language Master</p>
                          <p className="text-sm text-purple-600">40+ words answered</p>
                        </div>
                      </div>
                    )}
                    {room.game_mode === "practice" && practiceWordsAnswered >= 50 && (
                      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-yellow-100 to-orange-100 rounded-2xl border border-yellow-200">
                        <Crown className="h-6 w-6 text-yellow-600" />
                        <div>
                          <p className="font-semibold text-yellow-800">Vocabulary Champion</p>
                          <p className="text-sm text-yellow-600">50+ words answered</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Final Scores Section */}
              <Card className="bg-white/90 backdrop-blur-sm border-yellow-200 shadow-xl rounded-3xl">
                <CardHeader className="text-center pb-4">
                  <CardTitle className="flex items-center justify-center gap-2 text-2xl text-yellow-800">
                    <Award className="h-6 w-6" />
                    Final Results
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                  {room.players
                    .sort((a, b) => {
                      if (room.game_mode === "cooperation") {
                        // For cooperation, all players have the same score
                        return 0;
                      } else {
                        // For competition, sort by individual scores
                        return b.score - a.score;
                      }
                    })
                    .map((player, index) => (
                      <div
                        key={player.id}
                          className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all duration-200 ${
                            index === 0 
                              ? 'bg-gradient-to-r from-yellow-100 to-amber-100 border-yellow-300 shadow-md' 
                              : index === 1 
                              ? 'bg-gradient-to-r from-gray-100 to-slate-100 border-gray-300' 
                              : index === 2 
                              ? 'bg-gradient-to-r from-orange-100 to-red-100 border-orange-300' 
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 border-2 border-yellow-300">
                              {index === 0 && <Trophy className="h-4 w-4 text-yellow-600" />}
                              {index === 1 && <Star className="h-4 w-4 text-gray-600" />}
                              {index === 2 && <Award className="h-4 w-4 text-orange-600" />}
                              {index > 2 && <span className="text-sm font-bold text-gray-600">{index + 1}</span>}
                            </div>
                        <div className="flex items-center gap-3">
                              <span className={`font-semibold mobile-text-base ${
                                index === 0 ? 'text-yellow-800' : 'text-gray-800'
                              }`}>
                                {player.name}
                              </span>
                          {player.id === playerId && (
                                <Badge variant="outline" className="text-xs bg-blue-100 border-blue-300 text-blue-800 rounded-full">
                                  {strings.you}
                                </Badge>
                              )}
                              {player.is_host && (
                                <Badge variant="outline" className="text-xs bg-purple-100 border-purple-300 text-purple-800 rounded-full">
                                  <Crown className="h-3 w-3 mr-1" />
                                  Host
                                </Badge>
                          )}
                        </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {player.language && (
                              <div className="flex items-center gap-1">
                                <FlagIcon country={getCountryCode(player.language)} className="h-4 w-4" />
                                <span className="text-sm text-gray-600">
                                  {GAME_LANGUAGES.find(l => l.value === player.language)?.label}
                                </span>
                              </div>
                            )}
                            <Badge variant="outline" className={`mobile-text-sm font-bold rounded-full ${
                              index === 0 
                                ? 'bg-yellow-100 border-yellow-300 text-yellow-800' 
                                : 'bg-gray-100 border-gray-300 text-gray-800'
                            }`}>
                          {room.game_mode === "cooperation" ? (room.cooperation_score || 0) : player.score} {strings.points}
                        </Badge>
                          </div>
                      </div>
                    ))}
                </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-8">
                {isCurrentPlayerHost && (
                    <SoundButton
                      onClick={handleRestart}
                    className="mobile-btn-lg px-8 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-white shadow-lg transform hover:scale-105 transition-all duration-200 rounded-2xl"
                    >
                      <RotateCcw className="h-5 w-5 mr-2" />
                      {strings.playAgain}
                    </SoundButton>
                )}
                <SoundButton
                  onClick={handleLeaveRoom}
                  className="mobile-btn-lg px-8 bg-gradient-to-r from-gray-500 to-slate-500 hover:from-gray-600 hover:to-slate-600 text-white shadow-lg transform hover:scale-105 transition-all duration-200 rounded-2xl"
                >
                  <LogOut className="h-5 w-5 mr-2" />
                  {strings.leaveRoom}
                </SoundButton>
              </div>

              {/* Practice Mode Statistics Section */}
              {room.game_mode === "practice" && (
                <Card className="bg-white/90 backdrop-blur-sm border-blue-200 shadow-xl mb-8 rounded-3xl">
                  <CardHeader className="text-center pb-4">
                    <CardTitle className="flex items-center justify-center gap-2 text-2xl text-blue-800">
                      <BookOpen className="h-6 w-6" />
                      Practice Mode Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Total Words Answered */}
                      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-100 to-cyan-100 rounded-2xl border border-blue-200">
                        <Check className="h-6 w-6 text-blue-600" />
                        <div>
                          <p className="font-semibold text-blue-800">Words Answered</p>
                          <p className="text-lg font-bold text-blue-700">{practiceWordsAnswered}</p>
                        </div>
                      </div>
                      
                      {/* Correct Answers */}
                      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-100 to-emerald-100 rounded-2xl border border-green-200">
                        <Target className="h-6 w-6 text-green-600" />
                        <div>
                          <p className="font-semibold text-green-800">Correct Answers</p>
                          <p className="text-lg font-bold text-green-700">{practiceCorrectAnswers}</p>
                        </div>
                      </div>
                      
                      {/* Incorrect Answers */}
                      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-red-100 to-orange-100 rounded-2xl border border-red-200">
                        <X className="h-6 w-6 text-red-600" />
                        <div>
                          <p className="font-semibold text-red-800">Incorrect Answers</p>
                          <p className="text-lg font-bold text-red-700">{practiceIncorrectAnswers}</p>
                        </div>
                      </div>
                      
                      {/* Accuracy */}
                      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl border border-purple-200">
                        <TrendingUp className="h-6 w-6 text-purple-600" />
                        <div>
                          <p className="font-semibold text-purple-800">Accuracy</p>
                          <p className="text-lg font-bold text-purple-700">{practiceAccuracy}%</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Words per Minute */}
                    <div className="mt-6 p-4 bg-gradient-to-r from-yellow-100 to-amber-100 rounded-2xl border border-yellow-200">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Zap className="h-5 w-5 text-yellow-600" />
                          <p className="font-semibold text-yellow-800">Speed</p>
                        </div>
                        <p className="text-2xl font-bold text-yellow-700">
                          {practiceWordsAnswered > 0 ? Math.round((practiceWordsAnswered / 1) * 60) : 0} words per minute
                        </p>
                        <p className="text-sm text-yellow-600 mt-1">Based on 60-second session</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
        )}
        </div>
      </div>
    </div>
  );
}