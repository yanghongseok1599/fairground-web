"use client"

import { memo, useEffect, useLayoutEffect, useMemo, useState } from "react"
import {
  AnimatePresence,
  motion,
  useAnimation,
  useMotionValue,
  useTransform,
} from "framer-motion"
import Link from "next/link"
import { PlayerCard } from "@/components/player-card"
import type { Player } from "@/types"

// SSR-safe layout effect
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)
  useIsomorphicLayoutEffect(() => {
    const mm = window.matchMedia(query)
    setMatches(mm.matches)
    const handler = () => setMatches(mm.matches)
    mm.addEventListener("change", handler)
    return () => mm.removeEventListener("change", handler)
  }, [query])
  return matches
}

const duration = 0.15
const transition = { duration, ease: "easeOut" as const }
const transitionOverlay = { duration: 0.5, ease: "easeInOut" as const }

const Carousel = memo(
  ({
    handleClick,
    controls,
    players,
    isCarouselActive,
  }: {
    handleClick: (player: Player, index: number) => void
    controls: ReturnType<typeof useAnimation>
    players: Player[]
    isCarouselActive: boolean
  }) => {
    const isSmall = useMediaQuery("(max-width: 640px)")
    const cylinderWidth = isSmall ? 1100 : 1800
    const faceCount = players.length
    const faceWidth = cylinderWidth / faceCount
    const radius = cylinderWidth / (2 * Math.PI)
    const rotation = useMotionValue(0)
    const transform = useTransform(
      rotation,
      (value) => `rotate3d(0, 1, 0, ${value}deg)`
    )

    return (
      <div
        className="flex h-full items-center justify-center"
        style={{
          perspective: "1000px",
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
      >
        <motion.div
          drag={isCarouselActive ? "x" : false}
          className="relative flex h-full origin-center cursor-grab justify-center active:cursor-grabbing"
          style={{
            transform,
            rotateY: rotation,
            width: cylinderWidth,
            transformStyle: "preserve-3d",
          }}
          onDrag={(_, info) =>
            isCarouselActive &&
            rotation.set(rotation.get() + info.offset.x * 0.05)
          }
          onDragEnd={(_, info) =>
            isCarouselActive &&
            controls.start({
              rotateY: rotation.get() + info.velocity.x * 0.05,
              transition: {
                type: "spring",
                stiffness: 100,
                damping: 30,
                mass: 0.1,
              },
            })
          }
          animate={controls}
        >
          {players.map((player, i) => (
            <motion.div
              key={`${player.id}-${i}`}
              className="absolute flex h-full origin-center items-center justify-center rounded-xl p-2"
              style={{
                width: `${faceWidth}px`,
                transform: `rotateY(${i * (360 / faceCount)}deg) translateZ(${radius}px)`,
              }}
              onClick={() => handleClick(player, i)}
            >
              <motion.div
                initial={{ filter: "blur(4px)" }}
                animate={{ filter: "blur(0px)" }}
                transition={transition}
                className="pointer-events-none"
              >
                <PlayerCard player={player} size="sm" />
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    )
  }
)
Carousel.displayName = "Carousel"

export function PlayerCardCarousel({ players }: { players: Player[] }) {
  const [activePlayer, setActivePlayer] = useState<Player | null>(null)
  const [isCarouselActive, setIsCarouselActive] = useState(true)
  const controls = useAnimation()

  // Pad to at least 6 items for a good cylinder effect
  const paddedPlayers = useMemo(() => {
    if (players.length === 0) return []
    if (players.length >= 6) return players
    // repeat to fill
    const result: Player[] = []
    while (result.length < 6) result.push(...players)
    return result.slice(0, Math.max(6, players.length))
  }, [players])

  const handleClick = (player: Player) => {
    setActivePlayer(player)
    setIsCarouselActive(false)
    controls.stop()
  }

  const handleClose = () => {
    setActivePlayer(null)
    setIsCarouselActive(true)
  }

  if (paddedPlayers.length === 0) return null

  return (
    <motion.div layout className="relative w-full">
      <AnimatePresence mode="sync">
        {activePlayer && (
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
            transition={transitionOverlay}
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="flex flex-col items-center gap-4"
            >
              <PlayerCard player={activePlayer} size="lg" />
              <Link
                href={`/players/${activePlayer.id}`}
                className="px-6 py-2.5 rounded-full text-sm font-semibold transition-all"
                style={{ background: "#00C853", color: "#0D1B2A" }}
                onClick={handleClose}
              >
                선수 프로필 보기 →
              </Link>
              <button
                onClick={handleClose}
                className="text-xs mt-1 opacity-50 hover:opacity-100 transition-opacity"
                style={{ color: "#D9E2EC" }}
              >
                닫기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative h-[460px] w-full overflow-hidden">
        <Carousel
          handleClick={handleClick}
          controls={controls}
          players={paddedPlayers}
          isCarouselActive={isCarouselActive}
        />
      </div>
    </motion.div>
  )
}
