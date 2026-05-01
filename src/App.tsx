/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Waves, Cloud, Rocket, Trophy, RefreshCcw, Settings, X, Save, Image as ImageIcon, Gauge, Wind, Plus, Trash } from 'lucide-react';

// --- Constants & Types ---

const DEFAULT_MAX_DISTANCE = 10000;
const THRUST_STRENGTH = 6;
const GRAVITY = 0.15;
const MAX_VELOCITY = 15;
const PARTICLE_COUNT = 30;

type Stage = 'POOL' | 'OCEAN' | 'SKY' | 'SPACE';

interface ObstacleDef {
  id: string;
  name: string;
  imageUrl: string;
  size: number;
}

interface StageSettings {
  resistance: number;
  sway: number;
  frequency: number; // Spawn probability Factor
  obstacleDefs: ObstacleDef[];
}

interface ActiveObstacle {
  id: number;
  x: number;
  y: number;
  size: number;
  def: ObstacleDef;
  speed: number;
}

interface GameState {
  distance: number;
  velocity: number;
  playerY: number;
  playerX: number;
  particles: Particle[];
  isGameOver: boolean;
  stage: Stage;
  maxDistance: number;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
}

// --- Helper Functions ---

const getStage = (distance: number, maxDistance: number): Stage => {
  const ratio = distance / maxDistance;
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
  const playerImageRef = useRef<HTMLImageElement | null>(null);
  
  // --- Persistent Settings ---
  const [maxDistance, setMaxDistance] = useState(() => {
    const saved = localStorage.getItem('swimToSpace_maxDistance');
    return saved ? parseInt(saved, 10) : DEFAULT_MAX_DISTANCE;
  });

  const [playerImageUrl, setPlayerImageUrl] = useState(() => {
    return localStorage.getItem('swimToSpace_playerImage') || '';
  });

  const [stageSettings, setStageSettings] = useState<Record<Stage, StageSettings>>(() => {
    const saved = localStorage.getItem('swimToSpace_difficulty');
    if (saved) return JSON.parse(saved);
    return {
      POOL: { 
        resistance: 1.0, sway: 0, frequency: 0.2,
        obstacleDefs: [
          { id: 'p1', name: 'Pool Buoy', imageUrl: 'https://cdn-icons-png.flaticon.com/512/2854/2854737.png', size: 40 },
          { id: 'p2', name: 'Kickboard', imageUrl: 'https://cdn-icons-png.flaticon.com/512/2662/2662282.png', size: 50 },
        ]
      },
      OCEAN: { 
        resistance: 1.2, sway: 0.5, frequency: 0.3,
        obstacleDefs: [
          { id: 'o1', name: 'Shark', imageUrl: 'https://cdn-icons-png.flaticon.com/512/2042/2042672.png', size: 70 },
          { id: 'o2', name: 'Coral', imageUrl: 'https://cdn-icons-png.flaticon.com/512/2928/2928544.png', size: 50 },
        ]
      },
      SKY: { 
        resistance: 1.4, sway: 1.5, frequency: 0.4,
        obstacleDefs: [
          { id: 's1', name: 'Bird', imageUrl: 'https://cdn-icons-png.flaticon.com/512/3069/3069172.png', size: 45 },
          { id: 's2', name: 'Plane', imageUrl: 'https://cdn-icons-png.flaticon.com/512/784/784918.png', size: 80 },
        ]
      },
      SPACE: { 
        resistance: 1.8, sway: 2.5, frequency: 0.5,
        obstacleDefs: [
          { id: 'sp1', name: 'Planet', imageUrl: 'https://cdn-icons-png.flaticon.com/512/1146/1146331.png', size: 90 },
          { id: 'sp2', name: 'Star', imageUrl: 'https://cdn-icons-png.flaticon.com/512/541/541415.png', size: 40 },
        ]
      },
    };
  });

  const obstacleImageCache = useRef<Map<string, HTMLImageElement>>(new Map());

  const [gameState, setGameState] = useState<GameState>({
    distance: 0,
    velocity: 0,
    playerY: 0,
    playerX: 0,
    particles: [],
    isGameOver: false,
    stage: 'POOL',
    maxDistance: maxDistance,
  });

  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminMaxDist, setAdminMaxDist] = useState(maxDistance.toString());
  const [adminImgUrl, setAdminImgUrl] = useState(playerImageUrl);

  // --- Internal Physics Ref ---
  const physicsRef = useRef({
    distance: 0,
    velocity: 0,
    playerY: 0,
    playerX: 0,
    targetX: 0,
    particles: [] as Particle[],
    obstacles: [] as ActiveObstacle[],
    width: 0,
    height: 0,
    isGameOver: false,
    maxDistance: maxDistance,
    stageSettings: stageSettings,
  });

  const [uiStage, setUiStage] = useState<Stage>('POOL');
  const [distanceRatio, setDistanceRatio] = useState(0);
  const currentBgColor = useRef({ r: 45, g: 212, b: 191 });

  // Preload player and obstacle images
  useEffect(() => {
    // Player image
    if (playerImageUrl) {
      const img = new Image();
      img.src = playerImageUrl;
      img.onload = () => { playerImageRef.current = img; };
      img.onerror = () => { playerImageRef.current = null; };
    } else {
      playerImageRef.current = null;
    }

    // Obstacle images
    Object.values(stageSettings).forEach(stage => {
      stage.obstacleDefs.forEach(def => {
        if (!obstacleImageCache.current.has(def.imageUrl)) {
          const img = new Image();
          img.src = def.imageUrl;
          img.onload = () => obstacleImageCache.current.set(def.imageUrl, img);
        }
      });
    });
  }, [playerImageUrl, stageSettings]);

  const initParticles = (w: number, h: number) => {
    return Array.from({ length: PARTICLE_COUNT }).map(() => ({
      x: Math.random() * w,
      y: Math.random() * h,
      size: Math.random() * 3 + 1,
      speed: Math.random() * 2 + 1,
      opacity: Math.random() * 0.5 + 0.3,
    }));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
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
        ctx.resetTransform();
        ctx.scale(dpr, dpr);
        physicsRef.current.width = width;
        physicsRef.current.height = height;
        physicsRef.current.playerY = height * 0.7;
        physicsRef.current.playerX = width / 2;
        physicsRef.current.targetX = width / 2;
        physicsRef.current.particles = initParticles(width, height);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const update = () => {
      const { width, height, maxDistance: currentMax, stageSettings: currentDiff } = physicsRef.current;
      const currentStage = getStage(physicsRef.current.distance, currentMax);
      const diff = currentDiff[currentStage];

      if (!physicsRef.current.isGameOver && physicsRef.current.distance >= currentMax) {
        physicsRef.current.isGameOver = true;
        setGameState(prev => ({ ...prev, isGameOver: true }));
      }

      // Vertical Physics
      physicsRef.current.velocity += GRAVITY * diff.resistance;
      physicsRef.current.playerY += physicsRef.current.velocity;

      // Horizontal Physics (Following target + Dynamic Sway)
      const dx = (physicsRef.current.targetX - physicsRef.current.playerX);
      physicsRef.current.playerX += dx * 0.08; 

      if (!physicsRef.current.isGameOver) {
        const swayForce = Math.sin(Date.now() * 0.0025) * diff.sway;
        physicsRef.current.playerX += swayForce;
        physicsRef.current.distance += Math.max(0, -physicsRef.current.velocity * 0.8) / diff.resistance;
      }

      // Clamping
      const minY = height * 0.2;
      const maxY = height * 0.8;
      if (physicsRef.current.playerY > maxY) { physicsRef.current.playerY = maxY; physicsRef.current.velocity = 0; }
      if (physicsRef.current.playerY < minY) { physicsRef.current.playerY = minY; }
      if (physicsRef.current.playerX < 30) physicsRef.current.playerX = 30;
      if (physicsRef.current.playerX > width - 30) physicsRef.current.playerX = width - 30;

      // Particles
      physicsRef.current.particles.forEach(p => {
        p.y += p.speed + (physicsRef.current.velocity * -0.3);
        if (p.y > height) { p.y = -10; p.x = Math.random() * width; }
        else if (p.y < -10) { p.y = height + 10; p.x = Math.random() * width; }
      });

      // --- Obstacles Logic ---
      if (!physicsRef.current.isGameOver) {
        // Spawning
        if (Math.random() < (diff.frequency * 0.05)) {
          const def = diff.obstacleDefs[Math.floor(Math.random() * diff.obstacleDefs.length)];
          if (def) {
            physicsRef.current.obstacles.push({
              id: Date.now() + Math.random(),
              x: Math.random() * (width - 60) + 30,
              y: -100,
              size: def.size,
              def,
              speed: 2 + Math.random() * 2
            });
          }
        }
      }

      physicsRef.current.obstacles.forEach((ob, index) => {
        // Movement
        ob.y += ob.speed + (physicsRef.current.velocity * -0.5);

        // Collision detection
        const px = physicsRef.current.playerX;
        const py = physicsRef.current.playerY;
        const distToPlayer = Math.hypot(px - ob.x, py - ob.y);
        
        if (!physicsRef.current.isGameOver && distToPlayer < (ob.size / 2 + 15)) {
          // Penalty: Knockdown
          physicsRef.current.velocity += 8;
          // Respawn obstacle slightly away so it doesn't multi-hit
          ob.y += 100;
        }

        // Cleanup
        if (ob.y > height + 200) {
          physicsRef.current.obstacles.splice(index, 1);
        }
      });

      setUiStage(currentStage);
      setDistanceRatio(Math.min(1, physicsRef.current.distance / currentMax));

      // Draw
      const stageConfig = getStageColors(currentStage);
      const targetColor = hexToRgb(stageConfig.bg);
      currentBgColor.current.r += (targetColor.r - currentBgColor.current.r) * 0.05;
      currentBgColor.current.g += (targetColor.g - currentBgColor.current.g) * 0.05;
      currentBgColor.current.b += (targetColor.b - currentBgColor.current.b) * 0.05;
      ctx.fillStyle = `rgb(${Math.round(currentBgColor.current.r)}, ${Math.round(currentBgColor.current.g)}, ${Math.round(currentBgColor.current.b)})`;
      ctx.fillRect(0, 0, width, height);

      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, 'rgba(0,0,0,0.15)');
      gradient.addColorStop(0.5, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.05)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = stageConfig.particle;
      physicsRef.current.particles.forEach(p => {
        ctx.globalAlpha = p.opacity;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // Draw Obstacles
      physicsRef.current.obstacles.forEach(ob => {
        const img = obstacleImageCache.current.get(ob.def.imageUrl);
        if (img) {
          ctx.drawImage(img, ob.x - ob.size / 2, ob.y - ob.size / 2, ob.size, ob.size);
        } else {
          // Fallback if image not loaded or failed
          ctx.fillStyle = '#ef4444';
          ctx.beginPath(); ctx.arc(ob.x, ob.y, ob.size / 2, 0, Math.PI * 2); ctx.fill();
        }
      });

      // Draw Player
      ctx.save();
      ctx.translate(physicsRef.current.playerX, physicsRef.current.playerY);
      const tilt = Math.max(-0.4, Math.min(0.4, (physicsRef.current.velocity * 0.05) + (dx * 0.005)));
      ctx.rotate(tilt);

      // --- [MANUAL IMAGE EDIT POINT] ---
      // If you want to hardcode an image source in the code, replace 'playerImageUrl' logic with your URL here.
      if (playerImageRef.current) {
        const size = 64;
        ctx.drawImage(playerImageRef.current, -size/2, -size/2, size, size);
      } else {
        // Default character logic
        ctx.fillStyle = '#f87171'; 
        ctx.beginPath(); ctx.ellipse(0, 0, 18, 24, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fee2e2';
        ctx.beginPath(); ctx.arc(0, -20, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = currentStage === 'SPACE' ? '#67e8f9' : '#1e293b';
        ctx.fillRect(-6, -22, 12, 4);
        ctx.strokeStyle = '#f87171'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        const wave = Math.sin(Date.now() * 0.015) * 12;
        ctx.beginPath(); ctx.moveTo(-16, -2); ctx.lineTo(-24, wave);
        ctx.moveTo(16, -2); ctx.lineTo(24, -wave); ctx.stroke();
      }
      ctx.restore();

      animationId = requestAnimationFrame(update);
    };

    animationId = requestAnimationFrame(update);
    return () => { window.removeEventListener('resize', handleResize); cancelAnimationFrame(animationId); };
  }, []);

  const resetGame = useCallback(() => {
    physicsRef.current.distance = 0;
    physicsRef.current.velocity = 0;
    physicsRef.current.playerY = physicsRef.current.height * 0.7;
    physicsRef.current.playerX = physicsRef.current.width / 2;
    physicsRef.current.targetX = physicsRef.current.width / 2;
    physicsRef.current.particles = initParticles(physicsRef.current.width, physicsRef.current.height);
    physicsRef.current.obstacles = [];
    physicsRef.current.isGameOver = false;
    currentBgColor.current = { r: 45, g: 212, b: 191 };
    setGameState(prev => ({ ...prev, isGameOver: false, distance: 0 }));
  }, []);

  const saveSettings = () => {
    const d = parseInt(adminMaxDist, 10);
    if (!isNaN(d) && d > 0) {
      setMaxDistance(d);
      physicsRef.current.maxDistance = d;
      localStorage.setItem('swimToSpace_maxDistance', d.toString());
    }
    setPlayerImageUrl(adminImgUrl);
    localStorage.setItem('swimToSpace_playerImage', adminImgUrl);
    localStorage.setItem('swimToSpace_difficulty', JSON.stringify(stageSettings));
    physicsRef.current.stageSettings = stageSettings;
    setIsAdminOpen(false);
    resetGame();
  };

  const handlePointer = (clientX: number) => {
    if (isAdminOpen) return;
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      physicsRef.current.targetX = clientX - rect.left;
    }
  };

  const handleThrust = () => {
    if (isAdminOpen) return;
    const currentStage = getStage(physicsRef.current.distance, physicsRef.current.maxDistance);
    const diff = stageSettings[currentStage] || { resistance: 1 };
    physicsRef.current.velocity -= THRUST_STRENGTH / Math.sqrt(diff.resistance);
    if (physicsRef.current.velocity < -MAX_VELOCITY) physicsRef.current.velocity = -MAX_VELOCITY;
  };

  const updateDifficulty = (stage: Stage, key: keyof StageSettings, val: number) => {
    setStageSettings(prev => ({ ...prev, [stage]: { ...prev[stage], [key]: val } }));
  };

  const addObstacle = (stage: Stage) => {
    const newObs: ObstacleDef = {
      id: Date.now().toString(),
      name: 'New Obstacle',
      imageUrl: '',
      size: 50
    };
    setStageSettings(prev => ({
      ...prev,
      [stage]: { ...prev[stage], obstacleDefs: [...prev[stage].obstacleDefs, newObs] }
    }));
  };

  const removeObstacle = (stage: Stage, id: string) => {
    setStageSettings(prev => ({
      ...prev,
      [stage]: { ...prev[stage], obstacleDefs: prev[stage].obstacleDefs.filter(o => o.id !== id) }
    }));
  };

  const updateObstacle = (stage: Stage, id: string, key: keyof ObstacleDef, val: any) => {
    setStageSettings(prev => ({
      ...prev,
      [stage]: {
        ...prev[stage],
        obstacleDefs: prev[stage].obstacleDefs.map(o => o.id === id ? { ...o, [key]: val } : o)
      }
    }));
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-screen overflow-hidden bg-black font-sans select-none touch-none cursor-crosshair"
      onMouseDown={handleThrust}
      onMouseMove={(e) => handlePointer(e.clientX)}
      onTouchStart={(e) => { e.preventDefault(); handleThrust(); handlePointer(e.touches[0].clientX); }}
      onTouchMove={(e) => { e.preventDefault(); handlePointer(e.touches[0].clientX); }}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* --- UI --- */}
      <div className="absolute top-0 left-0 w-full p-8 flex flex-col items-center pointer-events-none">
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          className="bg-black/20 backdrop-blur-md border border-white/10 rounded-2xl px-6 py-3 flex flex-col items-center gap-1 shadow-2xl pointer-events-auto"
        >
          <div className="w-full flex justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-white font-display font-bold tracking-tight text-xl uppercase italic">
              {uiStage === 'POOL' && <Waves className="w-5 h-5 text-teal-400" />}
              {uiStage === 'OCEAN' && <Sparkles className="w-5 h-5 text-blue-400" />}
              {uiStage === 'SKY' && <Cloud className="w-5 h-5 text-sky-400" />}
              {uiStage === 'SPACE' && <Rocket className="w-5 h-5 text-indigo-400" />}
              {getStageColors(uiStage).text}
            </div>
            <button onClick={(e) => { e.stopPropagation(); setIsAdminOpen(true); }} className="p-1 hover:bg-white/10 rounded-lg">
              <Settings className="w-4 h-4 text-white/40 hover:text-white" />
            </button>
          </div>
          <div className="flex flex-col items-center gap-0.5 mt-1">
            <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" animate={{ width: `${distanceRatio * 100}%` }} transition={{ type: 'spring', bounce: 0, duration: 0.2 }} />
            </div>
            <div className="text-[10px] text-white/40 font-mono tracking-widest mt-1 uppercase">{Math.floor(distanceRatio * 100)}% Journeyed</div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {isAdminOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 overflow-y-auto"
            onClick={() => setIsAdminOpen(false)}
          >
            <motion.div initial={{ y: 20, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, scale: 0.95 }}
              className="bg-zinc-900 border border-white/10 p-8 rounded-3xl w-full max-w-lg shadow-2xl my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-white font-display font-bold text-2xl">ENGINE CONFIG</h3>
                <button onClick={() => setIsAdminOpen(false)} className="text-white/40"><X /></button>
              </div>

              <div className="space-y-8 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                <div className="space-y-4">
                  <h4 className="text-teal-400 text-xs font-black uppercase tracking-widest flex items-center gap-2"><ImageIcon className="w-3 h-3" /> Core settings</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-white/40 text-[9px] font-bold uppercase block">Max Distance</label>
                      <input type="number" value={adminMaxDist} onChange={e => setAdminMaxDist(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-mono text-xs" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-white/40 text-[9px] font-bold uppercase block">Player Image URL</label>
                      <input type="text" value={adminImgUrl} onChange={e => setAdminImgUrl(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-[10px]" placeholder="https://..." />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-orange-400 text-xs font-black uppercase tracking-widest flex items-center gap-2"><Gauge className="w-3 h-3" /> Stage Physics & Obstacles</h4>
                  {(['POOL', 'OCEAN', 'SKY', 'SPACE'] as Stage[]).map(stage => (
                    <div key={stage} className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-white/70 text-[10px] font-black uppercase">{stage}</span>
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col items-end">
                            <span className="text-[8px] text-white/30 uppercase">Freq</span>
                            <input type="range" min="0" max="1.0" step="0.05" value={stageSettings[stage].frequency} onChange={e => updateDifficulty(stage, 'frequency', parseFloat(e.target.value))} className="w-20 accent-orange-500 h-1 bg-white/10 rounded-full" />
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[8px] text-white/30 uppercase"><span>Resistance</span><span>{stageSettings[stage].resistance}x</span></div>
                          <input type="range" min="0.5" max="4.0" step="0.1" value={stageSettings[stage].resistance} onChange={e => updateDifficulty(stage, 'resistance', parseFloat(e.target.value))} className="w-full accent-teal-500 h-1 bg-white/10 rounded-full appearance-none" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[8px] text-white/30 uppercase"><span>Turbulence</span><span>{stageSettings[stage].sway}px</span></div>
                          <input type="range" min="0" max="15" step="0.5" value={stageSettings[stage].sway} onChange={e => updateDifficulty(stage, 'sway', parseFloat(e.target.value))} className="w-full accent-orange-500 h-1 bg-white/10 rounded-full appearance-none" />
                        </div>
                      </div>

                      {/* Obstacle List */}
                      <div className="space-y-3 pt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] text-white/30 font-bold uppercase tracking-tight">Obstacles</span>
                          <button onClick={() => addObstacle(stage)} className="text-teal-400 p-1 hover:bg-teal-400/10 rounded-lg transition-colors"><Plus className="w-3 h-3" /></button>
                        </div>
                        <div className="space-y-2">
                          {stageSettings[stage].obstacleDefs.map((obs) => (
                            <div key={obs.id} className="flex gap-2 items-center bg-black/40 p-2 rounded-xl border border-white/5">
                              <input 
                                type="text" 
                                value={obs.imageUrl} 
                                onChange={(e) => updateObstacle(stage, obs.id, 'imageUrl', e.target.value)}
                                placeholder="Image URL"
                                className="flex-1 bg-transparent text-white/60 text-[9px] outline-none font-mono"
                              />
                              <input 
                                type="number" 
                                value={obs.size} 
                                onChange={(e) => updateObstacle(stage, obs.id, 'size', parseInt(e.target.value, 10))}
                                className="w-10 bg-transparent text-white/40 text-[9px] outline-none text-right"
                              />
                              <button onClick={() => removeObstacle(stage, obs.id)} className="text-red-500/40 hover:text-red-500"><Trash className="w-3 h-3" /></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={saveSettings} className="w-full bg-white text-black font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 mt-8"><Save className="w-5 h-5" /> APPLY CHANGES</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {gameState.isGameOver && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white/5 border border-white/10 p-12 rounded-[2.5rem] flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mb-8"><Trophy className="w-10 h-10 text-white" /></div>
              <h2 className="text-white text-5xl font-display font-black mb-4">REACHED THE STARS</h2>
              <p className="text-white/60 mb-10 max-w-xs text-lg italic">우주 도달 성공! 여행해주셔서 감사합니다.</p>
              <button onClick={resetGame} className="group flex items-center gap-3 bg-white text-black px-12 py-5 rounded-2xl font-display font-bold text-xl transition-all">
                <RefreshCcw className="w-6 h-6 group-hover:rotate-180 duration-500" /> DIVE AGAIN
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{` .custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; } `}</style>
    </div>
  );
}
