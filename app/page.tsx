"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { SoundButton } from "@/components/ui/sound-button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AudioSettings } from "@/components/audio-settings"
import { Gamepad2, Users, Settings, Volume2, BookOpen, Zap, Globe, Heart, ArrowRight, Plus, Search } from "lucide-react"
import { io, Socket } from "socket.io-client"
import { getLocalizedStrings, Language } from "@/lib/localization"
import { FlagIcon, getCountryCode } from "@/components/ui/flag-icon"
import { useBgPulse } from "./client-layout"

interface AvailableRoom {
  id: string
  playerCount: number
  maxPlayers: number
  status: "waiting"
  targetScore: number
  gameMode?: "practice" | "competition" | "cooperation" | null
  hostLanguage?: "french" | "german" | "russian" | "japanese" | "spanish" | "english" | null
}

const LANGUAGES = [
  { value: "english", label: "English", country: "gb" },
  { value: "french", label: "French", country: "fr" },
  { value: "german", label: "German", country: "de" },
  { value: "russian", label: "Russian", country: "ru" },
  { value: "japanese", label: "Japanese", country: "jp" },
  { value: "spanish", label: "Spanish", country: "es" },
] as const;

const UI_LANGUAGES = [
  { value: "english", label: "English", country: "gb" },
  { value: "french", label: "Français", country: "fr" },
  { value: "spanish", label: "Español", country: "es" },
] as const;

// Animated background characters for different languages
const BACKGROUND_CHARS = {
  japanese: ['あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ', 'さ', 'し', 'す', 'せ', 'そ', 'た', 'ち', 'つ', 'て', 'と', 'な', 'に', 'ぬ', 'ね', 'の', 'は', 'ひ', 'ふ', 'へ', 'ほ', 'ま', 'み', 'む', 'め', 'も'],
  russian: ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ё', 'Ж', 'З', 'И', 'Й', 'К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С', 'Т', 'У', 'Ф', 'Х', 'Ц', 'Ч', 'Ш', 'Щ', 'Ъ', 'Ы', 'Ь', 'Э', 'Ю', 'Я'],
  chinese: ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '人', '大', '小', '中', '国', '你', '好', '我', '是', '的', '在', '有', '和', '这', '为', '上', '个', '以', '要', '他', '她', '它', '们', '们', '们'],
  korean: ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하', '기', '니', '디', '리', '미', '비', '시', '이', '지', '치', '키', '티', '피', '히', '구', '누', '두', '루', '무', '부', '수'],
  arabic: ['ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي', 'ة', 'ى', 'ء', 'ئ', 'ؤ', 'إ', 'أ']
}

// Language-changing subtitle variations
const SUBTITLE_VARIATIONS = [
  "Test your language skills with friends in real-time multiplayer quizzes",
  "Testez vos compétences linguistiques avec des amis dans des quiz multijoueurs en temps réel",
  "Testen Sie Ihre Sprachkenntnisse mit Freunden in Echtzeit-Multiplayer-Quiz",
  "Проверьте свои языковые навыки с друзьями в многопользовательских викторинах в реальном времени",
  "友達とリアルタイムマルチプレイヤークイズで言語スキルをテスト",
  "Pon a prueba tus habilidades lingüísticas con amigos en cuestionarios multijugador en tiempo real"
];

// Base text for the erasing-typing effect
const BASE_TEXT = "Test your language skills with friends in real-time multiplayer quizzes";

