/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Waves, Cloud, Rocket, Trophy, RefreshCcw } from 'lucide-react';

// --- Constants & Types ---

const MAX_DISTANCE = 10000;
const THRUST_STRENGTH = 6;
const GRAVITY = 0.15;
const MAX_VELOCITY = 15;
const PARTICLE_COUNT = 40;

type Stage = 'POOL' | 'OCEAN' | 'SKY' | 'SPACE';

interface GameState {
  distance: number;
  velocity: number;
  playerY: number;
  particles: Particle[];
  isGameOver: boolean;
  stage: Stage;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
}

// --- Helper Functions ---

const getStage = (distance: number): Stage => {
  const ratio = distance / MAX_DISTANCE;
  if (ratio < 0.25) return 'POOL';
  if (ratio < 0.5) return 'OCEAN';
  if (ratio < 0.75) return 'SKY';
  return 'SPACE';
};

const getStageColors = (stage: Stage) => {
  switch (stage) {
    case 'POOL': return { bg: '#2dd4bf', particle: 'rgba(255, 255, 255, 0.4)', text: 'Poolside' };
    case 'OCEAN': return { bg: '#0369a1', particle: 'rgba(255, 255, 255, 0.3)', text: 'Deep Ocean' };
    case 'SKY': return { bg: '#bae6fd', particle: 'rgba(255, 255, 255, 0.8)', text: 'Cloud Nine' };
    case 'SPACE': return { bg: '#020617', particle: 'rgba(255, 255, 255, 1)', text: 'Final Frontier' };
  }
};

