/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Waves, Cloud, Rocket, Trophy, RefreshCcw, Settings, X, Save, Image as ImageIcon, Gauge, Wind, Plus, Trash, Home, Play } from 'lucide-react';

// --- Constants & Types ---

// --- [DISTANCE CONFIG POINT] --- 
// 게임의 총 거리는 여기 DEFAULT_MAX_DISTANCE 또는 관리자 페이지에서 설정할 수 있습니다.
const DEFAULT_MAX_DISTANCE = 10000;
const THRUST_STRENGTH = 6;
const GRAVITY = 0.15;
const MAX_VELOCITY = 15;
const PARTICLE_COUNT = 30;

// --- [RECOMMENDED URL HELPER] ---
// GitHub의 raw 주소는 로딩이 느릴 수 있습니다. 이 함수는 자동으로 가장 빠른 CDN(jsDelivr)으로 변환해줍니다.
const resolveUrl = (url: string) => {
  if (!url) return '';
  if (url.includes('raw.githubusercontent.com')) {
    return url
      .replace('raw.githubusercontent.com', 'cdn.jsdelivr.net/gh')
      .replace('/main/', '@main/')
      .replace('/master/', '@master/');
  }
  return url;
};

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
  bgmUrl?: string; // --- [BGM EDIT POINT] --- Store URL for each stage BGM
  characterImageUrl?: string; // --- [CHARACTER EDIT POINT] --- Stage specific character image
}

interface ActiveObstacle {
  id: number;
  x: number;
  y: number;
  vx: number; // Horizontal velocity for individual bounce
  vy: number; // Vertical velocity for individual bounce
  shake: number; // Individual shake intensity
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

  const [isLobby, setIsLobby] = useState(false); // Start immediately