// Words that will be randomly changed during the effect with translations
const CHANGEABLE_WORDS = [
  { 
    original: "language", 
    variations: [
      { text: "linguistic", lang: "English" },
      { text: "linguistique", lang: "French" },
      { text: "Sprach", lang: "German" },
      { text: "язык", lang: "Russian" },
      { text: "言語", lang: "Japanese" },
      { text: "idioma", lang: "Spanish" }
    ]
  },
  { 
    original: "skills", 
    variations: [
      { text: "abilities", lang: "English" },
      { text: "compétences", lang: "French" },
      { text: "Fähigkeiten", lang: "German" },
      { text: "навыки", lang: "Russian" },
      { text: "スキル", lang: "Japanese" },
      { text: "habilidades", lang: "Spanish" }
    ]
  },
  { 
    original: "friends", 
    variations: [
      { text: "peers", lang: "English" },
      { text: "amis", lang: "French" },
      { text: "Freunde", lang: "German" },
      { text: "друзья", lang: "Russian" },
      { text: "友達", lang: "Japanese" },
      { text: "amigos", lang: "Spanish" }
    ]
  },
  { 
    original: "real-time", 
    variations: [
      { text: "live", lang: "English" },
      { text: "temps réel", lang: "French" },
      { text: "Echtzeit", lang: "German" },
      { text: "реальное время", lang: "Russian" },
      { text: "リアルタイム", lang: "Japanese" },
      { text: "tiempo real", lang: "Spanish" }
    ]
  },
  { 
    original: "multiplayer", 
    variations: [
      { text: "collaborative", lang: "English" },
      { text: "multijoueur", lang: "French" },
      { text: "Mehrspieler", lang: "German" },
      { text: "многопользовательский", lang: "Russian" },
      { text: "マルチプレイヤー", lang: "Japanese" },
      { text: "multijugador", lang: "Spanish" }
    ]
  },
  { 
    original: "quizzes", 
    variations: [
      { text: "challenges", lang: "English" },
      { text: "quiz", lang: "French" },
      { text: "Quiz", lang: "German" },
      { text: "викторины", lang: "Russian" },
      { text: "クイズ", lang: "Japanese" },
      { text: "cuestionarios", lang: "Spanish" }
    ]
  }
];

