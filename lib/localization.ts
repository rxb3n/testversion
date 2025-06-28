export type Language = 'english' | 'french' | 'spanish';

export interface LocalizedStrings {
  // Home page
  title: string;
  subtitle: string;
  subtitleMobile: string;
  joinGame: string;
  enterName: string;
  yourName: string;
  createNewRoom: string;
  createRoom: string;
  roomCode: string;
  joinRoom: string;
  joining: string;
  pleaseEnterName: string;
  pleaseEnterRoomCode: string;
  pleaseWaitForConnection: string;
  availableRooms: string;
  rooms: string;
  joinExistingRooms: string;
  noActiveRooms: string;
  beFirstToCreate: string;
  connecting: string;
  connectionFailed: string;
  pleaseWaitConnecting: string;
  pleaseRefreshPage: string;
  settings: string;
  audio: string;
  gameModes: string;
  practiceMode: string;
  practiceDescription: string;
  competitionMode: string;
  competitionDescription: string;
  cooperationMode: string;
  cooperationDescription: string;
  chooseGameMode: string;
  translateEnglishWords: string;
  earnPoints: string;
  firstToReach: string;
  languages: string;
  connectionIssues: string;
  tryRefreshing: string;
  checkInternet: string;
  disableAdBlockers: string;
  tryDifferentBrowser: string;
  clearCache: string;
  errorDetails: string;

  // Question display
  translate: string;
  translateToEnglish: string;
  source: string;
  target: string;
  randomLanguage: string;
  english: string;
  timeRemaining: string;
  point: string;

  // Room page
  waitingForPlayers: string;
  startGame: string;
  restart: string;
  leaveRoom: string;
  gameMode: string;
  targetScore: string;
  hostLanguage: string;
  selectLanguage: string;
  players: string;
  score: string;
  timeLeft: string;
  correct: string;
  incorrect: string;
  correctAnswer: string;
  yourAnswer: string;
  nextQuestion: string;
  gameOver: string;
  winner: string;
  finalScore: string;
  cooperationLives: string;
  cooperationScore: string;
  cooperationCategory: string;
  cooperationTypeWord: string;
  cooperationSubmit: string;
  cooperationWaiting: string;
  cooperationYourTurn: string;
  cooperationPartnerTurn: string;
  cooperationTimeout: string;
  cooperationSuccess: string;
  cooperationFailure: string;
  cooperationUsedWord: string;
  cooperationInvalidCategory: string;
  cooperationInvalidLanguage: string;
  cooperationMissingAnswer: string;
  cooperationInvalidChallenge: string;

  // Lobby and game elements
  room: string;
  host: string;
  connected: string;
  disconnected: string;
  selectGameMode: string;
  chooseHowToPlay: string;
  gameSettings: string;
  currentGameMode: string;
  change: string;
  language: string;
  selectYourLanguage: string;
  chooseLanguageToPractice: string;
  chooseLanguage: string;
  readyToPlay: string;
  ready: string;
  notReady: string;
  allPlayersReady: string;
  gameRules: string;
  howToPlay: string;
  individualLanguageSelection: string;
  noPenalties: string;
  sameLanguageForAll: string;
  pointPenaltiesApply: string;
  twoPlayersWorkTogether: string;
  typeWordsByCategory: string;
  shareThreeLives: string;
  questionNumber: string;
  timer: string;
  seconds: string;
  leaderboard: string;
  you: string;
  currentTurn: string;
  playersAndLanguages: string;
  preparingNextChallenge: string;
  pleaseWaitForNextChallenge: string;
  waitingForChallenge: string;
  nextCooperationChallenge: string;
  category: string;
  typeWordInCategory: string;
  yourTurnTypeAnswer: string;
  waitingForPlayerToAnswer: string;
  typing: string;
  playAgain: string;
  gameFinished: string;
  finalScores: string;
  points: string;
  loadingQuestion: string;
  pleaseWaitForQuestion: string;
  waitingForQuestion: string;
  nextQuestionWillAppear: string;
  timesUp: string;
  correctAnswerWas: string;
  youSelected: string;
  wellDone: string;
  returnToHome: string;
  missingParameters: string;
  redirectingToHome: string;
  loadingRoom: string;
  pleaseWaitForRoomData: string;
  connection: string;
  settingUpRoom: string;
  role: string;
  notSet: string;
  lives: string;
  pleaseWaitForNextWordChallenge: string;
  typeWordInLanguage: string;
  submit: string;
  yourTurn: string;
  typeAnswer: string;
  pressEnter: string;
  or: string;
  clickSubmit: string;
  waitingFor: string;
  toAnswer: string;
  nextCooperationChallengeWillAppear: string;
  gameCompleted: string;
  words: string;
  thatBelongsToThisCategory: string;
  typeA: string;
  word: string;
  and: string;
  wins: string;