// --- Main Component ---

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState>({
    distance: 0,
    velocity: 0,
    playerY: 0,
    particles: [],
    isGameOver: false,
    stage: 'POOL',
  });

  // Internal physics ref to avoid per-frame React state overhead
  const physicsRef = useRef({
    distance: 0,
    velocity: 0,
    playerY: 0,
    particles: [] as Particle[],
    width: 0,
    height: 0,
  });

  const [uiStage, setUiStage] = useState<Stage>('POOL');
  const [distanceRatio, setDistanceRatio] = useState(0);

  // Smooth color transition refs
  const currentBgColor = useRef({ r: 45, g: 212, b: 191 }); // Start at pool color

  // Initialize particles
  const initParticles = (w: number, h: number) => {
    return Array.from({ length: PARTICLE_COUNT }).map(() => ({
      x: Math.random() * w,
      y: Math.random() * h,
      size: Math.random() * 3 + 1,
      speed: Math.random() * 2 + 1,
      opacity: Math.random() * 0.5 + 0.3,
    }));
  };

  const resetGame = useCallback(() => {
    physicsRef.current.distance = 0;
    physicsRef.current.velocity = 0;
    physicsRef.current.playerY = physicsRef.current.height * 0.7;
    physicsRef.current.particles = initParticles(physicsRef.current.width, physicsRef.current.height);
    currentBgColor.current = { r: 45, g: 212, b: 191 };
    setGameState(prev => ({ ...prev, isGameOver: false, distance: 0 }));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false }); // Performance optimization
    if (!ctx) return;

    let animationId: number;

    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    };

    const handleResize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
        physicsRef.current.width = width;
        physicsRef.current.height = height;
        physicsRef.current.playerY = height * 0.7;
        physicsRef.current.particles = initParticles(width, height);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const update = () => {
      const { width, height } = physicsRef.current;

      // Finish condition
      if (physicsRef.current.distance >= MAX_DISTANCE) {
        setGameState(prev => ({ ...prev, isGameOver: true }));
        return;
      }

      // Physics
      physicsRef.current.velocity += GRAVITY;
      physicsRef.current.distance += Math.max(0, -physicsRef.current.velocity * 0.8);
      physicsRef.current.playerY += physicsRef.current.velocity;

      // Boundaries
      const minY = height * 0.2;
      const maxY = height * 0.8;
      if (physicsRef.current.playerY > maxY) {
        physicsRef.current.playerY = maxY;
        physicsRef.current.velocity = 0;
      }
      if (physicsRef.current.playerY < minY) {
        physicsRef.current.playerY = minY;
      }

      // Particle update
      physicsRef.current.particles.forEach(p => {
        p.y += p.speed + (physicsRef.current.velocity * -0.3);
        if (p.y > height) {
          p.y = -10;
          p.x = Math.random() * width;
        } else if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
      });

      // Sync state for UI (less frequent than 60fps)
      const currentStage = getStage(physicsRef.current.distance);
      setUiStage(currentStage);
      setDistanceRatio(physicsRef.current.distance / MAX_DISTANCE);

      // Rendering
      const stageConfig = getStageColors(currentStage);
      const targetColor = hexToRgb(stageConfig.bg);
      
      // Interpolate background color
      currentBgColor.current.r += (targetColor.r - currentBgColor.current.r) * 0.05;
      currentBgColor.current.g += (targetColor.g - currentBgColor.current.g) * 0.05;
      currentBgColor.current.b += (targetColor.b - currentBgColor.current.b) * 0.05;

      const bgColorString = `rgb(${Math.round(currentBgColor.current.r)}, ${Math.round(currentBgColor.current.g)}, ${Math.round(currentBgColor.current.b)})`;
      
      // Draw background
      ctx.fillStyle = bgColorString;
      ctx.fillRect(0, 0, width, height);

      // Draw Atmospheric Gradients (Juice)
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, 'rgba(0,0,0,0.15)');
      gradient.addColorStop(0.5, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.05)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Draw particles
      ctx.fillStyle = stageConfig.particle;
      physicsRef.current.particles.forEach(p => {
        ctx.globalAlpha = p.opacity;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // Draw Player (Swimmer/Astronaut)
      ctx.save();
      ctx.translate(width / 2, physicsRef.current.playerY);
      
      // Tilt based on velocity
      const tilt = Math.max(-0.4, Math.min(0.4, physicsRef.current.velocity * 0.05));
      ctx.rotate(tilt);

      // Simple but expressive character body
      ctx.fillStyle = '#f87171';
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Head
      ctx.fillStyle = '#fee2e2';
      ctx.beginPath();
      ctx.arc(0, -20, 10, 0, Math.PI * 2);
      ctx.fill();

      // Goggles/Visor
      ctx.fillStyle = currentStage === 'SPACE' ? '#67e8f9' : '#1e293b';
      ctx.fillRect(-6, -22, 12, 4);

      // Arms (Swimming animation)
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      const armWave = Math.sin(Date.now() * 0.015) * 12;
      ctx.beginPath();
      ctx.moveTo(-16, -2);
      ctx.lineTo(-24, armWave);
      ctx.moveTo(16, -2);
      ctx.lineTo(24, -armWave);
      ctx.stroke();

      ctx.restore();

      animationId = requestAnimationFrame(update);
    };

    animationId = requestAnimationFrame(update);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  const handleInput = useCallback(() => {
    if (gameState.isGameOver) return;
    physicsRef.current.velocity -= THRUST_STRENGTH;
    if (physicsRef.current.velocity < -MAX_VELOCITY) {
      physicsRef.current.velocity = -MAX_VELOCITY;
    }
  }, [gameState.isGameOver]);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-screen overflow-hidden bg-black font-sans select-none touch-none"
      onMouseDown={handleInput}
      onTouchStart={(e) => {
        e.preventDefault();
        handleInput();
      }}
    >
      <canvas 
        ref={canvasRef} 
        className="block w-full h-full cursor-pointer"
      />

      {/* --- UI Overlays --- */}
      
      <div className="absolute top-0 left-0 w-full p-8 flex flex-col items-center pointer-events-none">
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-black/20 backdrop-blur-md border border-white/10 rounded-2xl px-6 py-3 flex flex-col items-center gap-1 shadow-2xl"
        >
          <div className="flex items-center gap-2 text-white font-display font-bold tracking-tight text-xl uppercase italic">
            {uiStage === 'POOL' && <Waves className="w-5 h-5 text-teal-400" />}
            {uiStage === 'OCEAN' && <Sparkles className="w-5 h-5 text-blue-400" />}
            {uiStage === 'SKY' && <Cloud className="w-5 h-5 text-sky-400" />}
            {uiStage === 'SPACE' && <Rocket className="w-5 h-5 text-indigo-400" />}
            {getStageColors(uiStage).text}
            <span className="text-[10px] opacity-40 font-sans tracking-normal lowercase italic ml-1">
              {uiStage === 'POOL' && '(수영장)'}
              {uiStage === 'OCEAN' && '(깊은 바다)'}
              {uiStage === 'SKY' && '(푸른 하늘)'}
              {uiStage === 'SPACE' && '(우주)'}
            </span>
          </div>
          
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                animate={{ width: `${distanceRatio * 100}%` }}
                transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
              />
            </div>
            <div className="text-[10px] text-white/40 font-mono tracking-widest uppercase mt-1">
              {Math.floor(distanceRatio * 100)}% Journeyed
            </div>
          </div>
        </motion.div>

        <motion.p 
          className="mt-6 text-white/40 text-[10px] font-display font-medium tracking-[0.3em] uppercase"
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Tap to swim upwards
        </motion.p>
      </div>

      {/* --- Game Over / Win Modal --- */}
      <AnimatePresence>
        {gameState.isGameOver && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white/10 border border-white/20 p-12 rounded-[2.5rem] flex flex-col items-center text-center shadow-[0_0_50px_rgba(255,255,255,0.1)]"
            >
              <div className="w-24 h-24 bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mb-8 shadow-lg shadow-orange-500/20">
                <Trophy className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-white text-6xl font-display font-black mb-4 tracking-tight uppercase">MISSION COMPLETE</h2>
              <p className="text-white/60 mb-2 max-w-xs text-lg font-medium">
                You've reached the stars.
              </p>
              <p className="text-white/30 mb-10 max-w-xs text-sm italic">
                우주 도달 성공! 여행해주셔서 감사합니다.
              </p>
              
              <button 
                onClick={resetGame}
                className="group flex items-center gap-3 bg-white text-black px-12 py-5 rounded-2xl font-display font-bold text-xl hover:scale-105 active:scale-95 transition-all shadow-xl hover:shadow-white/20 pointer-events-auto"
              >
                <RefreshCcw className="w-6 h-6 group-hover:rotate-180 transition-transform duration-500" />
                DIVE AGAIN
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