export default function HomePage() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [roomCode, setRoomCode] = useState("")
  const [playerName, setPlayerName] = useState("")
  const [isConnecting, setIsConnecting] = useState(false)
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([])
  const [showAudioSettings, setShowAudioSettings] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [uiLanguage, setUiLanguage] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("uiLanguage") as Language) || "english"
    }
    return "english"
  })
  const strings = getLocalizedStrings(uiLanguage)
  const { setBg } = useBgPulse();

  // Language-changing text effect
  const [currentSubtitleIndex, setCurrentSubtitleIndex] = useState(0);
  const [textEffect, setTextEffect] = useState<'language' | 'alphabet'>('language');
  const [displayText, setDisplayText] = useState(BASE_TEXT);
  const [isTyping, setIsTyping] = useState(false);
  const [targetText, setTargetText] = useState(BASE_TEXT);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [isErasing, setIsErasing] = useState(false);
  const [currentWord, setCurrentWord] = useState("");
  const [currentWordPosition, setCurrentWordPosition] = useState({ start: 0, end: 0 });

  useEffect(() => {
    console.log("🔌 Initializing Socket.IO connection...")
    
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
    })

    newSocket.on("connect", () => {
      console.log("✅ Connected to server successfully")
      console.log("  - Socket ID:", newSocket.id)
      console.log("  - Transport:", newSocket.io.engine.transport.name)
      console.log("  - Namespace:", newSocket.nsp.name)
      setConnectionStatus('connected')
      setConnectionError(null)
      
      newSocket.emit("get-available-rooms", {}, (response: { rooms: AvailableRoom[] }) => {
        if (response.rooms) {
          setAvailableRooms(response.rooms)
        }
      })
    })

    newSocket.on("connection-success", (data: any) => {
      console.log("🎉 Connection success confirmed:", data)
      setConnectionStatus('connected')
      setConnectionError(null)
    })

    newSocket.on("namespace-error", (error: any) => {
      console.error("🚨 Namespace error:", error)
      setConnectionStatus('error')
      setConnectionError(`Namespace error: ${error.message}`)
    })

    newSocket.on("connect_error", (error: any) => {
      console.error("❌ Connection error:", error)
      setConnectionStatus('error')
      setConnectionError(`Connection failed: ${error.message}`)
    })

    newSocket.on("disconnect", (reason: any) => {
      console.log("🔌 Disconnected from server, reason:", reason)
      setConnectionStatus('connecting')
      setConnectionError(null)
    })

    newSocket.on("reconnect", (attemptNumber: any) => {
      console.log("🔄 Reconnected after", attemptNumber, "attempts")
      setConnectionStatus('connected')
      setConnectionError(null)
    })

    newSocket.on("reconnect_error", (error: any) => {
      console.error("❌ Reconnection error:", error)
      setConnectionError(`Reconnection failed: ${error.message}`)
    })

    newSocket.on("available-rooms-update", ({ rooms }: { rooms: AvailableRoom[] }) => {
      console.log("📡 Available rooms updated:", rooms)
      setAvailableRooms(rooms)
    })

    newSocket.io.on("error", (error: any) => {
      console.error("❌ Socket.IO engine error:", error)
      setConnectionStatus('error')
      setConnectionError(`Engine error: ${error.message || error}`)
    })

    newSocket.io.on("reconnect_failed", () => {
      console.error("❌ Failed to reconnect to server")
      setConnectionStatus('error')
      setConnectionError("Failed to reconnect after multiple attempts")
    })

    newSocket.on("error", (error: any) => {
      console.error("❌ Socket error:", error)
      if (error.message && error.message.includes("namespace")) {
        setConnectionError("Invalid namespace configuration")
      } else {
        setConnectionError(`Socket error: ${error.message || error}`)
      }
      setConnectionStatus('error')
    })

    setSocket(newSocket)

    return () => {
      console.log("🔌 Cleaning up socket connection...")
      newSocket.close()
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("uiLanguage", uiLanguage)
  }, [uiLanguage])

  useEffect(() => {
    setBg("bg-gradient-to-br from-white via-blue-50 to-white"); // Home gradient
  }, [setBg]);

  // Word-by-word erasing-typing text effect
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isTyping) {
        // Select a random word to change
        const randomWord = CHANGEABLE_WORDS[Math.floor(Math.random() * CHANGEABLE_WORDS.length)];
        const randomVariation = randomWord.variations[Math.floor(Math.random() * randomWord.variations.length)];
        
        // Find the word position in the current text
        const words = displayText.split(' ');
        const wordIndex = words.findIndex(word => 
          word.toLowerCase().includes(randomWord.original.toLowerCase())
        );
        
        if (wordIndex !== -1) {
          const wordStart = words.slice(0, wordIndex).join(' ').length + (wordIndex > 0 ? 1 : 0);
          const wordEnd = wordStart + words[wordIndex].length;
          
          setCurrentWordIndex(wordIndex);
          setCurrentWord(words[wordIndex]);
          setCurrentWordPosition({ start: wordStart, end: wordEnd });
          setTargetText(randomVariation.text);
          setIsTyping(true);
          setIsErasing(true);
        } else {
          // If word not found, reset to original text and continue
          setDisplayText(BASE_TEXT);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isTyping, displayText]);

  // Handle word erasing and typing animation
  useEffect(() => {
    if (!isTyping || currentWordIndex === -1) return;

    const timer = setTimeout(() => {
      if (isErasing) {
        // Erasing phase - remove one character from the word
        if (currentWord.length > 0) {
          const newWord = currentWord.slice(0, -1);
          setCurrentWord(newWord);
          
          // Update the display text with the partially erased word
          const words = displayText.split(' ');
          words[currentWordIndex] = newWord;
          setDisplayText(words.join(' '));
        } else {
          // Start typing phase
          setIsErasing(false);
        }
      } else {
        // Typing phase - add one character to the word
        if (currentWord.length < targetText.length) {
          const newWord = targetText.slice(0, currentWord.length + 1);
          setCurrentWord(newWord);
          
          // Update the display text with the partially typed word
          const words = displayText.split(' ');
          words[currentWordIndex] = newWord;
          setDisplayText(words.join(' '));
        } else {
          // Finished typing
          setIsTyping(false);
          setCurrentWordIndex(-1);
          
          // Occasionally reset to original text to ensure infinite loop
          if (Math.random() < 0.3) { // 30% chance to reset
            setTimeout(() => {
              setDisplayText(BASE_TEXT);
            }, 1000);
          }
        }
      }
    }, isErasing ? 80 : 120); // Faster erasing, slower typing

    return () => clearTimeout(timer);
  }, [isTyping, isErasing, currentWord, targetText, currentWordIndex, displayText]);

  // Generate random alphabet effect text
  const getAlphabetEffectText = () => {
    const originalText = BASE_TEXT;
    const alphabets = ['ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz', 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'あいうえおかきくけこさしすせそたちつてと', '안녕하세요감사합니다'];
    
    return originalText.split('').map((char, index) => {
      if (Math.random() < 0.1) {
        const randomAlphabet = alphabets[Math.floor(Math.random() * alphabets.length)];
        const randomChar = randomAlphabet[Math.floor(Math.random() * randomAlphabet.length)];
        return randomChar;
      }
      return char;
    }).join('');
  };

  const currentSubtitle = textEffect === 'language' 
    ? displayText
    : getAlphabetEffectText();

  // Toggle between language and alphabet effects
  useEffect(() => {
    const effectInterval = setInterval(() => {
      setTextEffect(prev => prev === 'language' ? 'alphabet' : 'language');
    }, 4000); // Changed from 6000 to 4000 to match faster timing

    return () => clearInterval(effectInterval);
  }, []);

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      alert(strings.pleaseEnterName)
      return
    }
    if (connectionStatus !== 'connected') {
      alert(strings.pleaseWaitForConnection)
      return
    }
    const newRoomCode = generateRoomCode()
    const playerId = `player-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    window.location.href = `/room/${newRoomCode}?playerId=${playerId}&name=${encodeURIComponent(playerName.trim())}&isHost=true&uiLanguage=${uiLanguage}`
  }

  const handleJoinRoom = (targetRoomCode?: string) => {
    const codeToJoin = targetRoomCode || roomCode.trim().toUpperCase()
    if (!codeToJoin) {
      alert(strings.pleaseEnterRoomCode)
      return
    }
    if (!playerName.trim()) {
      alert(strings.pleaseEnterName)
      return
    }
    if (connectionStatus !== 'connected') {
      alert(strings.pleaseWaitForConnection)
      return
    }
    setIsConnecting(true)
    const playerId = `player-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    window.location.href = `/room/${codeToJoin}?playerId=${playerId}&name=${encodeURIComponent(playerName.trim())}&isHost=false&uiLanguage=${uiLanguage}`
  }

  const getGameModeDisplay = (room: AvailableRoom) => {
    if (!room.gameMode) {
      return (
        <Badge variant="outline" className="text-xs bg-gray-100/50 text-gray-600 border-gray-300/50 backdrop-blur-sm">
          <Settings className="h-3 w-3 mr-1" />
          <span className="hidden sm:inline">Setting up...</span>
          <span className="sm:hidden">Setup</span>
        </Badge>
      )
    }

    if (room.gameMode === "practice") {
      return (
        <Badge variant="outline" className="text-xs bg-blue-100/50 text-blue-700 border-blue-300/50 backdrop-blur-sm">
          <BookOpen className="h-3 w-3 mr-1" />
          Practice
        </Badge>
      )
    }

    if (room.gameMode === "cooperation") {
      return (
        <Badge variant="outline" className="text-xs bg-purple-100/50 text-purple-700 border-purple-300/50 backdrop-blur-sm">
          <Heart className="h-3 w-3 mr-1" />
          <span className="hidden sm:inline">Cooperation</span>
          <span className="sm:hidden">Coop</span>
        </Badge>
      )
    }

    return (
      <Badge variant="outline" className="text-xs bg-orange-100/50 text-orange-700 border-orange-300/50 backdrop-blur-sm">
        <Zap className="h-3 w-3 mr-1" />
        <span className="hidden sm:inline">Competition</span>
        <span className="sm:hidden">Comp</span>
      </Badge>
    )
  }

  const getLanguageDisplay = (room: AvailableRoom) => {
    if (room.gameMode === "competition" && room.hostLanguage) {
      const language = LANGUAGES.find(l => l.value === room.hostLanguage)
      return (
        <Badge variant="outline" className="text-xs bg-green-100/50 text-green-700 border-green-300/50 backdrop-blur-sm">
          <Globe className="h-3 w-3 mr-1" />
          <span className="hidden sm:inline flex items-center gap-1">
            <FlagIcon country={language?.country || "gb"} size="sm" />
            {language?.label || room.hostLanguage}
          </span>
          <span className="sm:hidden flex items-center gap-1">
            <FlagIcon country={language?.country || "gb"} size="sm" />
            {language?.label?.split(' ')[0] || room.hostLanguage}
          </span>
        </Badge>
      )
    }
    return null
  }

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Static Animated Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-white via-blue-50 to-white"></div>
        
        {/* Static Floating Language Characters */}
        {Object.entries(BACKGROUND_CHARS).map(([lang, chars]) => 
          chars.map((char, index) => {
            // Use deterministic positioning based on index to prevent random repositioning
            const baseLeft = (index * 8 + lang.length * 3) % 100;
            const baseTop = (index * 12 + lang.length * 5) % 100;
            // Use negative animationDelay so animation appears already in progress
            const floatDuration = 40 + (index % 30);
            const floatDelay = -1 * ((index * 2.7 + lang.length * 1.3) % floatDuration); // negative value
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
        
        {/* Subtle blue overlay for flashing effect */}
        <div className="absolute inset-0 bg-blue-500/5 animate-pulse"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="flex justify-between items-center p-4 md:p-6 border-b border-gray-200/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Gamepad2 className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">
              {strings.title}
            </h1>
          </div>
          
        {/* Language Selector */}
          <select
            value={uiLanguage}
            onChange={e => setUiLanguage(e.target.value as Language)}
            className="bg-white/80 border border-gray-300 rounded-2xl px-4 py-2 text-sm text-gray-700 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            aria-label="Select language"
          >
            {UI_LANGUAGES.map(lang => (
              <option key={lang.value} value={lang.value} className="bg-white text-gray-700">
                {lang.label}
              </option>
            ))}
          </select>
        </header>

        {/* Connection Status */}
        <div className="px-4 md:px-6 py-2">
          {connectionStatus === 'connecting' && (
            <div className="flex items-center gap-2 text-blue-600 text-sm">
              <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
              {strings.connecting}
          </div>
            )}
            {connectionStatus === 'connected' && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <div className="w-2 h-2 bg-green-600 rounded-full"></div>
              {strings.connected}
            </div>
            )}
            {connectionStatus === 'error' && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <div className="w-2 h-2 bg-red-600 rounded-full"></div>
              {strings.connectionFailed}
              </div>
            )}
          </div>

        {/* Main Content */}
        <main className="flex-1 px-4 md:px-6 py-6">
          <div className="max-w-6xl mx-auto">
            {/* Hero Section */}
            <div className="text-center mb-8 md:mb-12">
              <h2 className="text-2xl md:text-4xl font-bold text-gray-900 mb-4 transition-all duration-500">
                {(() => {
                  const words = displayText.split(' ');
                  return words.map((word, idx) => (
                    <span key={idx} style={{ position: 'relative' }}>
                      {word}
                      {isTyping && idx === currentWordIndex && (
                        <span className="inline-block w-0.5 h-8 bg-blue-600 ml-1 align-middle animate-pulse" style={{ position: 'absolute', right: '-0.6em', top: 0 }}></span>
                      )}
                      {idx < words.length - 1 ? ' ' : ''}
                    </span>
                  ));
                })()}
              </h2>
        </div>

            <div className="grid lg:grid-cols-3 gap-6 md:gap-8">
              {/* Main Game Controls */}
              <div className="lg:col-span-2 space-y-6">
                {/* Player Setup */}
                <Card className="bg-white/80 border-gray-200/50 backdrop-blur-sm shadow-2xl rounded-3xl">
                  <CardHeader className="pb-4 text-center">
                    <CardTitle className="text-gray-900 text-xl md:text-2xl flex items-center justify-center gap-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <Users className="w-4 h-4 text-white" />
                      </div>
                      {strings.joinGame}
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                  {strings.enterName}
                </CardDescription>
              </CardHeader>
                  <CardContent className="space-y-6">
                <div>
                      <label htmlFor="playerName" className="block text-gray-900 font-medium mb-2">
                        Username
                  </label>
                  <Input
                    id="playerName"
                    type="text"
                        placeholder="Username"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    maxLength={20}
                        className="bg-white/80 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 rounded-2xl"
                        autoComplete="off"
                  />
                </div>

                    <div className="grid md:grid-cols-2 gap-4">
                  <SoundButton
                    onClick={handleCreateRoom}
                        className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white h-12 font-medium transition-all duration-300 transform hover:scale-105 shadow-lg rounded-2xl"
                    disabled={!playerName.trim() || connectionStatus !== 'connected'}
                  >
                        <Plus className="h-5 w-5 mr-2" />
                    <span className="hidden sm:inline">{strings.createNewRoom}</span>
                    <span className="sm:hidden">{strings.createRoom}</span>
                  </SoundButton>

                      <div className="space-y-3">
                    <Input
                      type="text"
                      placeholder={strings.roomCode}
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      maxLength={6}
                          className="bg-white/80 border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 rounded-2xl"
                          autoComplete="off"
                    />
                    <SoundButton
                      onClick={() => handleJoinRoom()}
                      variant="outline"
                          className="border-gray-300 text-gray-700 hover:bg-gray-50 h-10 w-full rounded-2xl shadow-sm"
                      disabled={!playerName.trim() || !roomCode.trim() || isConnecting || connectionStatus !== 'connected'}
                    >
                      {isConnecting ? strings.joining : strings.joinRoom}
                    </SoundButton>
                  </div>
                </div>
              </CardContent>
            </Card>

                {/* Available Rooms */}
                <Card className="bg-white/80 border-gray-200/50 backdrop-blur-sm shadow-2xl rounded-3xl">
                  <CardHeader className="pb-4 text-center">
                    <CardTitle className="text-gray-900 text-xl md:text-2xl flex items-center justify-center gap-3">
                      <div className="w-8 h-8 bg-green-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <Search className="w-4 h-4 text-white" />
                      </div>
                  <span className="hidden sm:inline">{strings.availableRooms}</span>
                  <span className="sm:hidden">{strings.rooms}</span>
                      <Badge className="bg-blue-600 text-white rounded-full">{availableRooms.length}</Badge>
                </CardTitle>
                    <CardDescription className="text-gray-600">
                      {strings.joinExistingRooms}
                </CardDescription>
              </CardHeader>
                  <CardContent>
                {connectionStatus !== 'connected' ? (
                      <div className="text-center py-12 text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-lg font-medium mb-2">
                      {connectionStatus === 'connecting' ? strings.connecting : strings.connectionFailed}
                    </p>
                        <p className="text-sm px-4">
                      {connectionStatus === 'connecting' 
                        ? strings.pleaseWaitConnecting
                        : connectionError || strings.pleaseRefreshPage
                      }
                    </p>
                  </div>
                ) : availableRooms.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">{strings.noActiveRooms}</p>
                        <p className="text-sm">{strings.beFirstToCreate}</p>
                  </div>
                ) : (
                      <div className="space-y-3">
                    {availableRooms.map((room) => (
                      <div
                        key={room.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white/60 rounded-2xl border border-gray-200/50 hover:bg-white/80 transition-all duration-300 gap-4 shadow-sm"
                      >
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1 min-w-0">
                          <div className="min-w-0">
                                <p className="font-mono text-lg font-bold text-blue-600 break-all">
                              {room.id}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-gray-500" />
                                <Badge variant="outline" className="border-gray-300 text-gray-700 rounded-full">
                              {room.playerCount}/{room.maxPlayers}
                            </Badge>
                          </div>

                              <div className="flex flex-wrap gap-2">
                            {getGameModeDisplay(room)}
                            {getLanguageDisplay(room)}
                          </div>
                        </div>

                          <SoundButton
                            onClick={() => handleJoinRoom(room.id)}
                            disabled={!playerName.trim() || isConnecting || connectionStatus !== 'connected'}
                              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-6 h-10 transition-all duration-300 transform hover:scale-105 shadow-lg rounded-2xl"
                          >
                            {isConnecting ? strings.joining : "Join"}
                          </SoundButton>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

              {/* Sidebar */}
              <div className="space-y-6">
            {/* Game Info */}
                <Card className="bg-white/80 border-gray-200/50 backdrop-blur-sm shadow-2xl rounded-3xl">
                  <CardHeader className="pb-4 text-center">
                    <CardTitle className="text-gray-900 text-lg flex items-center justify-center gap-3">
                      <div className="w-6 h-6 bg-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <BookOpen className="w-3 h-3 text-white" />
                      </div>
                      {strings.howToPlay}
                    </CardTitle>
              </CardHeader>
                  <CardContent className="space-y-6 text-sm">
                    <div>
                      <p className="font-medium text-gray-900 mb-3">{strings.gameModes}</p>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                      <BookOpen className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-blue-600">{strings.practiceMode}</p>
                            <p className="text-gray-600">{strings.practiceDescription}</p>
                      </div>
                    </div>
                        <div className="flex items-start gap-3">
                      <Zap className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-orange-600">{strings.competitionMode}</p>
                            <p className="text-gray-600">{strings.competitionDescription}</p>
                      </div>
                    </div>
                        <div className="flex items-start gap-3">
                      <Heart className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-purple-600">{strings.cooperationMode}</p>
                            <p className="text-gray-600">{strings.cooperationDescription}</p>
                      </div>
                    </div>
                  </div>
                </div>

                    <div>
                      <p className="font-medium text-gray-900 mb-3">{strings.gameRules}</p>
                      <ul className="space-y-2 text-gray-600 ml-4">
                        <li>• {strings.chooseGameMode}</li>
                        <li>• {strings.translateEnglishWords}</li>
                        <li>• {strings.earnPoints}</li>
                        <li>• {strings.firstToReach}</li>
                  </ul>
                </div>

                    <div>
                      <p className="font-medium text-gray-900 mb-3">{strings.languages}</p>
                      <div className="flex flex-wrap gap-2">
                    {LANGUAGES.map((lang) => (
                          <Badge key={lang.value} variant="outline" className="border-gray-300 text-gray-700 flex items-center gap-1 rounded-full">
                        <FlagIcon country={lang.country} size="sm" />
                        {lang.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                {connectionStatus === 'error' && (
                      <div className="mt-4 p-4 bg-red-50 rounded-2xl border border-red-200">
                        <p className="font-medium text-red-700 mb-2">{strings.connectionIssues}</p>
                        <ul className="space-y-1 text-red-600 text-xs ml-4">
                      <li>• {strings.tryRefreshing}</li>
                      <li>• {strings.checkInternet}</li>
                      <li>• {strings.disableAdBlockers}</li>
                      <li>• {strings.tryDifferentBrowser}</li>
                      <li>• {strings.clearCache}</li>
                    </ul>
                    {connectionError && (
                          <div className="mt-2 p-2 bg-red-100 rounded-lg text-xs">
                        <strong>{strings.errorDetails}</strong> {connectionError}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
        </main>
      </div>

      {/* CSS Animation for flashing characters */}
      <style jsx>{`
        @keyframes flash {
          0%, 100% {
            filter: brightness(1) hue-rotate(0deg);
          }
          50% {
            filter: brightness(1.2) hue-rotate(10deg);
          }
        }
      `}</style>
    </div>
  )
}