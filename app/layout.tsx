import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { createContext, useContext, useState } from "react"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "idk how to call this",
  description: "a steak?",
}

// Context for background and pulse overlay
export const BgPulseContext = createContext({
  setBg: (_bg: string) => {},
  triggerPulse: (_color: "green" | "red") => {},
})

export function useBgPulse() {
  return useContext(BgPulseContext)
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [bg, setBg] = useState<string>("bg-gradient-to-br from-white via-blue-50 to-white")
  const [pulse, setPulse] = useState<null | "green" | "red" | "">(null)

  // Pulse effect handler
  const triggerPulse = (color: "green" | "red") => {
    setPulse(color)
    setTimeout(() => setPulse(null), 600)
  }

  return (
    <html lang="en">
      <body className={inter.className + " relative min-h-screen overflow-x-hidden"}>
        <BgPulseContext.Provider value={{ setBg, triggerPulse }}>
          {/* Global background gradient */}
          <div className={`fixed inset-0 -z-10 transition-all duration-700 ease-in-out ${bg}`}></div>
          {/* Pulse overlay */}
          {pulse && (
            <div
              className={`fixed inset-0 -z-10 animate-fade-pulse pointer-events-none transition-all duration-500 ${
                pulse === "green"
                  ? "bg-green-300/40"
                  : pulse === "red"
                  ? "bg-red-300/40"
                  : ""
              }`}
              style={{ mixBlendMode: "lighten" }}
            />
          )}
          {children}
        </BgPulseContext.Provider>
      </body>
    </html>
  )
}
