"use client"

import { memo, useEffect, useLayoutEffect, useState, useRef } from "react"
import {
  motion,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion"
import Link from "next/link"
import type { Team } from "@/types"
import { ClubEmblem } from "@/components/club-emblem"

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

// 팀 색상 팔레트 (index 기반 순환)
const TEAM_COLORS = [
  { bg: "rgba(0,200,83,0.15)",   border: "rgba(0,200,83,0.4)",   text: "#00C853" },
  { bg: "rgba(79,195,247,0.15)", border: "rgba(79,195,247,0.4)", text: "#4FC3F7" },
  { bg: "rgba(255,215,0,0.15)",  border: "rgba(255,215,0,0.4)",  text: "#FFD700" },
  { bg: "rgba(255,107,107,0.15)",border: "rgba(255,107,107,0.4)",text: "#FF6B6B" },
  { bg: "rgba(180,0,255,0.15)",  border: "rgba(180,0,255,0.4)",  text: "#CE93D8" },
  { bg: "rgba(255,152,0,0.15)",  border: "rgba(255,152,0,0.4)",  text: "#FFA726" },
  { bg: "rgba(0,200,83,0.15)",   border: "rgba(0,200,83,0.4)",   text: "#69F0AE" },
  { bg: "rgba(33,150,243,0.15)", border: "rgba(33,150,243,0.4)", text: "#42A5F5" },
  { bg: "rgba(255,64,129,0.15)", border: "rgba(255,64,129,0.4)", text: "#FF80AB" },
  { bg: "rgba(0,230,118,0.15)",  border: "rgba(0,230,118,0.4)",  text: "#00E676" },
]

function TeamLogoItem({
  team,
  colorIndex = 0,
  onTeamSelect,
  selected,
}: {
  team: Team
  colorIndex?: number
  onTeamSelect?: (team: Team) => void
  selected?: boolean
}) {
  const [hover, setHover] = useState(false)
  const color = TEAM_COLORS[colorIndex % TEAM_COLORS.length]
  const isHighlighted = hover || selected

  const inner = (
    <div
      className="flex flex-col items-center gap-3 cursor-pointer select-none"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onTeamSelect ? () => onTeamSelect(team) : undefined}
    >
      {/* Logo circle */}
      <div
        className="rounded-2xl overflow-hidden flex items-center justify-center transition-all duration-300"
        style={{
          width: 120,
          height: 120,
          background: isHighlighted ? color.bg : "rgba(255,255,255,0.06)",
          border: `2px solid ${isHighlighted ? color.border : "rgba(255,255,255,0.12)"}`,
          boxShadow: isHighlighted
            ? `0 0 28px ${color.bg}, 0 0 0 3px ${color.border}`
            : "0 4px 20px rgba(0,0,0,0.3)",
        }}
      >
        <ClubEmblem name={team.name} logoSrc={team.logo} index={colorIndex} className="h-full w-full p-3" />
      </div>

      {/* Team name */}
      <span
        className="text-center text-xs font-semibold leading-tight max-w-[120px] transition-colors duration-300"
        style={{ color: isHighlighted ? color.text : "#627D98" }}
      >
        {team.name}
      </span>
    </div>
  )

  if (onTeamSelect) return inner
  return <Link href={`/teams/${team.id}`}>{inner}</Link>
}

const Cylinder = memo(
  ({
    teams,
    rotation,
    onTeamSelect,
    selectedTeamId,
  }: {
    teams: Team[]
    rotation: ReturnType<typeof useMotionValue<number>>
    onTeamSelect?: (team: Team) => void
    selectedTeamId?: string
  }) => {
    const isSmall = useMediaQuery("(max-width: 640px)")
    const cylinderWidth = isSmall ? 1200 : 2000
    const faceCount = teams.length
    const faceWidth = cylinderWidth / faceCount
    const radius = cylinderWidth / (2 * Math.PI)
    const transform = useTransform(
      rotation,
      (value) => `rotate3d(0, 1, 0, ${value}deg)`
    )

    return (
      <div
        className="flex h-full items-center justify-center"
        style={{
          perspective: "1200px",
          transformStyle: "preserve-3d",
          willChange: "transform",
        }}
      >
        <motion.div
          className="relative flex h-full origin-center justify-center"
          style={{
            transform,
            rotateY: rotation,
            width: cylinderWidth,
            transformStyle: "preserve-3d",
          }}
        >
          {teams.map((team, i) => (
            <div
              key={`${team.id}-${i}`}
              className="absolute flex h-full origin-center items-center justify-center"
              style={{
                width: `${faceWidth}px`,
                transform: `rotateY(${i * (360 / faceCount)}deg) translateZ(${radius}px)`,
              }}
            >
              <TeamLogoItem
                team={team}
                colorIndex={i}
                onTeamSelect={onTeamSelect}
                selected={selectedTeamId === team.id}
              />
            </div>
          ))}
        </motion.div>
      </div>
    )
  }
)
Cylinder.displayName = "Cylinder"

export function TeamLogoCarousel({
  teams,
  onTeamSelect,
  selectedTeamId,
}: {
  teams: Team[]
  onTeamSelect?: (team: Team) => void
  selectedTeamId?: string
}) {
  const rotation = useMotionValue(0)
  const [paused, setPaused] = useState(false)
  const animRef = useRef<ReturnType<typeof animate> | null>(null)

  // Pad teams to at least 6 for a good cylinder
  const paddedTeams: Team[] = []
  if (teams.length > 0) {
    while (paddedTeams.length < Math.max(6, teams.length)) {
      paddedTeams.push(...teams)
    }
  }
  const displayTeams = paddedTeams.slice(0, Math.max(6, teams.length))

  const startSpin = () => {
    if (animRef.current) animRef.current.stop()
    animRef.current = animate(rotation, rotation.get() + 3600, {
      duration: 120,
      ease: "linear",
      repeat: Infinity,
    })
  }

  const stopSpin = () => {
    animRef.current?.stop()
  }

  useEffect(() => {
    startSpin()
    return () => animRef.current?.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams.length])

  useEffect(() => {
    if (paused) {
      stopSpin()
    } else {
      startSpin()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused])

  if (displayTeams.length === 0) return (
    <div className="flex items-center justify-center h-[240px]">
      <p className="text-sm" style={{ color: "#334E68" }}>등록된 팀이 없습니다</p>
    </div>
  )

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Fade edges */}
      <div
        className="absolute inset-y-0 left-0 z-10 w-24 pointer-events-none"
        style={{ background: "linear-gradient(to right, #0D1B2A, transparent)" }}
      />
      <div
        className="absolute inset-y-0 right-0 z-10 w-24 pointer-events-none"
        style={{ background: "linear-gradient(to left, #0D1B2A, transparent)" }}
      />

      <div className="h-[240px] w-full overflow-hidden">
        <Cylinder
          teams={displayTeams}
          rotation={rotation}
          onTeamSelect={onTeamSelect}
          selectedTeamId={selectedTeamId}
        />
      </div>

      {/* Hint */}
      <p
        className="text-center text-xs mt-2"
        style={{ color: "#334E68", fontFamily: "var(--font-space-mono)" }}
      >
        {onTeamSelect
          ? (paused ? "CLICK TEAM TO VIEW PLAYERS · HOVER TO PAUSE" : "AUTO ROTATING · HOVER TO PAUSE · CLICK TO SELECT")
          : (paused ? "HOVER TO PAUSE · CLICK TO VISIT" : "AUTO ROTATING · HOVER TO PAUSE")}
      </p>
    </div>
  )
}