  // Common
  loading: string;
  error: string;
  success: string;
  cancel: string;
  confirm: string;
  back: string;
  next: string;
  close: string;
  save: string;
  edit: string;
  delete: string;
  yes: string;
  no: string;
  ok: string;

  // Time Bank
  timeBank: string;
  shareSomeTime: string;
  
  // Word Suggestions
  didYouMean: string;
  isTyping: string;
  correctlyAnswered: string;
  youTyped: string;
}

export const translations: Record<Language, LocalizedStrings> = {
  english: {
    // Home page
    title: "Language Quiz Game",
    subtitle: "Test your language skills with friends in real-time multiplayer quizzes",
    subtitleMobile: "Multiplayer language quizzes with friends",
    joinGame: "Join the Game",
    enterName: "Enter your name to create or join a quiz room",
    yourName: "Your Name",
    createNewRoom: "Create New Room",
    createRoom: "Create Room",
    roomCode: "Room code",
    joinRoom: "Join Room",
    joining: "Joining...",
    pleaseEnterName: "Please enter your name",
    pleaseEnterRoomCode: "Please enter a room code",
    pleaseWaitForConnection: "Please wait for connection to establish",
    availableRooms: "Available Rooms",
    rooms: "Rooms",
    joinExistingRooms: "Join an existing game room or create your own",
    noActiveRooms: "No active rooms",
    beFirstToCreate: "Be the first to create a room!",
    connecting: "Connecting...",
    connectionFailed: "Connection failed",
    pleaseWaitConnecting: "Please wait while we establish connection",
    pleaseRefreshPage: "Please refresh the page to try again",
    settings: "Settings",
    audio: "Audio",
    gameModes: "Game Modes:",
    practiceMode: "Practice Mode",
    practiceDescription: "60-second speed challenge, answer as many words as possible",
    competitionMode: "Competition Mode",
    competitionDescription: "Same language for all, point penalties apply",
    cooperationMode: "Cooperation Mode",
    cooperationDescription: "2 players, type words by category, share 3 lives",
    chooseGameMode: "• Choose your game mode and language",
    translateEnglishWords: "• Translate English words correctly",
    earnPoints: "• Earn points for correct answers",
    firstToReach: "• First to reach target score wins!",
    languages: "Languages:",
    connectionIssues: "Connection Issues?",
    tryRefreshing: "• Try refreshing the page",
    checkInternet: "• Check your internet connection",
    disableAdBlockers: "• Disable ad blockers if any",
    tryDifferentBrowser: "• Try a different browser",
    clearCache: "• Clear browser cache and cookies",
    errorDetails: "Error details:",

    // Question display
    translate: "Translate",
    translateToEnglish: "Translate to English",
    source: "Source",
    target: "Target",
    randomLanguage: "Random Language",
    english: "English",
    timeRemaining: "Time Remaining",
    point: "Point",

    // Room page
    waitingForPlayers: "Waiting for players...",
    startGame: "Start Game",
    restart: "Restart",
    leaveRoom: "Leave Room",
    gameMode: "Game Mode",
    targetScore: "Target Score",
    hostLanguage: "Host Language",
    selectLanguage: "Select Language",
    players: "Players",
    score: "Score",
    timeLeft: "Time Left",
    correct: "Correct!",
    incorrect: "Incorrect!",
    correctAnswer: "Correct Answer",
    yourAnswer: "Your Answer",
    nextQuestion: "Next Question",
    gameOver: "Game Over",
    winner: "Winner",
    finalScore: "Final Score",
    cooperationLives: "Lives",
    cooperationScore: "Score",
    cooperationCategory: "Category",
    cooperationTypeWord: "Type a word in this category:",
    cooperationSubmit: "Submit",
    cooperationWaiting: "Waiting for partner...",
    cooperationYourTurn: "Your turn!",
    cooperationPartnerTurn: "Partner's turn...",
    cooperationTimeout: "Time's up!",
    cooperationSuccess: "Correct! +1 point",
    cooperationFailure: "Incorrect! -1 life",
    cooperationUsedWord: "Word already used!",
    cooperationInvalidCategory: "Invalid category received. Please try again.",
    cooperationInvalidLanguage: "Invalid language selected",
    cooperationMissingAnswer: "Please enter an answer",
    cooperationInvalidChallenge: "Invalid challenge data received",

    // Lobby and game elements
    room: "Room",
    host: "Host",
    connected: "Connected",
    disconnected: "Disconnected",
    selectGameMode: "Select Game Mode",
    chooseHowToPlay: "Choose How to Play",
    gameSettings: "Game Settings",
    currentGameMode: "Current Game Mode",
    change: "Change",
    language: "Language",
    selectYourLanguage: "Select Your Language",
    chooseLanguageToPractice: "Choose Language to Practice",
    chooseLanguage: "Choose Language",
    readyToPlay: "Ready to Play",
    ready: "Ready",
    notReady: "Not Ready",
    allPlayersReady: "All players ready",
    gameRules: "Game Rules",
    howToPlay: "How to Play",
    individualLanguageSelection: "Individual Language Selection",
    noPenalties: "No Penalties",
    sameLanguageForAll: "Same Language for All",
    pointPenaltiesApply: "Point Penalties Apply",
    twoPlayersWorkTogether: "Two players work together",
    typeWordsByCategory: "Type words by category",
    shareThreeLives: "Share 3 lives",
    questionNumber: "Question Number",
    timer: "Timer",
    seconds: "Seconds",
    leaderboard: "Leaderboard",
    you: "You",
    currentTurn: "Current Turn",
    playersAndLanguages: "Players and Languages",
    preparingNextChallenge: "Preparing next challenge",
    pleaseWaitForNextChallenge: "Please wait for next challenge",
    waitingForChallenge: "Waiting for challenge",
    nextCooperationChallenge: "Next Cooperation Challenge",
    category: "Category",
    typeWordInCategory: "Type word in category",
    yourTurnTypeAnswer: "Your turn, type answer",
    waitingForPlayerToAnswer: "Waiting for player to answer",
    typing: "Typing",
    playAgain: "Play Again",
    gameFinished: "Game Finished",
    finalScores: "Final Scores",
    points: "Points",
    loadingQuestion: "Loading question",
    pleaseWaitForQuestion: "Please wait for question",
    waitingForQuestion: "Waiting for question",
    nextQuestionWillAppear: "Next question will appear",
    timesUp: "Times up",
    correctAnswerWas: "Correct answer was",
    youSelected: "You selected",
    wellDone: "Well done",
    returnToHome: "Return to Home",
    missingParameters: "Missing parameters",
    redirectingToHome: "Redirecting to Home",
    loadingRoom: "Loading room",
    pleaseWaitForRoomData: "Please wait for room data",
    connection: "Connection",
    settingUpRoom: "Setting up room",
    role: "Role",
    notSet: "Not Set",
    lives: "Lives",
    pleaseWaitForNextWordChallenge: "Please wait for next word challenge",
    typeWordInLanguage: "Type word in language",
    submit: "Submit",
    yourTurn: "Your turn",
    typeAnswer: "Type answer",
    pressEnter: "Press Enter",
    or: "or",
    clickSubmit: "Click Submit",
    waitingFor: "Waiting for",
    toAnswer: "to answer",
    nextCooperationChallengeWillAppear: "Next cooperation challenge will appear",
    gameCompleted: "Game Completed",
    words: "Words",
    thatBelongsToThisCategory: "That belongs to this category",
    typeA: "Type A",
    word: "Word",
    and: "and",
    wins: "wins",

    // Common
    loading: "Loading...",
    error: "Error",
    success: "Success",
    cancel: "Cancel",
    confirm: "Confirm",
    back: "Back",
    next: "Next",
    close: "Close",
    save: "Save",
    edit: "Edit",
    delete: "Delete",
    yes: "Yes",
    no: "No",
    ok: "OK",

    // Time Bank
    timeBank: "Time Bank",
    shareSomeTime: "Share Some Time",
    
    // Word Suggestions
    didYouMean: "Did you mean",
    isTyping: "Is typing",
    correctlyAnswered: "Correctly answered",
    youTyped: "You typed",
  },
  french: {
    // Home page
    title: "Jeu de Quiz Linguistique",
    subtitle: "Testez vos compétences linguistiques avec des amis dans des quiz multijoueurs en temps réel",
    subtitleMobile: "Quiz linguistiques multijoueurs avec des amis",
    joinGame: "Rejoindre le Jeu",
    enterName: "Entrez votre nom pour créer ou rejoindre une salle de quiz",
    yourName: "Votre Nom",
    createNewRoom: "Créer une Nouvelle Salle",
    createRoom: "Créer une Salle",
    roomCode: "Code de salle",
    joinRoom: "Rejoindre la Salle",
    joining: "Connexion...",
    pleaseEnterName: "Veuillez entrer votre nom",
    pleaseEnterRoomCode: "Veuillez entrer un code de salle",
    pleaseWaitForConnection: "Veuillez attendre que la connexion s'établisse",
    availableRooms: "Salles Disponibles",
    rooms: "Salles",
    joinExistingRooms: "Rejoignez une salle de jeu existante ou créez la vôtre",
    noActiveRooms: "Aucune salle active",
    beFirstToCreate: "Soyez le premier à créer une salle !",
    connecting: "Connexion...",
    connectionFailed: "Échec de la connexion",
    pleaseWaitConnecting: "Veuillez attendre pendant que nous établissons la connexion",
    pleaseRefreshPage: "Veuillez actualiser la page pour réessayer",
    settings: "Paramètres",
    audio: "Audio",
    gameModes: "Modes de Jeu :",
    practiceMode: "Mode Entraînement",
    practiceDescription: "Défi de vitesse de 60 secondes, répondez à autant de mots que possible",
    competitionMode: "Mode Compétition",
    competitionDescription: "Même langue pour tous, pénalités de points appliquées",
    cooperationMode: "Mode Coopération",
    cooperationDescription: "2 joueurs, tapez des mots par catégorie, partagez 3 vies",
    chooseGameMode: "• Choisissez votre mode de jeu et votre langue",
    translateEnglishWords: "• Traduisez correctement les mots anglais",
    earnPoints: "• Gagnez des points pour les bonnes réponses",
    firstToReach: "• Le premier à atteindre le score cible gagne !",
    languages: "Langues :",
    connectionIssues: "Problèmes de Connexion ?",
    tryRefreshing: "• Essayez d'actualiser la page",
    checkInternet: "• Vérifiez votre connexion internet",
    disableAdBlockers: "• Désactivez les bloqueurs de publicités si nécessaire",
    tryDifferentBrowser: "• Essayez un navigateur différent",
    clearCache: "• Effacez le cache et les cookies du navigateur",
    errorDetails: "Détails de l'erreur :",

    // Question display
    translate: "Traduire",
    translateToEnglish: "Traduire en Anglais",
    source: "Source",
    target: "Cible",
    randomLanguage: "Langue Aléatoire",
    english: "Anglais",
    timeRemaining: "Temps Restant",
    point: "Point",

    // Room page
    waitingForPlayers: "En attente des joueurs...",
    startGame: "Commencer le Jeu",
    restart: "Recommencer",
    leaveRoom: "Quitter la Salle",
    gameMode: "Mode de Jeu",
    targetScore: "Score Cible",
    hostLanguage: "Langue de l'Hôte",
    selectLanguage: "Sélectionner la Langue",
    players: "Joueurs",
    score: "Score",
    timeLeft: "Temps Restant",
    correct: "Correct !",
    incorrect: "Incorrect !",
    correctAnswer: "Bonne Réponse",
    yourAnswer: "Votre Réponse",
    nextQuestion: "Question Suivante",
    gameOver: "Fin de Partie",
    winner: "Gagnant",
    finalScore: "Score Final",
    cooperationLives: "Vies",
    cooperationScore: "Score",
    cooperationCategory: "Catégorie",
    cooperationTypeWord: "Tapez un mot dans cette catégorie :",
    cooperationSubmit: "Soumettre",
    cooperationWaiting: "En attente du partenaire...",
    cooperationYourTurn: "Votre tour !",
    cooperationPartnerTurn: "Tour du partenaire...",
    cooperationTimeout: "Temps écoulé !",
    cooperationSuccess: "Correct ! +1 point",
    cooperationFailure: "Incorrect ! -1 vie",
    cooperationUsedWord: "Mot déjà utilisé !",
    cooperationInvalidCategory: "Catégorie invalide reçue. Veuillez réessayer.",
    cooperationInvalidLanguage: "Langue sélectionnée invalide",
    cooperationMissingAnswer: "Veuillez entrer une réponse",
    cooperationInvalidChallenge: "Données de défi invalides reçues",

    // Lobby and game elements
    room: "Salle",
    host: "Hôte",
    connected: "Connecté",
    disconnected: "Déconnecté",
    selectGameMode: "Sélectionner le Mode de Jeu",
    chooseHowToPlay: "Choisir Comment Jouer",
    gameSettings: "Paramètres du Jeu",
    currentGameMode: "Mode de Jeu Actuel",
    change: "Changer",
    language: "Langue",
    selectYourLanguage: "Sélectionnez votre Langue",
    chooseLanguageToPractice: "Choisissez une Langue pour Pratiquer",
    chooseLanguage: "Choisir Langue",
    readyToPlay: "Prêt à Jouer",
    ready: "Prêt",
    notReady: "Pas Prêt",
    allPlayersReady: "Tous les joueurs sont prêts",
    gameRules: "Règles du Jeu",
    howToPlay: "Comment Jouer",
    individualLanguageSelection: "Sélection de Langue Individuelle",
    noPenalties: "Pas de Pénalités",
    sameLanguageForAll: "Même Langue pour Tous",
    pointPenaltiesApply: "Pénalités de Points Appliquées",
    twoPlayersWorkTogether: "Deux Joueurs Travaillent Ensemble",
    typeWordsByCategory: "Tapez des Mots par Catégorie",
    shareThreeLives: "Partager 3 Vies",
    questionNumber: "Numéro de Question",
    timer: "Minuteur",
    seconds: "Secondes",
    leaderboard: "Classement",
    you: "Vous",
    currentTurn: "Tour Actuel",
    playersAndLanguages: "Joueurs et Langues",
    preparingNextChallenge: "Préparation du Défi Suivant",
    pleaseWaitForNextChallenge: "Veuillez attendre le Défi Suivant",
    waitingForChallenge: "En attente du Défi",
    nextCooperationChallenge: "Défi de Coopération Suivant",
    category: "Catégorie",
    typeWordInCategory: "Tapez un Mot dans cette Catégorie",
    yourTurnTypeAnswer: "Votre Tour, Répondez",
    waitingForPlayerToAnswer: "En attente de la Réponse du Joueur",
    typing: "Écrire",
    playAgain: "Rejouer",
    gameFinished: "Partie Terminée",
    finalScores: "Scores Finaux",
    points: "Points",
    loadingQuestion: "Chargement de la Question",
    pleaseWaitForQuestion: "Veuillez attendre la Question",
    waitingForQuestion: "En attente de la Question",
    nextQuestionWillAppear: "La Question Suivante Apparaîtra",
    timesUp: "Temps Écoulé",
    correctAnswerWas: "Réponse Correcte Était",
    youSelected: "Vous avez Sélectionné",
    wellDone: "Bien Joué",
    returnToHome: "Retourner à la Maison",
    missingParameters: "Paramètres Manquants",
    redirectingToHome: "Redirection à la Maison",
    loadingRoom: "Chargement de la Salle",
    pleaseWaitForRoomData: "Veuillez attendre les Données de la Salle",
    connection: "Connexion",
    settingUpRoom: "Configuration de la Salle",
    role: "Rôle",
    notSet: "Non Défini",
    lives: "Vies",
    pleaseWaitForNextWordChallenge: "Veuillez attendre le prochain défi de mot",
    typeWordInLanguage: "Taper un mot en langue",
    submit: "Soumettre",
    yourTurn: "Votre tour",
    typeAnswer: "Répondre",
    pressEnter: "Appuyer sur Entrée",
    or: "ou",
    clickSubmit: "Cliquer pour Soumettre",
    waitingFor: "En attente de",
    toAnswer: "répondre",
    nextCooperationChallengeWillAppear: "Le prochain défi de coopération apparaîtra",
    gameCompleted: "Partie Terminée",
    words: "Mots",
    thatBelongsToThisCategory: "Ce mot appartient à cette catégorie",
    typeA: "Type A",
    word: "Mot",
    and: "et",
    wins: "gagne",

    // Common
    loading: "Chargement...",
    error: "Erreur",
    success: "Succès",
    cancel: "Annuler",
    confirm: "Confirmer",
    back: "Retour",
    next: "Suivant",
    close: "Fermer",
    save: "Sauvegarder",
    edit: "Modifier",
    delete: "Supprimer",
    yes: "Oui",
    no: "Non",
    ok: "OK",

    // Time Bank
    timeBank: "Banque de Temps",
    shareSomeTime: "Partager du Temps",
    
    // Word Suggestions
    didYouMean: "Vouliez-vous dire",
    isTyping: "Est en train de taper",
    correctlyAnswered: "Réponse correcte",
    youTyped: "Vous avez tapé",
  },
  spanish: {
    // Home page
    title: "Juego de Quiz de Idiomas",
    subtitle: "Pon a prueba tus habilidades lingüísticas con amigos en quizzes multijugador en tiempo real",
    subtitleMobile: "Quizzes de idiomas multijugador con amigos",
    joinGame: "Unirse al Juego",
    enterName: "Ingresa tu nombre para crear o unirte a una sala de quiz",
    yourName: "Tu Nombre",
    createNewRoom: "Crear Nueva Sala",
    createRoom: "Crear Sala",
    roomCode: "Código de sala",
    joinRoom: "Unirse a la Sala",
    joining: "Uniéndose...",
    pleaseEnterName: "Por favor ingresa tu nombre",
    pleaseEnterRoomCode: "Por favor ingresa un código de sala",
    pleaseWaitForConnection: "Por favor espera a que se establezca la conexión",
    availableRooms: "Salas Disponibles",
    rooms: "Salas",
    joinExistingRooms: "Únete a una sala de juego existente o crea la tuya",
    noActiveRooms: "No hay salas activas",
    beFirstToCreate: "¡Sé el primero en crear una sala!",
    connecting: "Conectando...",
    connectionFailed: "Error de conexión",
    pleaseWaitConnecting: "Por favor espera mientras establecemos la conexión",
    pleaseRefreshPage: "Por favor actualiza la página para intentar de nuevo",
    settings: "Configuración",
    audio: "Audio",
    gameModes: "Modos de Juego:",
    practiceMode: "Modo Práctica",
    practiceDescription: "Desafío de velocidad de 60 segundos, responde tantas palabras como puedas",
    competitionMode: "Modo Competición",
    competitionDescription: "Mismo idioma para todos, se aplican penalizaciones de puntos",
    cooperationMode: "Modo Cooperación",
    cooperationDescription: "2 jugadores, escribe palabras por categoría, comparten 3 vidas",
    chooseGameMode: "• Elige tu modo de juego e idioma",
    translateEnglishWords: "• Traduce correctamente las palabras en inglés",
    earnPoints: "• Gana puntos por respuestas correctas",
    firstToReach: "• ¡El primero en alcanzar la puntuación objetivo gana!",
    languages: "Idiomas:",
    connectionIssues: "¿Problemas de Conexión?",
    tryRefreshing: "• Intenta actualizar la página",
    checkInternet: "• Verifica tu conexión a internet",
    disableAdBlockers: "• Desactiva los bloqueadores de anuncios si los hay",
    tryDifferentBrowser: "• Prueba un navegador diferente",
    clearCache: "• Limpia el caché y las cookies del navegador",
    errorDetails: "Detalles del error:",

    // Question display
    translate: "Traducir",
    translateToEnglish: "Traducir al Inglés",
    source: "Fuente",
    target: "Objetivo",
    randomLanguage: "Idioma Aleatorio",
    english: "Inglés",
    timeRemaining: "Tiempo Restante",
    point: "Punto",

    // Room page
    waitingForPlayers: "Esperando jugadores...",
    startGame: "Comenzar Juego",
    restart: "Reiniciar",
    leaveRoom: "Salir de la Sala",
    gameMode: "Modo de Juego",
    targetScore: "Puntuación Objetivo",
    hostLanguage: "Idioma del Anfitrión",
    selectLanguage: "Seleccionar Idioma",
    players: "Jugadores",
    score: "Puntuación",
    timeLeft: "Tiempo Restante",
    correct: "¡Correcto!",
    incorrect: "¡Incorrecto!",
    correctAnswer: "Respuesta Correcta",
    yourAnswer: "Tu Respuesta",
    nextQuestion: "Siguiente Pregunta",
    gameOver: "Fin del Juego",
    winner: "Ganador",
    finalScore: "Puntuación Final",
    cooperationLives: "Vidas",
    cooperationScore: "Puntuación",
    cooperationCategory: "Categoría",
    cooperationTypeWord: "Escribe una palabra en esta categoría:",
    cooperationSubmit: "Enviar",
    cooperationWaiting: "Esperando al compañero...",
    cooperationYourTurn: "¡Tu turno!",
    cooperationPartnerTurn: "Turno del compañero...",
    cooperationTimeout: "¡Se acabó el tiempo!",
    cooperationSuccess: "¡Correcto! +1 punto",
    cooperationFailure: "¡Incorrecto! -1 vida",
    cooperationUsedWord: "¡Palabra ya utilizada!",
    cooperationInvalidCategory: "Categoría inválida recibida. Por favor intenta de nuevo.",
    cooperationInvalidLanguage: "Idioma seleccionado inválido",
    cooperationMissingAnswer: "Por favor ingresa una respuesta",
    cooperationInvalidChallenge: "Datos de desafío inválidos recibidos",

    // Lobby and game elements
    room: "Sala",
    host: "Anfitrión",
    connected: "Conectado",
    disconnected: "Desconectado",
    selectGameMode: "Seleccionar Modo de Juego",
    chooseHowToPlay: "Elegir Cómo Jugar",
    gameSettings: "Configuración del Juego",
    currentGameMode: "Modo de Juego Actual",
    change: "Cambiar",
    language: "Idioma",
    selectYourLanguage: "Selecciona tu Idioma",
    chooseLanguageToPractice: "Elige un Idioma para Practicar",
    chooseLanguage: "Elegir Idioma",
    readyToPlay: "Listo para Jugar",
    ready: "Listo",
    notReady: "No Listo",
    allPlayersReady: "Todos los jugadores están listos",
    gameRules: "Reglas del Juego",
    howToPlay: "Cómo Jugar",
    individualLanguageSelection: "Selección Individual de Idioma",
    noPenalties: "Sin Penalizaciones",
    sameLanguageForAll: "Mismo Idioma para Todos",
    pointPenaltiesApply: "Se Aplican Penalizaciones de Puntos",
    twoPlayersWorkTogether: "Dos Jugadores Trabajan Juntos",
    typeWordsByCategory: "Escribe Palabras por Categoría",
    shareThreeLives: "Compartir 3 Vidas",
    questionNumber: "Número de Pregunta",
    timer: "Cronómetro",
    seconds: "Segundos",
    leaderboard: "Clasificación",
    you: "Tú",
    currentTurn: "Turno Actual",
    playersAndLanguages: "Jugadores y Idiomas",
    preparingNextChallenge: "Preparando Desafío Siguiente",
    pleaseWaitForNextChallenge: "Por favor espera el Desafío Siguiente",
    waitingForChallenge: "En espera del Desafío",
    nextCooperationChallenge: "Desafío de Cooperación Siguiente",
    category: "Categoría",
    typeWordInCategory: "Escribe una Palabra en Esta Categoría",
    yourTurnTypeAnswer: "Tu Turno, Responde",
    waitingForPlayerToAnswer: "En espera de la Respuesta del Jugador",
    typing: "Escribir",
    playAgain: "Jugar de Nuevo",
    gameFinished: "Juego Terminado",
    finalScores: "Puntuaciones Finales",
    points: "Puntos",
    loadingQuestion: "Cargando Pregunta",
    pleaseWaitForQuestion: "Por favor espera la Pregunta",
    waitingForQuestion: "En espera de la Pregunta",
    nextQuestionWillAppear: "La Pregunta Siguiente Aparecerá",
    timesUp: "Se Acabó el Tiempo",
    correctAnswerWas: "Respuesta Correcta Era",
    youSelected: "Tú Seleccionaste",
    wellDone: "Bien Hecho",
    returnToHome: "Regresar a Casa",
    missingParameters: "Parámetros Faltantes",
    redirectingToHome: "Redirigiendo a Casa",
    loadingRoom: "Cargando Sala",
    pleaseWaitForRoomData: "Por favor espera los Datos de la Sala",
    connection: "Conexión",
    settingUpRoom: "Configurando Sala",
    role: "Rol",
    notSet: "No Establecido",
    lives: "Vidas",
    pleaseWaitForNextWordChallenge: "Por favor espera el próximo desafío de palabra",
    typeWordInLanguage: "Escribir una palabra en idioma",
    submit: "Enviar",
    yourTurn: "Tu turno",
    typeAnswer: "Responder",
    pressEnter: "Presionar Enter",
    or: "o",
    clickSubmit: "Hacer clic para enviar",
    waitingFor: "Esperando",
    toAnswer: "responder",
    nextCooperationChallengeWillAppear: "El próximo desafío de cooperación aparecerá",
    gameCompleted: "Partie Terminée",
    words: "Palabras",
    thatBelongsToThisCategory: "Esta palabra pertenece a esta categoría",
    typeA: "Tipo A",
    word: "Palabra",
    and: "y",
    wins: "gana",

    // Common
    loading: "Cargando...",
    error: "Error",
    success: "Éxito",
    cancel: "Cancelar",
    confirm: "Confirmar",
    back: "Atrás",
    next: "Siguiente",
    close: "Cerrar",
    save: "Guardar",
    edit: "Editar",
    delete: "Eliminar",
    yes: "Sí",
    no: "No",
    ok: "OK",

    // Time Bank
    timeBank: "Banco de Tiempo",
    shareSomeTime: "Compartir Tiempo",
    
    // Word Suggestions
    didYouMean: "¿Querías decir",
    isTyping: "Está escribiendo",
    correctlyAnswered: "Respuesta correcta",
    youTyped: "Escribiste",
  },
};

export function getLocalizedString(language: Language, key: keyof LocalizedStrings): string {
  return translations[language]?.[key] || translations.english[key] || key;
}

export function getLocalizedStrings(language: Language): LocalizedStrings {
  return translations[language] || translations.english;
} 