  const [stageSettings, setStageSettings] = useState<Record<Stage, StageSettings>>(() => {
    const saved = localStorage.getItem('swimToSpace_difficulty');
    if (saved) return JSON.parse(saved);
    return {
      POOL: { 
        resistance: 1.0, sway: 0, frequency: 0.2,
        bgmUrl: '',
        characterImageUrl: '', // --- [CHARACTER EDIT POINT] --- 1단계 수영장 캐릭터
        obstacleDefs: [
          { id: 'p1', name: 'Pool Buoy', imageUrl: 'https://cdn-icons-png.flaticon.com/512/2854/2854737.png', size: 40 },
          { id: 'p2', name: 'Kickboard', imageUrl: 'https://cdn-icons-png.flaticon.com/512/2662/2662282.png', size: 50 },
        ]
      },
      OCEAN: { 
        resistance: 1.2, sway: 0.5, frequency: 0.3,
        bgmUrl: '',
        characterImageUrl: '', // --- [CHARACTER EDIT POINT] --- 2단계 바다 캐릭터
        obstacleDefs: [
          { id: 'o1', name: 'Shark', imageUrl: 'https://cdn-icons-png.flaticon.com/512/2042/2042672.png', size: 70 },
          { id: 'o2', name: 'Coral', imageUrl: 'https://cdn-icons-png.flaticon.com/512/2928/2928544.png', size: 50 },
        ]
      },
      SKY: { 
        resistance: 1.4, sway: 1.5, frequency: 0.4,
        bgmUrl: '',
        characterImageUrl: '', // --- [CHARACTER EDIT POINT] --- 3단계 하늘 캐릭터
        obstacleDefs: [
          { id: 's1', name: 'Bird', imageUrl: 'https://cdn-icons-png.flaticon.com/512/3069/3069172.png', size: 45 },
          { id: 's2', name: 'Plane', imageUrl: 'https://cdn-icons-png.flaticon.com/512/784/784918.png', size: 80 },
        ]
      },
      SPACE: { 
        resistance: 1.8, sway: 2.5, frequency: 0.5,
        bgmUrl: '',
        characterImageUrl: '', // --- [CHARACTER EDIT POINT] --- 4단계 우주 캐릭터
        obstacleDefs: [
          { id: 'sp1', name: 'Planet', imageUrl: 'https://cdn-icons-png.flaticon.com/512/1146/1146331.png', size: 90 },
          { id: 'sp2', name: 'Star', imageUrl: 'https://cdn-icons-png.flaticon.com/512/541/541415.png', size: 40 },
        ]
      },
    };
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stageCharacterCache = useRef<Map<Stage, HTMLImageElement>>(new Map()); // --- [CHARACTER EDIT POINT] --- Cache for stage characters
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
    velocityX: 0,
    targetX: 0,
    targetY: 0, // --- [NEW] Vertical target
    shake: 0,
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

  // --- [BGM PLAYBACK LOGIC] ---
  useEffect(() => {
    if (isLobby || gameState.isGameOver) {
      audioRef.current?.pause();
      return;
    }

    const currentBgm = stageSettings[uiStage].bgmUrl;
    if (currentBgm) {
      if (!audioRef.current) audioRef.current = new Audio();
      if (audioRef.current.src !== currentBgm) {
        audioRef.current.src = currentBgm;
        audioRef.current.loop = true;
        audioRef.current.play().catch(e => console.log("Audio play blocked", e));
      }
    } else {
      audioRef.current?.pause();
    }
  }, [uiStage, isLobby, gameState.isGameOver, stageSettings]);

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

    // Stage-specific characters preloading
    (Object.entries(stageSettings) as [Stage, StageSettings][]).forEach(([stage, settings]) => {
      if (settings.characterImageUrl) {
        if (!stageCharacterCache.current.has(stage)) {
          const img = new Image();
          img.src = resolveUrl(settings.characterImageUrl);
          img.onload = () => stageCharacterCache.current.set(stage, img);
        }
      } else {
        stageCharacterCache.current.delete(stage);
      }
    });

    // Obstacle images
    (Object.values(stageSettings) as StageSettings[]).forEach(stage => {
      stage.obstacleDefs.forEach(def => {
        const url = resolveUrl(def.imageUrl);
        if (url && !obstacleImageCache.current.has(def.imageUrl)) {
          const img = new Image();
          img.src = url;
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
        physicsRef.current.targetY = height * 0.7; // Init targetY
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
      const springKY = 0.05;
      const dy = (physicsRef.current.targetY - physicsRef.current.playerY);
      
      // Combine gravity/thrust with a pull towards targetY
      physicsRef.current.velocity += dy * springKY;
      physicsRef.current.velocity += GRAVITY * diff.resistance;
      physicsRef.current.velocity *= 0.95; // Vertical damping
      physicsRef.current.playerY += physicsRef.current.velocity;

      // Horizontal Physics (Momentum based)
      const springK = 0.08;
      const drag = 0.92;
      const dx = (physicsRef.current.targetX - physicsRef.current.playerX);
      
      // Acceleration towards target + Momentum
      physicsRef.current.velocityX += dx * springK;
      physicsRef.current.velocityX *= drag;
      physicsRef.current.playerX += physicsRef.current.velocityX; 

      // Apply shake decay
      physicsRef.current.shake *= 0.85;

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
              vx: 0,
              vy: 0,
              shake: 0,
              size: def.size,
              def,
              speed: 2 + Math.random() * 2
            });
          }
        }
      }

      physicsRef.current.obstacles.forEach((ob, index) => {
        // Apply individual physics (drag and gravity)
        ob.vx *= 0.95;
        ob.vy *= 0.95;
        ob.shake *= 0.8;

        // Basic movement + Individual collision velocity
        ob.y += (ob.speed + ob.vy) + (physicsRef.current.velocity * -0.5);
        ob.x += ob.vx;

        // Collision detection
        const px = physicsRef.current.playerX;
        const py = physicsRef.current.playerY;
        const distToPlayer = Math.hypot(px - ob.x, py - ob.y);
        
        if (!physicsRef.current.isGameOver && distToPlayer < (ob.size / 2 + 15)) {
          // --- [SFX EDIT POINT] --- 충돌 효과음 (Collision Sound)
          // const collisionSfx = new Audio('YOUR_SFX_URL');
          // collisionSfx.play();
          
          // Penalty: Vertical Knockdown (Character)
          physicsRef.current.velocity = 12;
          
          // Horizontal Repulsion (Character)
          const bounceDir = physicsRef.current.playerX < ob.x ? -1 : 1;
          physicsRef.current.velocityX = bounceDir * 15;
          physicsRef.current.playerX += bounceDir * 5; 

          // --- [Obstacle Reaction] ---
          // Only this obstacle bounces and shakes
          ob.vx = -bounceDir * 10; // Bounce obstacle away from player
          ob.vy = -8; // Bounce obstacle upwards (relative to flow)
          ob.shake = 10;

          // Global Screen Shake (Optional, kept at 50% for context but individual ob is primary)
          physicsRef.current.shake = 6;
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

      ctx.save();
      // Application of screen shake
      if (physicsRef.current.shake > 0.5) {
        ctx.translate(
          (Math.random() - 0.5) * physicsRef.current.shake,
          (Math.random() - 0.5) * physicsRef.current.shake
        );
      }

      ctx.fillStyle = `rgb(${Math.round(currentBgColor.current.r)}, ${Math.round(currentBgColor.current.g)}, ${Math.round(currentBgColor.current.b)})`;
      ctx.fillRect(-50, -50, width + 100, height + 100); // Slightly larger to cover shake gaps

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
        ctx.save();
        
        // Individual Shake/Reaction translate
        let ox = ob.x;
        let oy = ob.y;
        if (ob.shake > 0.5) {
          ox += (Math.random() - 0.5) * ob.shake;
          oy += (Math.random() - 0.5) * ob.shake;
        }
        ctx.translate(ox, oy);

        if (img) {
          ctx.drawImage(img, -ob.size / 2, -ob.size / 2, ob.size, ob.size);
        } else {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath(); ctx.arc(0, 0, ob.size / 2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      });

      // Draw Player
      ctx.save();
      ctx.translate(physicsRef.current.playerX, physicsRef.current.playerY);
      
      // Tilt based on velocity + Knockback spin effect
      const swimTilt = (physicsRef.current.velocity * 0.05) + (physicsRef.current.velocityX * 0.02);
      const tilt = Math.max(-0.6, Math.min(0.6, swimTilt));
      ctx.rotate(tilt);

      // --- [CHARACTER EDIT POINT] ---
      // Try stage-specific character first, then global image, then default draw
      const stageChar = stageCharacterCache.current.get(currentStage);
      if (stageChar) {
        const size = 64;
        ctx.drawImage(stageChar, -size/2, -size/2, size, size);
      } else if (playerImageRef.current) {
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
      ctx.restore(); // Restore from world tilt/transform
      ctx.restore(); // Restore from shake

      animationId = requestAnimationFrame(update);
    };

    animationId = requestAnimationFrame(update);
    return () => { window.removeEventListener('resize', handleResize); cancelAnimationFrame(animationId); };
  }, []);

  const resetGame = useCallback(() => {
    physicsRef.current.distance = 0;
    physicsRef.current.velocity = 0;
    physicsRef.current.playerY = physicsRef.current.height * 0.7;
    physicsRef.current.targetY = physicsRef.current.height * 0.7;
    physicsRef.current.playerX = physicsRef.current.width / 2;
    physicsRef.current.velocityX = 0;
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

  const handlePointer = (clientX: number, clientY: number) => {
    if (isAdminOpen) return;
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      physicsRef.current.targetX = clientX - rect.left;
      physicsRef.current.targetY = clientY - rect.top;
    }
  };

  const handleThrust = () => {
    if (isAdminOpen || isLobby) return;
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
      onMouseMove={(e) => handlePointer(e.clientX, e.clientY)}
      onTouchStart={(e) => { e.preventDefault(); handleThrust(); handlePointer(e.touches[0].clientX, e.touches[0].clientY); }}
      onTouchMove={(e) => { e.preventDefault(); handlePointer(e.touches[0].clientX, e.touches[0].clientY); }}
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
            <button onClick={(e) => { e.stopPropagation(); setIsLobby(true); }} className="p-1 hover:bg-white/10 rounded-lg">
              <Home className="w-4 h-4 text-white/40 hover:text-white" />
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

      {/* --- Hidden Admin Trigger (Top Right) --- */}
      <div className="absolute top-4 right-4 z-[100]">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            const pw = prompt('관리자 비밀번호를 입력하세요:');
            if (pw === 'admin123') setIsAdminOpen(true);
            else if (pw) alert('접근 권한이 없습니다.');
          }}
          className="p-2 bg-black/20 backdrop-blur-sm border border-white/5 rounded-full hover:bg-white/10 transition-all opacity-20 hover:opacity-100"
        >
          <Settings className="w-4 h-4 text-white" />
        </button>
      </div>

      <AnimatePresence>
        {isAdminOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-[110] overflow-y-auto"
            onClick={() => setIsAdminOpen(false)}
          >
            <motion.div initial={{ y: 20, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, scale: 0.95 }}
              className="bg-zinc-900 border border-white/10 p-8 rounded-3xl w-full max-w-lg shadow-2xl my-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-white font-display font-bold text-2xl">엔진 설정 (관리자)</h3>
                <button onClick={() => setIsAdminOpen(false)} className="text-white/40"><X /></button>
              </div>

              <div className="space-y-8 max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar">
                <div className="space-y-4">
                  <h4 className="text-teal-400 text-xs font-black uppercase tracking-widest flex items-center gap-2"><ImageIcon className="w-3 h-3" /> 기본 설정</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-white/40 text-[9px] font-bold uppercase block">총 비행 거리</label>
                      <input type="number" value={adminMaxDist} onChange={e => setAdminMaxDist(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white font-mono text-xs" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-white/40 text-[9px] font-bold uppercase block">캐릭터 이미지 URL</label>
                      <input type="text" value={adminImgUrl} onChange={e => setAdminImgUrl(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-[10px]" placeholder="https://..." />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h4 className="text-orange-400 text-xs font-black uppercase tracking-widest flex items-center gap-2"><Gauge className="w-3 h-3" /> 스테이지 물리 및 방해 요소</h4>
                  {(['POOL', 'OCEAN', 'SKY', 'SPACE'] as Stage[]).map(stage => (
                    <div key={stage} className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-white/70 text-[10px] font-black uppercase">{stage}</span>
                        <div className="flex items-center gap-4">
                           <div className="flex flex-col items-start">
                             <input 
                              type="text" 
                              value={stageSettings[stage].characterImageUrl || ''} 
                              onChange={e => updateDifficulty(stage, 'characterImageUrl', e.target.value as any)}
                              className="bg-black/40 border border-white/10 rounded px-2 py-0.5 text-[8px] text-orange-400 w-32" 
                              placeholder="캐릭터 이미지 (Stage Char)"
                            />
                           </div>
                           <input 
                            type="text" 
                            value={stageSettings[stage].bgmUrl || ''} 
                            onChange={e => updateDifficulty(stage, 'bgmUrl', e.target.value as any)}
                            className="bg-black/40 border border-white/10 rounded px-2 py-0.5 text-[8px] text-teal-400 w-32" 
                            placeholder="BGM URL (배경음악)"
                          />
                          <div className="flex flex-col items-end">
                            <span className="text-[8px] text-white/30 uppercase">빈도</span>
                            <input type="range" min="0" max="1.0" step="0.05" value={stageSettings[stage].frequency} onChange={e => updateDifficulty(stage, 'frequency', parseFloat(e.target.value))} className="w-20 accent-orange-500 h-1 bg-white/10 rounded-full" />
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <div className="flex justify-between text-[8px] text-white/30 uppercase"><span>수영 저항</span><span>{stageSettings[stage].resistance}x</span></div>
                          <input type="range" min="0.5" max="4.0" step="0.1" value={stageSettings[stage].resistance} onChange={e => updateDifficulty(stage, 'resistance', parseFloat(e.target.value))} className="w-full accent-teal-500 h-1 bg-white/10 rounded-full appearance-none" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[8px] text-white/30 uppercase"><span>물리적 흔들림</span><span>{stageSettings[stage].sway}px</span></div>
                          <input type="range" min="0" max="15" step="0.5" value={stageSettings[stage].sway} onChange={e => updateDifficulty(stage, 'sway', parseFloat(e.target.value))} className="w-full accent-orange-500 h-1 bg-white/10 rounded-full appearance-none" />
                        </div>
                      </div>

                      {/* Obstacle List */}
                      <div className="space-y-3 pt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] text-white/30 font-bold uppercase tracking-tight">방해 요소 목록</span>
                          <button onClick={() => addObstacle(stage)} className="text-teal-400 p-1 hover:bg-teal-400/10 rounded-lg transition-colors"><Plus className="w-3 h-3" /></button>
                        </div>
                        <div className="space-y-2">
                          {stageSettings[stage].obstacleDefs.map((obs) => (
                            <div key={obs.id} className="flex gap-2 items-center bg-black/40 p-2 rounded-xl border border-white/5">
                              <input 
                                type="text" 
                                value={obs.imageUrl} 
                                onChange={(e) => updateObstacle(stage, obs.id, 'imageUrl', e.target.value)}
                                placeholder="이미지 URL"
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
              <button onClick={saveSettings} className="w-full bg-white text-black font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 mt-8"><Save className="w-5 h-5" /> 설정 저장 및 재시작</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Lobby Screen --- */}
      <AnimatePresence>
        {isLobby && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex items-center justify-center p-6"
          >
            {/* Background for Lobby */}
            <div className="absolute inset-0 bg-teal-900/40 backdrop-blur-md" />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative z-10 flex flex-col items-center justify-center text-center space-y-6"
            >
              <div>
                <h1 className="text-white text-3xl font-display font-black tracking-widest uppercase italic">
                  SWIM TO SPACE
                </h1>
              </div>

              <div className="flex flex-col items-center">
                <button 
                  onClick={() => { setIsLobby(false); resetGame(); }}
                  className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-8 py-2.5 rounded-full font-bold text-xs flex items-center justify-center transition-all active:scale-95 hover:bg-white/20"
                >
                  START
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {gameState.isGameOver && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center p-6 z-[60]">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white/5 border border-white/10 p-12 rounded-[2.5rem] flex flex-col items-center text-center">
              <h2 className="text-white text-5xl font-display font-black mb-4 uppercase italic">MISSION COMPLETE</h2>
              <p className="text-white/60 mb-10 max-w-xs text-lg italic">우주 도달 성공! 여행해주셔서 감사합니다.</p>
              
              <div className="flex gap-4">
                <button onClick={() => { setIsLobby(true); resetGame(); }} className="flex items-center gap-3 bg-white/10 border border-white/10 text-white px-8 py-5 rounded-2xl font-display font-bold text-lg transition-all active:scale-95 hover:bg-white/20">
                  <Home className="w-5 h-5" /> HOME
                </button>
                <button onClick={resetGame} className="group flex items-center gap-3 bg-white text-black px-12 py-5 rounded-2xl font-display font-black text-xl transition-all active:scale-95 shadow-lg shadow-white/10">
                  <RefreshCcw className="w-6 h-6 group-hover:rotate-180 duration-500" /> AGAIN
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{` .custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; } `}</style>
    </div>
  );
}
