"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import LevelUpModal from "./LevelUpModal";

interface Stats {
  xp: number;
  level: number;
  progress: number;
  currentStreak: number;
}

interface GamificationDetail {
  leveledUp?: boolean;
  newLevel?: number;
}

export function UserStatsDisplay() {
  const { status } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState(1);

  // Xóa stats khi logout
  useEffect(() => {
    if (status === "unauthenticated") {
      setStats(null);
    }
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;

    // Initial fetch
    fetchStats();

    // Listen for custom event from Study/Quiz pages when XP is gained
    const handleGamificationUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<GamificationDetail>;
      if (customEvent.detail) {
        const { leveledUp, newLevel } = customEvent.detail;
        if (leveledUp && newLevel) {
          setNewLevel(newLevel);
          setShowLevelUp(true);
        }
        
        // Fetch fresh stats to ensure sync, or update from event if provided
        fetchStats();
      }
    };

    window.addEventListener("gamificationUpdate", handleGamificationUpdate);
    return () => window.removeEventListener("gamificationUpdate", handleGamificationUpdate);
  }, [status]);

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/user/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // silent fail
    }
  };

  if (!stats) return null;

  return (
    <>
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Streak */}
        <div 
          className="flex items-center gap-1.5 bg-amber-50/90 text-amber-700 px-2.5 py-1 rounded-full text-xs sm:text-sm font-bold border border-amber-200/80 shadow-xs" 
          title={`Chuỗi học tập: ${stats.currentStreak} ngày liên tiếp`}
        >
          <span className="text-sm">🔥</span>
          <span>{stats.currentStreak}</span>
        </div>
        
        {/* Level & XP */}
        <div 
          className="flex items-center gap-2 bg-slate-100/90 px-2.5 py-1 rounded-full border border-slate-200/80 shadow-xs" 
          title={`Cấp độ ${stats.level} (XP: ${stats.xp})`}
        >
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center text-[10px] font-black shadow-xs">
            {stats.level}
          </div>
          <div className="hidden sm:block w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-indigo-600 to-purple-600 h-1.5 rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${stats.progress}%` }}
            />
          </div>
        </div>
      </div>

      <LevelUpModal 
        isOpen={showLevelUp} 
        level={newLevel} 
        onClose={() => setShowLevelUp(false)} 
      />
    </>
  );
}
