import { NextApiRequest, NextApiResponse } from "next"

// Helper to load a language's word list from JSON (dynamic import for serverless compatibility)
async function loadWords(language: string) {
  const fileMap: Record<string, string> = {
    english: "words-english.json",
    french: "words-french.json",
    german: "words-german.json",
    japanese: "words-japanese.json",
    spanish: "words-spanish.json",
    russian: "words-russian.json",
  };
  const file = fileMap[language];
  if (!file) return [];
  // Dynamically import fs and path only on server
  const fs = await import("fs");
  const path = await import("path");
  const filePath = path.join(process.cwd(), "lib/databases", file);
  const data = fs.readFileSync(filePath, "utf-8");
  const json = JSON.parse(data);
  return json.words;
}

// Load all word lists and merge by English word
async function buildUnifiedDatabase() {
  const [englishWords, frenchWords, germanWords, japaneseWords, spanishWords, russianWords] = await Promise.all([
    loadWords("english"),
    loadWords("french"),
    loadWords("german"),
    loadWords("japanese"),
    loadWords("spanish"),
    loadWords("russian"),
  ]);
  // Map by English word for merging
  const map: Record<string, any> = {};
  for (const w of englishWords) {
    map[w.englishWord] = { english: w.englishWord };
  }
  for (const w of frenchWords) {
    if (!map[w.englishWord]) map[w.englishWord] = { english: w.englishWord };
    map[w.englishWord].french = w.targetWord;
  }
  for (const w of germanWords) {
    if (!map[w.englishWord]) map[w.englishWord] = { english: w.englishWord };
    map[w.englishWord].german = w.targetWord;
  }
  for (const w of japaneseWords) {
    if (!map[w.englishWord]) map[w.englishWord] = { english: w.englishWord };
    map[w.englishWord].japanese = w.targetWord;
  }
  for (const w of spanishWords) {
    if (!map[w.englishWord]) map[w.englishWord] = { english: w.englishWord };
    map[w.englishWord].spanish = w.targetWord;
  }
  for (const w of russianWords) {
    if (!map[w.englishWord]) map[w.englishWord] = { english: w.englishWord };
    map[w.englishWord].russian = w.targetWord;
  }
  return Object.values(map);
}

// Simple Romaji conversion (for demo; use a library for production)
function toRomaji(kana: string): string {
  // This is a placeholder. For real use, integrate 'wanakana' or similar.
  // Here, just return the kana for now.
  return kana;
}

let questionCounter = 0;

interface Question {
  questionId: string;
  english: string;
  correctAnswer: string;
  options: { value: string; romaji?: string }[];
}

function getRandomInt(max: number) {
  return Math.floor(Math.random() * max);
}

function shuffle<T>(array: T[]): T[] {
  return array.sort(() => Math.random() - 0.5);
}

async function generateQuestion(
  db: any[],
  sourceLanguage: "english" | "french" | "german" | "japanese" | "spanish" | "russian",
  targetLanguage: "english" | "french" | "german" | "japanese" | "spanish" | "russian"
): Promise<Question> {
  // Select random word
  const randomWord = db[getRandomInt(db.length)];
  const sourceWord = randomWord[sourceLanguage];
  const correctAnswer = randomWord[targetLanguage];
  if (!sourceWord || !correctAnswer) throw new Error("No translation found");
  // Generate wrong answers
  const wrongAnswers: { value: string; romaji?: string }[] = [];
  let attempts = 0;
  const maxAttempts = 50;
  while (wrongAnswers.length < 3 && attempts < maxAttempts) {
    attempts++;
    const randomWrongWord = db[getRandomInt(db.length)];
    const wrong = randomWrongWord[targetLanguage];
    if (
      wrong &&
      wrong !== correctAnswer &&
      !wrongAnswers.some((a) => a.value === wrong)
    ) {
      wrongAnswers.push({
        value: wrong,
        romaji: targetLanguage === "japanese" ? toRomaji(wrong) : undefined,
      });
    }
  }
  if (wrongAnswers.length < 3) throw new Error("Not enough wrong answers");
  // Prepare options (with Romaji for Japanese)
  const options = shuffle([
    {
      value: correctAnswer,
      romaji: targetLanguage === "japanese" ? toRomaji(correctAnswer) : undefined,
    },
    ...wrongAnswers,
  ]);
  return {
    questionId: `q-api-${sourceLanguage}-to-${targetLanguage}-${questionCounter++}-${Date.now()}`,
    english: sourceWord,
    correctAnswer,
    options,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { sourceLanguage, targetLanguage } = req.body;
    if (!sourceLanguage || !targetLanguage) {
      return res.status(400).json({ error: "Source language and target language are required" });
    }
    if (!["english", "french", "german", "japanese", "spanish", "russian"].includes(sourceLanguage) ||
        !["english", "french", "german", "japanese", "spanish", "russian"].includes(targetLanguage)) {
      return res.status(400).json({ error: "Invalid language" });
    }
    const db = await buildUnifiedDatabase();
    const question = await generateQuestion(db, sourceLanguage, targetLanguage);
    res.status(200).json({ success: true, question });
  } catch (error: any) {
    console.error("Error generating question:", error);
    res.status(500).json({ error: "Failed to generate question", message: error.message });
  }
}
// For type support in Node.js, install @types/node as a dev dependency if needed.