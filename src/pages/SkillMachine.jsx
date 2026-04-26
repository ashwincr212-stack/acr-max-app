import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Brain, Zap, Trophy, Flame, Coins, Clock, Sparkles,
  Award, Star, RotateCw,
  Check, X, Lightbulb, Gift, Crown, Rocket, ChevronRight,
  Activity, Grid3x3, Eye, Shuffle, Hash,
  MousePointerClick, Sigma, Puzzle, Volume2, VolumeX, Home,
  Gem, Heart, Equal
} from 'lucide-react';

const BASE_REWARD = 20;
const WRONG_PENALTY = 10;
const EXTRA_GAMES_COST = 50;
const EXTRA_GAMES_LIMIT = 2;
const SESSION_LIMIT = 6;
const COOLDOWN_MS = 2 * 60 * 60 * 1000;
const PERFECT_SESSION_BONUS = 100;
const LUCKY_SPIN_DURATION_MS = 2500;
const LUCKY_SPIN_REWARDS = [5, 10, 15, 25, 50, 75, 100, 200];

// ============ STORAGE HELPERS ============
// Works in Claude artifact sandbox (window.storage) or normal browser (localStorage)
const useStorage = () => {
  const get = async (key, defaultVal) => {
    try {
      if (typeof window !== 'undefined' && window.storage?.get) {
        const r = await window.storage.get(key);
        return r ? JSON.parse(r.value) : defaultVal;
      }
      if (typeof window !== 'undefined' && window.localStorage) {
        const v = window.localStorage.getItem(key);
        return v ? JSON.parse(v) : defaultVal;
      }
      return defaultVal;
    } catch { return defaultVal; }
  };
  const set = async (key, val) => {
    try {
      if (typeof window !== 'undefined' && window.storage?.set) {
        await window.storage.set(key, JSON.stringify(val));
        return;
      }
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(val));
      }
    } catch {}
  };
  return { get, set };
};

// ============ PUZZLE GENERATORS ============
const generateQuickMath = (difficulty) => {
  const tricks = [
    () => {
      const a = Math.floor(Math.random() * 9) + 2;
      const ans = a * 9;
      return {
        question: `${a} × 9 = ?`,
        answer: ans,
        options: shuffleAnswers(ans, 10),
        trick: '×9 Trick',
        explanation: `Quick trick: ${a} × 9 = ${a} × 10 − ${a} = ${a*10} − ${a} = ${ans}`,
      };
    },
    () => {
      const a = Math.floor(Math.random() * 40) + 10;
      const b = Math.floor(Math.random() * 40) + 10;
      const ans = a + b;
      return {
        question: `${a} + ${b} = ?`,
        answer: ans,
        options: shuffleAnswers(ans, 8),
        trick: 'Split Method',
        explanation: `Split: ${a} + ${b} = (${Math.floor(a/10)*10} + ${Math.floor(b/10)*10}) + (${a%10} + ${b%10}) = ${Math.floor(a/10)*10 + Math.floor(b/10)*10} + ${a%10 + b%10} = ${ans}`,
      };
    },
    () => {
      const a = (Math.floor(Math.random() * 8) + 2) * 5;
      const b = Math.floor(Math.random() * 10) + 2;
      const ans = a * b;
      return {
        question: `${a} × ${b} = ?`,
        answer: ans,
        options: shuffleAnswers(ans, 20),
        trick: '×5 Shortcut',
        explanation: `×5 trick: ${a} × ${b} = (${a/5} × ${b}) × 5 = ${a/5 * b} × 5 = ${ans}`,
      };
    },
    () => {
      const a = Math.floor(Math.random() * 50) + 50;
      const b = Math.floor(Math.random() * 30) + 10;
      const ans = a - b;
      return {
        question: `${a} − ${b} = ?`,
        answer: ans,
        options: shuffleAnswers(ans, 8),
        trick: 'Round-Off',
        explanation: `Round-off: ${a} − ${b} ≈ ${a} − ${Math.round(b/10)*10} = ${a - Math.round(b/10)*10}, then adjust by ${Math.round(b/10)*10 - b} → ${ans}`,
      };
    },
    () => {
      const sq = Math.floor(Math.random() * 8) + 11;
      const ans = sq * sq;
      return {
        question: `${sq}² = ?`,
        answer: ans,
        options: shuffleAnswers(ans, 30),
        trick: 'Square Trick',
        explanation: `${sq}² = (${sq}+${sq-10})(${sq}-${sq-10}) + ${sq-10}² = ${(sq+sq-10)*(sq-(sq-10))} + ${(sq-10)**2} ... or just: ${sq}×${sq} = ${ans}`,
      };
    },
  ];
  return tricks[Math.floor(Math.random() * tricks.length)]();
};

const generateNumberLogic = (difficulty) => {
  const patterns = [
    () => {
      const start = Math.floor(Math.random() * 5) + 2;
      const step = Math.floor(Math.random() * 4) + 2;
      const seq = [start, start+step, start+step*2, start+step*3];
      const ans = start + step*4;
      return {
        question: `${seq.join(', ')}, ?`,
        answer: ans,
        options: shuffleAnswers(ans, 5),
        trick: 'Arithmetic',
        explanation: `Add ${step} each time: ${seq[seq.length-1]} + ${step} = ${ans}`,
      };
    },
    () => {
      const start = Math.floor(Math.random() * 3) + 2;
      const mult = Math.floor(Math.random() * 2) + 2;
      const seq = [start, start*mult, start*mult*mult, start*mult*mult*mult];
      const ans = start * Math.pow(mult, 4);
      return {
        question: `${seq.join(', ')}, ?`,
        answer: ans,
        options: shuffleAnswers(ans, Math.floor(ans*0.3)),
        trick: 'Geometric',
        explanation: `Multiply by ${mult}: ${seq[seq.length-1]} × ${mult} = ${ans}`,
      };
    },
    () => {
      const seq = [1, 1, 2, 3, 5, 8, 13];
      const idx = Math.floor(Math.random() * 3) + 2;
      const display = seq.slice(idx, idx+4);
      const ans = display[2] + display[3];
      return {
        question: `${display.join(', ')}, ?`,
        answer: ans,
        options: shuffleAnswers(ans, 5),
        trick: 'Fibonacci',
        explanation: `Each number = sum of previous two: ${display[2]} + ${display[3]} = ${ans}`,
      };
    },
    () => {
      const start = Math.floor(Math.random() * 4) + 2;
      const seq = [start, start*start, start*start*start];
      const ans = Math.pow(start, 4);
      return {
        question: `${seq.join(', ')}, ?`,
        answer: ans,
        options: shuffleAnswers(ans, Math.floor(ans*0.3)),
        trick: 'Powers',
        explanation: `Powers of ${start}: ${start}¹, ${start}², ${start}³, ${start}⁴ = ${ans}`,
      };
    },
  ];
  return patterns[Math.floor(Math.random() * patterns.length)]();
};

const generateOddOneOut = () => {
  const categories = [
    { items: ['🍎', '🍊', '🍇', '🥕'], odd: '🥕', reason: 'All others are fruits — carrot is a vegetable' },
    { items: ['🐕', '🐈', '🦁', '🦅'], odd: '🦅', reason: 'All others are mammals — eagle is a bird' },
    { items: ['🚗', '🚕', '🚙', '🚲'], odd: '🚲', reason: 'All others are motor vehicles — bicycle is human-powered' },
    { items: ['⚽', '🏀', '🏈', '🎸'], odd: '🎸', reason: 'All others are sports balls — guitar is an instrument' },
    { items: ['☀️', '🌙', '⭐', '🌧️'], odd: '🌧️', reason: 'All others are celestial bodies — rain is weather' },
    { items: ['4', '9', '16', '20'], odd: '20', reason: 'All others are perfect squares (2², 3², 4²)' },
    { items: ['2', '3', '5', '9'], odd: '9', reason: 'All others are prime numbers' },
    { items: ['🌹', '🌻', '🌷', '🌳'], odd: '🌳', reason: 'All others are flowers — tree is different' },
    { items: ['🍕', '🍔', '🥗', '🌮'], odd: '🥗', reason: 'All others are fast food — salad is healthy' },
    { items: ['🎹', '🥁', '🎸', '🎤'], odd: '🎤', reason: 'All others are instruments — mic is for voice' },
  ];
  const c = categories[Math.floor(Math.random() * categories.length)];
  return {
    question: 'Which one is different?',
    options: [...c.items].sort(() => Math.random() - 0.5),
    answer: c.odd,
    trick: 'Category Logic',
    explanation: c.reason,
    type: 'emoji',
  };
};

const generateCompare = () => {
  const comparisons = [
    () => {
      const a = Math.floor(Math.random() * 99) + 10;
      const b = Math.floor(Math.random() * 99) + 10;
      return {
        question: `Which is larger?`,
        options: [`${a}`, `${b}`],
        answer: a > b ? `${a}` : `${b}`,
        explanation: `${Math.max(a,b)} > ${Math.min(a,b)} by ${Math.abs(a-b)}`,
        trick: 'Number Compare',
      };
    },
    () => {
      const a = Math.floor(Math.random() * 8) + 2;
      const b = Math.floor(Math.random() * 8) + 2;
      const c = Math.floor(Math.random() * 8) + 2;
      const d = Math.floor(Math.random() * 8) + 2;
      const v1 = a * b;
      const v2 = c * d;
      return {
        question: `Which is larger?`,
        options: [`${a}×${b}`, `${c}×${d}`],
        answer: v1 > v2 ? `${a}×${b}` : `${c}×${d}`,
        explanation: `${a}×${b} = ${v1}, ${c}×${d} = ${v2}. ${Math.max(v1,v2)} wins.`,
        trick: 'Multiplication',
      };
    },
    () => {
      const items = [
        {name: '🐘 Elephant', weight: 6000},
        {name: '🦏 Rhino', weight: 2300},
        {name: '🦛 Hippo', weight: 1500},
        {name: '🐻 Bear', weight: 400},
        {name: '🐅 Tiger', weight: 250},
        {name: '🐆 Leopard', weight: 90},
      ];
      const [a, b] = items.sort(() => Math.random() - 0.5).slice(0, 2);
      return {
        question: `Which is heavier?`,
        options: [a.name, b.name],
        answer: a.weight > b.weight ? a.name : b.name,
        explanation: `${a.name}: ~${a.weight}kg, ${b.name}: ~${b.weight}kg`,
        trick: 'Real World',
      };
    },
  ];
  return comparisons[Math.floor(Math.random() * comparisons.length)]();
};

const shuffleAnswers = (correct, range) => {
  const opts = new Set([correct]);
  while (opts.size < 4) {
    const offset = Math.floor(Math.random() * range * 2) - range;
    if (offset !== 0) opts.add(correct + offset);
  }
  return [...opts].sort(() => Math.random() - 0.5).map(n => n.toString());
};

// ============ MAIN COMPONENT ============
export default function SkillMachineModal({ userId, isOpen, onClose, onReward, coins = 0 }) {
  if (!isOpen) return null;

  return (
    <SkillMachineContent
      userId={userId}
      onClose={onClose}
      onReward={onReward}
      coins={coins}
    />
  );
}

function SkillMachineContent({ userId, onClose, onReward, coins = 0 }) {
  const storage = useStorage();
  const [screen, setScreen] = useState('home'); // home, intro, puzzle, feedback, extraChoice, sessionEnd, spin, daily, learn
  const [walletCoins, setWalletCoins] = useState(Number(coins || 0));
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [totalWins, setTotalWins] = useState(0);
  const [puzzleIndex, setPuzzleIndex] = useState(0);
  const [sessionStartIndex, setSessionStartIndex] = useState(0);
  const [activeSessionLimit, setActiveSessionLimit] = useState(SESSION_LIMIT);
  const [currentPuzzle, setCurrentPuzzle] = useState(null);
  const [puzzleType, setPuzzleType] = useState(null);
  const [recentTypes, setRecentTypes] = useState([]);
  const [timeLeft, setTimeLeft] = useState(15);
  const [maxTime, setMaxTime] = useState(15);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [sessionScore, setSessionScore] = useState({ correct: 0, coins: 0, perfect: true });
  const [cooldownUntil, setCooldownUntil] = useState(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [limitWindowUntil, setLimitWindowUntil] = useState(null);
  const [extraGamesRedeemedThisWindow, setExtraGamesRedeemedThisWindow] = useState(false);
  const [extraGamesActive, setExtraGamesActive] = useState(false);
  const [extraGamesRemaining, setExtraGamesRemaining] = useState(0);
  const [spinUsedThisWindow, setSpinUsedThisWindow] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [coinAnim, setCoinAnim] = useState(null);
  const [reactionStart, setReactionStart] = useState(null);
  const [reactionTime, setReactionTime] = useState(null);
  const [memoryFlash, setMemoryFlash] = useState(null);
  const [memoryPhase, setMemoryPhase] = useState('show');
  const [gridPhase, setGridPhase] = useState('show');
  const [sequenceItems, setSequenceItems] = useState([]);
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const [sequencePhase, setSequencePhase] = useState('show');
  const [gridTapItems, setGridTapItems] = useState([]);
  const [gridTapIndex, setGridTapIndex] = useState(0);
  const [gridTapPhase, setGridTapPhase] = useState('show');
  const [rotationAngle, setRotationAngle] = useState(0);
  const [targetRotation, setTargetRotation] = useState(0);
  const [patternGridData, setPatternGridData] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [learnMode, setLearnMode] = useState(false);
  const [badges, setBadges] = useState([]);
  const [luckySpinResult, setLuckySpinResult] = useState(null);
  const [luckySpinIndex, setLuckySpinIndex] = useState(null);
  const [spinRotation, setSpinRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  
  const timerRef = useRef(null);
  const reactionTimeoutRef = useRef(null);
  const coinAnimTimeoutRef = useRef(null);
  const roundTimeoutsRef = useRef([]);
  const roundIntervalsRef = useRef([]);
  const previousCoinsRef = useRef(Number(coins || 0));
  const pendingRewardRef = useRef(0);
  const sessionEndedRef = useRef(false);
  const answeredRef = useRef(false);
  const timeoutAnswerRef = useRef(null);
  const learnModeRef = useRef(false);
  const redeemInProgressRef = useRef(false);
  const storageKey = useMemo(() => `skillmachine_v2_${userId || 'guest'}`, [userId]);
  const baseSessionLimit = SESSION_LIMIT;
  const maxSessionLimit = SESSION_LIMIT + EXTRA_GAMES_LIMIT;
  const gamesInCurrentRun = Math.max(1, activeSessionLimit - sessionStartIndex);

  const stopAnswerTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerRunning(false);
  }, []);

  const clearRoundTimers = useCallback(() => {
    stopAnswerTimer();
    if (coinAnimTimeoutRef.current) {
      clearTimeout(coinAnimTimeoutRef.current);
      coinAnimTimeoutRef.current = null;
    }
    if (reactionTimeoutRef.current) {
      clearTimeout(reactionTimeoutRef.current);
      reactionTimeoutRef.current = null;
    }
    roundTimeoutsRef.current.forEach(clearTimeout);
    roundTimeoutsRef.current = [];
    roundIntervalsRef.current.forEach(clearInterval);
    roundIntervalsRef.current = [];
  }, [stopAnswerTimer]);

  const scheduleRoundTimeout = useCallback((fn, delay) => {
    const id = setTimeout(() => {
      roundTimeoutsRef.current = roundTimeoutsRef.current.filter(timeoutId => timeoutId !== id);
      fn();
    }, delay);
    roundTimeoutsRef.current.push(id);
    return id;
  }, []);

  const scheduleRoundInterval = useCallback((fn, delay) => {
    const id = setInterval(fn, delay);
    roundIntervalsRef.current.push(id);
    return id;
  }, []);

  const clearRoundInterval = useCallback((id) => {
    clearInterval(id);
    roundIntervalsRef.current = roundIntervalsRef.current.filter(intervalId => intervalId !== id);
  }, []);

  const beginAnswerTimer = useCallback(() => {
    if (!learnModeRef.current) setTimerRunning(true);
  }, []);

  const resetWindowFlags = useCallback(() => {
    redeemInProgressRef.current = false;
    setLimitWindowUntil(null);
    setSpinUsedThisWindow(false);
    setExtraGamesRedeemedThisWindow(false);
    setExtraGamesActive(false);
    setExtraGamesRemaining(0);
  }, []);

  useEffect(() => () => clearRoundTimers(), [clearRoundTimers]);

  useEffect(() => {
    learnModeRef.current = learnMode;
  }, [learnMode]);

  const awardCoins = useCallback((amount) => {
    const earned = Number(amount || 0);
    if (earned > 0) {
      pendingRewardRef.current += earned;
      onReward?.({ coins: earned });
    }
  }, [onReward]);

  useEffect(() => {
    const nextCoins = Number(coins || 0);
    const previousCoins = previousCoinsRef.current;
    const diff = nextCoins - previousCoins;

    if (diff !== 0) {
      const settledReward = diff > 0 ? Math.min(diff, pendingRewardRef.current) : 0;
      pendingRewardRef.current = Math.max(0, pendingRewardRef.current - settledReward);
      setWalletCoins(current => Math.max(0, current + diff - settledReward));
      previousCoinsRef.current = nextCoins;
    }
  }, [coins]);

  useEffect(() => {
    const nextCoins = Number(coins || 0);
    previousCoinsRef.current = nextCoins;
    pendingRewardRef.current = 0;
    setWalletCoins(nextCoins);
  }, [storageKey]);

  // Load state
  useEffect(() => {
    (async () => {
      const saved = await storage.get(storageKey, null);
      if (saved) {
        const savedWindowUntil = saved.limitWindowUntil ?? null;
        const windowActive = savedWindowUntil && savedWindowUntil > Date.now();
        setBestStreak(saved.bestStreak ?? 0);
        setTotalWins(saved.totalWins ?? 0);
        setCooldownUntil((saved.cooldownUntil ?? null) > Date.now() ? saved.cooldownUntil : null);
        setLimitWindowUntil(windowActive ? savedWindowUntil : null);
        setExtraGamesRedeemedThisWindow(windowActive ? saved.extraGamesRedeemedThisWindow ?? saved.extraGamesPurchasedThisWindow ?? false : false);
        setExtraGamesActive(false);
        setExtraGamesRemaining(0);
        setSpinUsedThisWindow(windowActive ? saved.spinUsedThisWindow ?? false : false);
        setBadges(saved.badges ?? []);
      }
    })();
  }, [storageKey]);

  // Save state
  useEffect(() => {
    storage.set(storageKey, {
      bestStreak,
      totalWins,
      cooldownUntil,
      limitWindowUntil,
      extraGamesRedeemedThisWindow,
      extraGamesActive,
      extraGamesRemaining,
      spinUsedThisWindow,
      badges
    });
  }, [
    storageKey,
    bestStreak,
    totalWins,
    cooldownUntil,
    limitWindowUntil,
    extraGamesRedeemedThisWindow,
    extraGamesActive,
    extraGamesRemaining,
    spinUsedThisWindow,
    badges
  ]);

  // Cooldown timer
  useEffect(() => {
    if (!cooldownUntil) { setCooldownRemaining(0); return; }
    const tick = () => {
      const rem = Math.max(0, cooldownUntil - Date.now());
      setCooldownRemaining(rem);
      if (rem === 0) setCooldownUntil(null);
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [cooldownUntil]);

  useEffect(() => {
    if (!limitWindowUntil) return undefined;
    const tick = () => {
      if (limitWindowUntil <= Date.now()) {
        resetWindowFlags();
        if (cooldownUntil && cooldownUntil <= Date.now()) setCooldownUntil(null);
      }
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, [cooldownUntil, limitWindowUntil, resetWindowFlags]);

  // Puzzle engines list
  const engines = useMemo(() => [
    'quickMath', 'numberLogic', 'memoryFlash', 'patternGrid',
    'oddOneOut', 'reaction', 'sequenceRecall', 'compare',
    'gridTap', 'rotateFit'
  ], []);

  const pickEngine = useCallback(() => {
    const available = engines.filter(e => !recentTypes.includes(e));
    const pool = available.length >= 3 ? available : engines;
    return pool[Math.floor(Math.random() * pool.length)];
  }, [engines, recentTypes]);

  // Start session
  const startSession = (learning = false) => {
    if (cooldownUntil) return;
    clearRoundTimers();
    setSessionStartIndex(0);
    setPuzzleIndex(0);
    setActiveSessionLimit(baseSessionLimit);
    setExtraGamesActive(false);
    setExtraGamesRemaining(0);
    setSessionScore({ correct: 0, coins: 0, perfect: true });
    setRecentTypes([]);
    setLuckySpinResult(null);
    setLuckySpinIndex(null);
    setLearnMode(learning);
    learnModeRef.current = learning;
    sessionEndedRef.current = false;
    setScreen('intro');
    scheduleRoundTimeout(() => nextPuzzle(0), 1500);
  };

  const nextPuzzle = (idx = puzzleIndex) => {
    clearRoundTimers();
    answeredRef.current = false;
    const type = pickEngine();
    setRecentTypes(prev => [type, ...prev].slice(0, 3));
    setPuzzleType(type);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setReactionTime(null);
    setCountdown(null);
    setTimerRunning(false);
    
    // Generate puzzle based on type
    if (type === 'quickMath') {
      setCurrentPuzzle(generateQuickMath());
      setMaxTime(12); setTimeLeft(12);
      setScreen('puzzle');
      beginAnswerTimer();
    } else if (type === 'numberLogic') {
      setCurrentPuzzle(generateNumberLogic());
      setMaxTime(15); setTimeLeft(15);
      setScreen('puzzle');
      beginAnswerTimer();
    } else if (type === 'oddOneOut') {
      setCurrentPuzzle(generateOddOneOut());
      setMaxTime(10); setTimeLeft(10);
      setScreen('puzzle');
      beginAnswerTimer();
    } else if (type === 'compare') {
      setCurrentPuzzle(generateCompare());
      setMaxTime(8); setTimeLeft(8);
      setScreen('puzzle');
      beginAnswerTimer();
    } else if (type === 'memoryFlash') {
      const nums = Array.from({length: 5}, () => Math.floor(Math.random() * 9) + 1);
      setMemoryFlash(nums);
      setMemoryPhase('show');
      setCurrentPuzzle({ type: 'memory', answer: nums.join('') });
      setMaxTime(15); setTimeLeft(15);
      setScreen('puzzle');
      scheduleRoundTimeout(() => {
        setMemoryPhase('recall');
        beginAnswerTimer();
      }, 3000);
    } else if (type === 'patternGrid') {
      const size = 3;
      const grid = Array.from({length: size*size}, () => Math.random() > 0.5);
      const missing = Math.floor(Math.random() * (size*size));
      setPatternGridData({ grid, missing, size });
      setGridPhase('show');
      setCurrentPuzzle({
        type: 'pattern',
        answer: grid[missing] ? 'Filled' : 'Empty',
        options: ['Filled', 'Empty'],
        trick: 'Visual Memory',
        explanation: `The highlighted cell was ${grid[missing] ? 'filled' : 'empty'} in the original pattern.`
      });
      setMaxTime(12); setTimeLeft(12);
      setScreen('puzzle');
      scheduleRoundTimeout(() => {
        setGridPhase('guess');
        beginAnswerTimer();
      }, 2500);
    } else if (type === 'reaction') {
      setCurrentPuzzle({ type: 'reaction' });
      setMaxTime(10); setTimeLeft(10);
      setCountdown(3);
      setScreen('puzzle');
      let c = 3;
      const ci = scheduleRoundInterval(() => {
        c--;
        if (c > 0) setCountdown(c);
        else {
          setCountdown('GO!');
          clearRoundInterval(ci);
          const delay = 500 + Math.random() * 2000;
          reactionTimeoutRef.current = scheduleRoundTimeout(() => {
            setReactionStart(Date.now());
            setCountdown('TAP!');
            beginAnswerTimer();
          }, delay);
        }
      }, 1000);
    } else if (type === 'sequenceRecall') {
      const len = 4;
      const seq = Array.from({length: len}, () => Math.floor(Math.random() * 4));
      setSequenceItems(seq);
      setSequenceIndex(0);
      setSequencePhase('show');
      setCurrentPuzzle({ type: 'sequence', answer: seq });
      setMaxTime(15); setTimeLeft(15);
      setScreen('puzzle');
      let i = 0;
      const showInterval = scheduleRoundInterval(() => {
        setSequenceIndex(i);
        i++;
        if (i > len) {
          clearRoundInterval(showInterval);
          setSequencePhase('input');
          setSequenceIndex(0);
          beginAnswerTimer();
        }
      }, 700);
    } else if (type === 'gridTap') {
      const count = 4;
      const items = [];
      const positions = new Set();
      while (items.length < count) {
        const p = Math.floor(Math.random() * 9);
        if (!positions.has(p)) {
          positions.add(p);
          items.push(p);
        }
      }
      setGridTapItems(items);
      setGridTapIndex(0);
      setGridTapPhase('show');
      setCurrentPuzzle({ type: 'gridTap', answer: items });
      setMaxTime(15); setTimeLeft(15);
      setScreen('puzzle');
      let i = 0;
      const gti = scheduleRoundInterval(() => {
        setGridTapIndex(i);
        i++;
        if (i > count) {
          clearRoundInterval(gti);
          setGridTapPhase('input');
          setGridTapIndex(0);
          beginAnswerTimer();
        }
      }, 800);
    } else if (type === 'rotateFit') {
      const target = [0, 90, 180, 270][Math.floor(Math.random() * 4)];
      setTargetRotation(target);
      setRotationAngle(0);
      setCurrentPuzzle({ type: 'rotate', answer: target });
      setMaxTime(12); setTimeLeft(12);
      setScreen('puzzle');
      beginAnswerTimer();
    }
  };

  const handleAnswer = (answer, timedOut = false) => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    clearRoundTimers();
    
    let correct = false;
    if (timedOut) {
      correct = false;
    } else if (puzzleType === 'reaction') {
      const rt = Date.now() - reactionStart;
      setReactionTime(rt);
      correct = rt < 1500;
      answer = `${rt}ms`;
    } else if (puzzleType === 'sequenceRecall' || puzzleType === 'gridTap') {
      correct = JSON.stringify(answer) === JSON.stringify(currentPuzzle.answer);
    } else if (puzzleType === 'rotateFit') {
      correct = rotationAngle === targetRotation;
      answer = `${rotationAngle}°`;
    } else {
      correct = String(answer) === String(currentPuzzle.answer);
    }
    
    setSelectedAnswer(answer ?? 'timeout');
    setIsCorrect(correct);
    
    const speedBonus = correct ? Math.max(0, Math.floor((timeLeft / maxTime) * 8)) : 0;
    const streakBonus = correct ? Math.min(streak * 3, 15) : 0;
    const coinChange = correct ? BASE_REWARD + speedBonus + streakBonus : -WRONG_PENALTY;
    
    setWalletCoins(c => Math.max(0, c + coinChange));
    if (coinChange > 0) awardCoins(coinChange);
    setCoinAnim({ value: coinChange, key: Date.now() });
    if (coinAnimTimeoutRef.current) clearTimeout(coinAnimTimeoutRef.current);
    coinAnimTimeoutRef.current = setTimeout(() => {
      setCoinAnim(null);
      coinAnimTimeoutRef.current = null;
    }, 1500);
    
    if (correct) {
      setStreak(s => {
        const ns = s + 1;
        setBestStreak(bs => Math.max(bs, ns));
        return ns;
      });
      setTotalWins(w => w + 1);
      setSessionScore(s => ({ ...s, correct: s.correct + 1, coins: s.coins + coinChange }));
    } else {
      setStreak(0);
      setSessionScore(s => ({ ...s, perfect: false, coins: s.coins + coinChange }));
    }

    if (extraGamesActive && puzzleIndex >= baseSessionLimit) {
      setExtraGamesRemaining(Math.max(0, maxSessionLimit - (puzzleIndex + 1)));
    }
    
    setScreen('feedback');
  };

  useEffect(() => {
    timeoutAnswerRef.current = () => handleAnswer(null, true);
  });

  useEffect(() => {
    if (!timerRunning || screen !== 'puzzle' || selectedAnswer !== null || learnMode) {
      stopAnswerTimer();
      return undefined;
    }

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(previous => {
        const next = Math.max(0, previous - 0.1);
        if (next <= 0) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setTimerRunning(false);
          scheduleRoundTimeout(() => timeoutAnswerRef.current?.(), 0);
        }
        return next;
      });
    }, 100);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [learnMode, scheduleRoundTimeout, screen, selectedAnswer, stopAnswerTimer, timerRunning]);

  const finishSessionAndStartCooldown = () => {
    if (sessionEndedRef.current) return;
    sessionEndedRef.current = true;
    const now = Date.now();
    const windowEnd = limitWindowUntil && limitWindowUntil > now
      ? limitWindowUntil
      : now + COOLDOWN_MS;
    setLimitWindowUntil(windowEnd);
    setCooldownUntil(windowEnd);
    setExtraGamesActive(false);
    setExtraGamesRemaining(0);
    if (!extraGamesActive && sessionScore.perfect && isCorrect) {
      setWalletCoins(c => c + PERFECT_SESSION_BONUS);
      awardCoins(PERFECT_SESSION_BONUS);
      if (!badges.includes('Perfect Session')) setBadges(b => [...b, 'Perfect Session']);
    }
    setScreen('sessionEnd');
  };

  const continueFromFeedback = () => {
    const next = puzzleIndex + 1;
    const finishedBaseRound = next >= baseSessionLimit && !extraGamesActive;
    if (finishedBaseRound && !extraGamesRedeemedThisWindow) {
      setScreen('extraChoice');
      return;
    }
    if (next >= activeSessionLimit) {
      finishSessionAndStartCooldown();
    } else {
      setPuzzleIndex(next);
      nextPuzzle(next);
    }
  };

  const redeemExtraGames = () => {
    if (redeemInProgressRef.current || walletCoins < EXTRA_GAMES_COST || extraGamesRedeemedThisWindow) return;
    redeemInProgressRef.current = true;
    const now = Date.now();
    const windowEnd = limitWindowUntil && limitWindowUntil > now
      ? limitWindowUntil
      : cooldownUntil && cooldownUntil > now
      ? cooldownUntil
      : now + COOLDOWN_MS;

    setLimitWindowUntil(windowEnd);
    setWalletCoins(c => Math.max(0, c - EXTRA_GAMES_COST));
    setExtraGamesRedeemedThisWindow(true);
    setExtraGamesActive(true);
    setExtraGamesRemaining(EXTRA_GAMES_LIMIT);
    setCooldownUntil(null);
    setCooldownRemaining(0);
    setSessionStartIndex(0);
    setActiveSessionLimit(maxSessionLimit);
    setPuzzleIndex(baseSessionLimit);
    sessionEndedRef.current = false;
    nextPuzzle(baseSessionLimit);

    window.setTimeout(() => {
      redeemInProgressRef.current = false;
    }, 0);
  };

  const formatCooldown = (ms) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  };

  const openLuckySpin = () => {
    setLuckySpinResult(null);
    setLuckySpinIndex(null);
    setScreen('spin');
  };

  const doLuckySpin = () => {
    if (spinning || spinUsedThisWindow) return;
    setSpinning(true);
    setLuckySpinResult(null);
    setLuckySpinIndex(null);
    const now = Date.now();
    if (!limitWindowUntil || limitWindowUntil <= now) {
      setLimitWindowUntil(now + COOLDOWN_MS);
    }
    setSpinUsedThisWindow(true);
    const rewardIndex = Math.floor(Math.random() * LUCKY_SPIN_REWARDS.length);
    const segmentAngle = 360 / LUCKY_SPIN_REWARDS.length;
    const rewardAngle = rewardIndex * segmentAngle + segmentAngle / 2;
    const nextRotation = spinRotation + (360 * 5) - rewardAngle;
    setSpinRotation(nextRotation);
    scheduleRoundTimeout(() => {
      const r = LUCKY_SPIN_REWARDS[rewardIndex];
      setLuckySpinResult(r);
      setLuckySpinIndex(rewardIndex);
      setWalletCoins(c => c + r);
      awardCoins(r);
      setSpinning(false);
    }, LUCKY_SPIN_DURATION_MS);
  };

  const useHint = () => {
    if (walletCoins < 15 || !currentPuzzle?.options) return;
    setWalletCoins(c => c - 15);
    // Mark hint used - for simplicity just reduce options visually via state (not implemented deeper)
  };

  const addTime = () => {
    if (walletCoins < 20) return;
    setWalletCoins(c => c - 20);
    setTimeLeft(t => Math.min(maxTime, t + 5));
    setMaxTime(m => m + 5);
  };

  const removeWrong = () => {
    if (walletCoins < 10 || !currentPuzzle?.options) return;
    setWalletCoins(c => c - 10);
    // For simplicity, we signal this state and let UI filter
    setCurrentPuzzle(p => ({
      ...p,
      options: p.options.filter(o => String(o) === String(p.answer) || Math.random() > 0.5).slice(0, 3)
    }));
  };

  // ============ UI RENDER ============
  return (
    <div className="skill-machine-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@700&display=swap');
        
        .skill-machine-root {
          --bg-0: #0a0618;
          --bg-1: #120826;
          --bg-2: #1a0f3d;
          --ink: #ffffff;
          --ink-muted: rgba(255,255,255,0.7);
          --ink-dim: rgba(255,255,255,0.45);
          --p1: #ff00aa;
          --p2: #00e5ff;
          --p3: #ffea00;
          --p4: #7c3aed;
          --p5: #10b981;
          --danger: #ff3366;
          --surface: rgba(255,255,255,0.06);
          --surface-2: rgba(255,255,255,0.1);
          --border: rgba(255,255,255,0.12);
          --glow-pink: 0 0 40px rgba(255,0,170,0.5);
          --glow-cyan: 0 0 40px rgba(0,229,255,0.5);
          --glow-yellow: 0 0 30px rgba(255,234,0,0.6);
          
          font-family: 'Plus Jakarta Sans', sans-serif;
          background: radial-gradient(ellipse at top left, #2a0845 0%, #0a0618 45%, #000 100%);
          min-height: 100vh;
          color: var(--ink);
          position: fixed;
          inset: 0;
          z-index: 1200;
          overflow-x: hidden;
          overflow-y: auto;
          padding: 0;
          -webkit-font-smoothing: antialiased;
        }
        
        .skill-machine-root::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image: 
            radial-gradient(circle at 20% 30%, rgba(255,0,170,0.15), transparent 40%),
            radial-gradient(circle at 80% 70%, rgba(0,229,255,0.12), transparent 40%),
            radial-gradient(circle at 50% 100%, rgba(124,58,237,0.15), transparent 50%);
          pointer-events: none;
          z-index: 0;
          animation: bgpulse 8s ease-in-out infinite alternate;
        }
        
        @keyframes bgpulse {
          from { opacity: 0.6; }
          to { opacity: 1; }
        }
        
        .sm-container {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: none;
          margin: 0;
          padding: 16px 8px 104px;
          min-height: 100vh;
        }

        .skill-modal-close {
          position: fixed;
          top: 14px;
          right: 14px;
          z-index: 5;
          width: 42px;
          height: 42px;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 12px;
          background: rgba(0,0,0,0.45);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 22px;
          font-weight: 800;
          line-height: 1;
          box-shadow: 0 12px 35px rgba(0,0,0,0.35);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }

        .skill-modal-close:hover {
          background: rgba(255,255,255,0.14);
        }
        
        /* ============ TOP BAR ============ */
        .top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          background: linear-gradient(135deg, rgba(255,0,170,0.15), rgba(124,58,237,0.15));
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid var(--border);
          border-radius: 20px;
          margin-bottom: 20px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1);
        }
        
        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 17px;
          letter-spacing: -0.5px;
        }
        
        .logo-icon {
          width: 36px; height: 36px;
          border-radius: 12px;
          background: linear-gradient(135deg, var(--p1), var(--p4));
          display: flex; align-items: center; justify-content: center;
          box-shadow: var(--glow-pink);
          animation: float 3s ease-in-out infinite;
        }
        
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        
        .coin-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #ffd700, #ff8800);
          padding: 8px 14px;
          border-radius: 999px;
          font-weight: 800;
          font-size: 15px;
          color: #1a0f00;
          box-shadow: 0 4px 20px rgba(255,170,0,0.4), inset 0 1px 0 rgba(255,255,255,0.5);
          position: relative;
        }
        
        .coin-badge svg { animation: spin 4s linear infinite; }
        
        @keyframes spin { to { transform: rotate(360deg); } }
        
        .coin-anim {
          position: absolute;
          right: 0;
          top: -30px;
          font-weight: 800;
          font-size: 18px;
          animation: coinFly 1.5s ease-out forwards;
          pointer-events: none;
          font-family: 'JetBrains Mono', monospace;
        }
        
        .coin-anim.positive { color: #ffea00; text-shadow: 0 0 15px #ffea00; }
        .coin-anim.negative { color: #ff3366; text-shadow: 0 0 15px #ff3366; }
        
        @keyframes coinFly {
          0% { transform: translateY(10px); opacity: 0; }
          30% { transform: translateY(-5px); opacity: 1; }
          100% { transform: translateY(-40px); opacity: 0; }
        }
        
        /* ============ HOME SCREEN ============ */
        .hero-card {
          background: linear-gradient(135deg, rgba(255,0,170,0.2), rgba(0,229,255,0.15));
          border: 1px solid rgba(255,255,255,0.15);
          border-radius: 28px;
          padding: 28px 24px;
          text-align: center;
          position: relative;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(255,0,170,0.15);
          margin-bottom: 20px;
        }
        
        .hero-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: conic-gradient(from 0deg, transparent, rgba(255,0,170,0.1), transparent 60%);
          animation: rotate 10s linear infinite;
        }
        
        @keyframes rotate { to { transform: rotate(360deg); } }
        
        .hero-title {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 32px;
          line-height: 1.05;
          letter-spacing: -1px;
          margin-bottom: 8px;
          position: relative;
          background: linear-gradient(135deg, #fff 0%, #ff00aa 50%, #00e5ff 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        
        .hero-sub {
          color: var(--ink-muted);
          font-size: 14px;
          margin-bottom: 20px;
          position: relative;
        }
        
        .play-btn {
          width: 100%;
          padding: 18px;
          background: linear-gradient(135deg, #ff00aa 0%, #7c3aed 100%);
          border: none;
          border-radius: 18px;
          color: white;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-weight: 800;
          font-size: 17px;
          letter-spacing: 0.3px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(255,0,170,0.4), inset 0 1px 0 rgba(255,255,255,0.2);
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        
        .play-btn:hover:not(:disabled) {
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 15px 40px rgba(255,0,170,0.6);
        }
        
        .play-btn:active:not(:disabled) { transform: translateY(0) scale(0.98); }
        
        .play-btn:disabled {
          background: rgba(255,255,255,0.1);
          cursor: not-allowed;
          box-shadow: none;
        }
        
        .play-btn::after {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
          animation: shimmer 3s infinite;
        }
        
        @keyframes shimmer { to { left: 100%; } }
        
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 20px;
        }
        
        .stat-card {
          background: var(--surface);
          backdrop-filter: blur(10px);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 14px 10px;
          text-align: center;
          transition: transform 0.2s;
        }
        
        .stat-card:hover { transform: translateY(-2px); }
        
        .stat-icon {
          width: 32px; height: 32px;
          margin: 0 auto 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
        }
        
        .stat-value {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 20px;
          line-height: 1;
        }
        
        .stat-label {
          font-size: 10px;
          color: var(--ink-dim);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-top: 4px;
        }
        
        .cooldown-card {
          background: linear-gradient(135deg, rgba(255,51,102,0.15), rgba(255,136,0,0.1));
          border: 1px solid rgba(255,51,102,0.3);
          border-radius: 20px;
          padding: 20px;
          margin-bottom: 16px;
          text-align: center;
        }
        
        .cooldown-time {
          font-family: 'JetBrains Mono', monospace;
          font-size: 32px;
          font-weight: 700;
          margin: 8px 0;
          color: #ff8800;
        }
        
        .modes-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 16px;
        }
        
        .mode-btn {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 16px;
          padding: 16px 12px;
          cursor: pointer;
          transition: all 0.2s;
          color: white;
          font-family: inherit;
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        
        .mode-btn:hover {
          transform: translateY(-2px);
          border-color: var(--p2);
          box-shadow: 0 8px 20px rgba(0,229,255,0.2);
        }
        
        .mode-btn-title {
          font-weight: 700;
          font-size: 14px;
          display: flex; align-items: center; gap: 6px;
        }
        
        .mode-btn-sub { font-size: 11px; color: var(--ink-dim); }
        
        .badges-section {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 20px;
          padding: 16px;
        }
        
        .badges-title {
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--ink-dim);
          margin-bottom: 10px;
          display: flex; align-items: center; gap: 6px;
        }
        
        .badge-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: linear-gradient(135deg, rgba(255,234,0,0.2), rgba(255,170,0,0.15));
          border: 1px solid rgba(255,234,0,0.3);
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          margin: 3px;
        }
        
        /* ============ PUZZLE SCREEN ============ */
        .puzzle-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }
        
        .puzzle-progress {
          display: flex;
          gap: 4px;
          flex: 1;
          margin-right: 12px;
        }
        
        .progress-dot {
          flex: 1;
          height: 6px;
          border-radius: 3px;
          background: rgba(255,255,255,0.1);
          transition: background 0.3s;
        }
        
        .progress-dot.done { background: linear-gradient(90deg, #10b981, #00e5ff); }
        .progress-dot.current { background: linear-gradient(90deg, #ff00aa, #ffea00); box-shadow: 0 0 10px #ff00aa; }
        
        .streak-chip {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          background: linear-gradient(135deg, #ff3366, #ff8800);
          border-radius: 999px;
          font-weight: 800;
          font-size: 13px;
          box-shadow: 0 0 15px rgba(255,51,102,0.5);
        }
        
        .timer-big {
          text-align: center;
          margin-bottom: 18px;
        }
        
        .timer-num {
          font-family: 'JetBrains Mono', monospace;
          font-weight: 700;
          font-size: 48px;
          line-height: 1;
          transition: color 0.3s;
        }
        
        .timer-num.green { color: #10b981; text-shadow: 0 0 20px rgba(16,185,129,0.5); }
        .timer-num.orange { color: #ff8800; text-shadow: 0 0 20px rgba(255,136,0,0.6); }
        .timer-num.red { color: #ff3366; text-shadow: 0 0 25px rgba(255,51,102,0.8); animation: pulse 0.5s infinite alternate; }
        
        @keyframes pulse { to { transform: scale(1.05); } }
        
        .timer-bar {
          height: 6px;
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
          overflow: hidden;
          margin-top: 8px;
        }
        
        .timer-fill {
          height: 100%;
          transition: width 0.1s linear, background 0.3s;
          border-radius: 3px;
        }
        
        .puzzle-card {
          background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
          backdrop-filter: blur(20px);
          border: 1px solid var(--border);
          border-radius: 24px;
          padding: 28px 20px;
          margin-bottom: 18px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1);
          min-height: 200px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        
        .puzzle-tag {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: rgba(0,229,255,0.15);
          border: 1px solid rgba(0,229,255,0.3);
          padding: 5px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #00e5ff;
          margin-bottom: 16px;
        }
        
        .puzzle-question {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 36px;
          line-height: 1.1;
          text-align: center;
          letter-spacing: -0.5px;
          margin-bottom: 8px;
        }
        
        .options-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        
        .option-btn {
          background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03));
          border: 2px solid var(--border);
          border-radius: 16px;
          padding: 18px;
          color: white;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 22px;
          cursor: pointer;
          transition: all 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
          overflow: hidden;
        }
        
        .option-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          border-color: var(--p2);
          background: linear-gradient(135deg, rgba(0,229,255,0.2), rgba(0,229,255,0.05));
          box-shadow: var(--glow-cyan);
        }
        
        .option-btn:active:not(:disabled) { transform: scale(0.96); }
        
        .option-btn.correct { 
          background: linear-gradient(135deg, #10b981, #059669);
          border-color: #10b981;
          box-shadow: 0 0 30px rgba(16,185,129,0.6);
          animation: correctPulse 0.5s;
        }
        
        .option-btn.wrong {
          background: linear-gradient(135deg, #ff3366, #dc2626);
          border-color: #ff3366;
          animation: shake 0.4s;
        }
        
        @keyframes correctPulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          75% { transform: translateX(6px); }
        }
        
        .power-ups {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
          margin-top: 14px;
        }
        
        .powerup-btn {
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 8px 4px;
          color: white;
          cursor: pointer;
          font-size: 10px;
          font-weight: 600;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
        }
        
        .powerup-btn:hover:not(:disabled) {
          background: rgba(255,234,0,0.15);
          border-color: rgba(255,234,0,0.4);
        }
        
        .powerup-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        
        .powerup-cost {
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px;
          color: #ffea00;
        }
        
        /* ============ MEMORY FLASH ============ */
        .memory-display {
          font-family: 'JetBrains Mono', monospace;
          font-size: 64px;
          font-weight: 700;
          letter-spacing: 8px;
          background: linear-gradient(135deg, #ff00aa, #00e5ff);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: memoryFocus 0.5s;
        }
        
        @keyframes memoryFocus {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        
        .memory-input {
          width: 100%;
          padding: 18px;
          background: rgba(255,255,255,0.05);
          border: 2px solid var(--border);
          border-radius: 16px;
          color: white;
          font-family: 'JetBrains Mono', monospace;
          font-size: 28px;
          font-weight: 700;
          text-align: center;
          letter-spacing: 8px;
          outline: none;
        }
        
        .memory-input:focus { border-color: var(--p2); box-shadow: var(--glow-cyan); }
        
        /* ============ PATTERN GRID ============ */
        .pattern-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          width: 220px;
        }
        
        .pattern-cell {
          aspect-ratio: 1;
          border-radius: 12px;
          background: rgba(255,255,255,0.08);
          border: 2px solid var(--border);
          transition: all 0.3s;
        }
        
        .pattern-cell.filled {
          background: linear-gradient(135deg, #ff00aa, #7c3aed);
          border-color: transparent;
          box-shadow: 0 0 15px rgba(255,0,170,0.4);
        }
        
        .pattern-cell.missing {
          background: rgba(255,234,0,0.1);
          border-color: #ffea00;
          border-style: dashed;
          animation: pulse2 1.5s infinite;
        }

        .pattern-answer-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          width: 100%;
          margin-top: 18px;
        }

        .pattern-answer-btn {
          background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.04));
          border: 2px solid var(--border);
          border-radius: 14px;
          padding: 14px;
          color: white;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 18px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.18s;
        }

        .pattern-answer-btn:hover {
          border-color: #ffea00;
          box-shadow: 0 0 22px rgba(255,234,0,0.32);
          transform: translateY(-2px);
        }
        
        @keyframes pulse2 {
          0%, 100% { box-shadow: 0 0 0 rgba(255,234,0,0.4); }
          50% { box-shadow: 0 0 20px rgba(255,234,0,0.6); }
        }
        
        /* ============ REACTION ============ */
        .reaction-display {
          width: 220px; height: 220px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 800;
          font-size: 42px;
          cursor: pointer;
          transition: all 0.3s;
          user-select: none;
        }
        
        .reaction-display.wait {
          background: radial-gradient(circle, #ff3366, #dc2626);
          box-shadow: 0 0 40px rgba(255,51,102,0.5);
        }
        
        .reaction-display.go {
          background: radial-gradient(circle, #10b981, #059669);
          box-shadow: 0 0 60px rgba(16,185,129,0.8);
          animation: gopulse 0.3s infinite alternate;
        }
        
        @keyframes gopulse {
          from { transform: scale(1); }
          to { transform: scale(1.08); }
        }
        
        /* ============ SEQUENCE ============ */
        .sequence-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          width: 240px;
        }
        
        .seq-btn {
          aspect-ratio: 1;
          border-radius: 20px;
          border: none;
          cursor: pointer;
          transition: all 0.15s;
          opacity: 0.4;
        }
        
        .seq-btn.active { opacity: 1; transform: scale(1.08); }
        .seq-btn.clickable { opacity: 0.9; cursor: pointer; }
        .seq-btn.clickable:hover { opacity: 1; transform: scale(1.05); }
        .seq-btn.clickable:active { transform: scale(0.95); }
        
        .seq-btn:nth-child(1) { background: linear-gradient(135deg, #ff00aa, #dc2626); }
        .seq-btn:nth-child(2) { background: linear-gradient(135deg, #00e5ff, #0891b2); }
        .seq-btn:nth-child(3) { background: linear-gradient(135deg, #ffea00, #d97706); }
        .seq-btn:nth-child(4) { background: linear-gradient(135deg, #10b981, #059669); }
        
        .seq-btn.active.active-1 { box-shadow: 0 0 30px #ff00aa; }
        .seq-btn.active.active-2 { box-shadow: 0 0 30px #00e5ff; }
        .seq-btn.active.active-3 { box-shadow: 0 0 30px #ffea00; }
        .seq-btn.active.active-4 { box-shadow: 0 0 30px #10b981; }
        
        /* ============ GRID TAP ============ */
        .gridtap-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          width: 260px;
        }
        
        .gridtap-cell {
          aspect-ratio: 1;
          background: rgba(255,255,255,0.06);
          border: 2px solid var(--border);
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 18px;
          color: white;
          position: relative;
        }
        
        .gridtap-cell.glow {
          background: linear-gradient(135deg, #ff00aa, #7c3aed);
          border-color: #ff00aa;
          box-shadow: 0 0 30px rgba(255,0,170,0.7);
          animation: glowPop 0.5s;
        }
        
        @keyframes glowPop {
          0% { transform: scale(1); }
          50% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        
        .gridtap-cell.tapped {
          background: linear-gradient(135deg, #10b981, #059669);
          border-color: #10b981;
        }
        
        .gridtap-cell:hover:not(.tapped) { background: rgba(255,255,255,0.1); }
        
        /* ============ ROTATE ============ */
        .rotate-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }
        
        .rotate-target {
          width: 120px; height: 120px;
          display: flex; align-items: center; justify-content: center;
          opacity: 0.4;
          border: 2px dashed rgba(255,255,255,0.3);
          border-radius: 16px;
        }
        
        .rotate-shape {
          width: 120px; height: 120px;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          background: linear-gradient(135deg, #ff00aa, #00e5ff);
          border-radius: 16px;
          position: relative;
        }
        
        .rotate-shape::after {
          content: '';
          position: absolute;
          top: 8px; left: 50%;
          transform: translateX(-50%);
          width: 20px; height: 20px;
          background: white;
          border-radius: 50%;
        }
        
        .rotate-btn {
          padding: 14px 24px;
          background: linear-gradient(135deg, #7c3aed, #ff00aa);
          border: none;
          border-radius: 14px;
          color: white;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 15px;
          box-shadow: 0 6px 20px rgba(124,58,237,0.4);
          transition: transform 0.2s;
        }
        
        .rotate-btn:hover { transform: scale(1.05); }
        
        /* ============ FEEDBACK ============ */
        .feedback-hero {
          text-align: center;
          padding: 30px 20px;
          background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
          border: 1px solid var(--border);
          border-radius: 28px;
          margin-bottom: 16px;
          position: relative;
          overflow: hidden;
        }
        
        .feedback-hero.correct { box-shadow: 0 0 60px rgba(16,185,129,0.3); border-color: rgba(16,185,129,0.4); }
        .feedback-hero.wrong { box-shadow: 0 0 40px rgba(255,51,102,0.2); border-color: rgba(255,51,102,0.3); }
        
        .feedback-icon {
          width: 90px; height: 90px;
          margin: 0 auto 14px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        
        @keyframes popIn {
          from { transform: scale(0) rotate(-180deg); opacity: 0; }
          to { transform: scale(1) rotate(0); opacity: 1; }
        }
        
        .feedback-icon.correct {
          background: linear-gradient(135deg, #10b981, #059669);
          box-shadow: 0 0 40px rgba(16,185,129,0.6);
        }
        
        .feedback-icon.wrong {
          background: linear-gradient(135deg, #ff3366, #dc2626);
          box-shadow: 0 0 30px rgba(255,51,102,0.5);
        }
        
        .feedback-title {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 32px;
          margin-bottom: 6px;
          letter-spacing: -0.5px;
        }
        
        .feedback-sub { color: var(--ink-muted); font-size: 14px; margin-bottom: 14px; }
        
        .feedback-reward {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, #ffd700, #ff8800);
          color: #1a0f00;
          padding: 10px 18px;
          border-radius: 999px;
          font-weight: 800;
          font-size: 18px;
          box-shadow: 0 8px 20px rgba(255,170,0,0.4);
        }
        
        .feedback-reward.negative {
          background: linear-gradient(135deg, #ff3366, #dc2626);
          color: white;
        }
        
        .learn-card {
          background: linear-gradient(135deg, rgba(255,234,0,0.12), rgba(255,170,0,0.06));
          border: 1px solid rgba(255,234,0,0.25);
          border-radius: 20px;
          padding: 18px;
          margin-bottom: 16px;
        }
        
        .learn-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 800;
          font-size: 13px;
          color: #ffea00;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }
        
        .learn-trick {
          font-weight: 700;
          font-size: 16px;
          margin-bottom: 4px;
        }
        
        .learn-explanation {
          color: var(--ink-muted);
          font-size: 14px;
          line-height: 1.5;
        }
        
        .next-btn {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #00e5ff, #7c3aed);
          border: none;
          border-radius: 16px;
          color: white;
          font-weight: 800;
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 10px 30px rgba(0,229,255,0.3);
          transition: transform 0.2s;
        }
        
        .next-btn:hover { transform: translateY(-2px); }
        .next-btn:active { transform: scale(0.98); }
        
        /* ============ INTRO ============ */
        .intro-screen {
          min-height: 60vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 20px;
        }
        
        .intro-big {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 64px;
          background: linear-gradient(135deg, #ff00aa, #ffea00, #00e5ff);
          background-size: 200% 200%;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: gradient 3s ease infinite;
          letter-spacing: -2px;
        }
        
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        /* ============ EXTRA CHOICE ============ */
        .extra-choice-card {
          background: linear-gradient(135deg, rgba(255,234,0,0.14), rgba(255,0,170,0.12), rgba(0,229,255,0.08));
          border: 1px solid rgba(255,234,0,0.28);
          border-radius: 28px;
          padding: 28px 22px;
          text-align: center;
          box-shadow: 0 20px 60px rgba(255,0,170,0.16);
          position: relative;
          overflow: hidden;
          margin-bottom: 16px;
        }

        .extra-choice-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 0%, rgba(255,234,0,0.28), transparent 55%);
          pointer-events: none;
        }

        .extra-choice-content {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
        }

        .extra-choice-icon {
          width: 82px;
          height: 82px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ffd700, #ff8800);
          color: #1a0f00;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 42px rgba(255,170,0,0.48);
        }

        .extra-choice-title {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 28px;
          font-weight: 800;
          line-height: 1.05;
          letter-spacing: -0.5px;
        }

        .extra-choice-sub {
          color: var(--ink-muted);
          font-size: 14px;
          line-height: 1.5;
        }

        .extra-choice-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          width: 100%;
        }

        .extra-choice-stat {
          background: rgba(0,0,0,0.26);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px;
          padding: 12px 8px;
        }

        .extra-choice-stat strong {
          display: block;
          color: #ffea00;
          font-family: 'Space Grotesk', sans-serif;
          font-size: 20px;
          line-height: 1;
        }

        .extra-choice-stat span {
          display: block;
          color: var(--ink-dim);
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-top: 5px;
        }

        .extra-choice-actions {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
          width: 100%;
          margin-top: 4px;
        }

        .extra-choice-note {
          color: #ffea00;
          font-size: 12px;
          font-weight: 800;
        }
        
        /* ============ SESSION END ============ */
        .session-end-card {
          background: linear-gradient(135deg, rgba(255,234,0,0.15), rgba(255,0,170,0.1));
          border: 1px solid rgba(255,234,0,0.3);
          border-radius: 28px;
          padding: 30px 24px;
          text-align: center;
          margin-bottom: 18px;
          position: relative;
          overflow: hidden;
        }
        
        .session-end-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 0%, rgba(255,234,0,0.3), transparent 60%);
        }
        
        .trophy-big {
          width: 100px; height: 100px;
          margin: 0 auto 16px;
          background: linear-gradient(135deg, #ffd700, #ff8800);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 60px rgba(255,170,0,0.6);
          animation: float 3s infinite ease-in-out;
          position: relative;
        }
        
        .session-stats {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
          margin-top: 16px;
          position: relative;
        }
        
        .session-stat {
          background: rgba(0,0,0,0.3);
          border-radius: 14px;
          padding: 12px 8px;
        }
        
        .session-stat-val {
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 800;
          font-size: 22px;
          color: #ffea00;
        }
        
        .session-stat-lbl {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--ink-dim);
        }
        
        /* ============ SPIN WHEEL ============ */
        .spin-wheel {
          width: 240px; height: 240px;
          margin: 0 auto 20px;
          position: relative;
        }
        
        .spin-wheel-inner {
          width: 100%; height: 100%;
          border-radius: 50%;
          position: relative;
          overflow: hidden;
          background: conic-gradient(
            #ff00aa 0deg 45deg,
            #00e5ff 45deg 90deg,
            #ffea00 90deg 135deg,
            #10b981 135deg 180deg,
            #7c3aed 180deg 225deg,
            #ff8800 225deg 270deg,
            #ff3366 270deg 315deg,
            #06b6d4 315deg 360deg
          );
          transition: transform 2.5s cubic-bezier(0.23, 1, 0.32, 1);
          box-shadow: 0 0 60px rgba(255,0,170,0.4), inset 0 0 40px rgba(0,0,0,0.3);
        }

        .spin-label {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 48px;
          height: 24px;
          margin: -12px 0 0 -24px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #1a0f00;
          background: rgba(255,255,255,0.82);
          border: 1px solid rgba(255,255,255,0.65);
          border-radius: 999px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          font-weight: 800;
          box-shadow: 0 5px 16px rgba(0,0,0,0.22);
          text-shadow: none;
        }

        .spin-label.winner {
          background: #ffea00;
          box-shadow: 0 0 22px rgba(255,234,0,0.85);
        }
        
        .spin-pointer {
          position: absolute;
          top: -10px; left: 50%;
          transform: translateX(-50%);
          width: 0; height: 0;
          border-left: 15px solid transparent;
          border-right: 15px solid transparent;
          border-top: 25px solid #ffea00;
          filter: drop-shadow(0 0 8px #ffea00);
          z-index: 2;
        }
        
        .spin-center {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 60px; height: 60px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 30px rgba(255,255,255,0.5);
        }
        
        /* Confetti */
        .confetti {
          position: absolute;
          width: 8px; height: 8px;
          top: 50%; left: 50%;
          animation: confetti 1.5s ease-out forwards;
          pointer-events: none;
        }
        
        @keyframes confetti {
          0% { transform: translate(-50%, -50%) rotate(0); opacity: 1; }
          100% { transform: translate(var(--x), var(--y)) rotate(720deg); opacity: 0; }
        }
        
        .back-btn {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--ink-muted);
          padding: 10px 16px;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
          transition: all 0.2s;
          display: flex; align-items: center; gap: 6px;
          font-family: inherit;
        }
        
        .back-btn:hover { background: var(--surface); color: white; }
        
        @media (max-width: 380px) {
          .hero-title { font-size: 26px; }
          .timer-num { font-size: 40px; }
          .puzzle-question { font-size: 28px; }
          .intro-big { font-size: 48px; }
        }
      `}</style>

      <button className="skill-modal-close" type="button" onClick={onClose} aria-label="Close Skill Machine">
        ×
      </button>

      <div className="sm-container" role="dialog" aria-modal="true" aria-label="Skill Machine">
        {/* TOP BAR */}
        <div className="top-bar">
          <div className="logo">
            <div className="logo-icon"><Brain size={20} /></div>
            <span>Skill Machine</span>
          </div>
          <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
            <button onClick={() => setSoundOn(s => !s)} style={{background:'none', border:'none', color:'white', cursor:'pointer', opacity: 0.7}}>
              {soundOn ? <Volume2 size={18}/> : <VolumeX size={18}/>}
            </button>
            <div className="coin-badge">
              <Coins size={16}/>
              <span>{Number(walletCoins || 0).toLocaleString('en-IN')}</span>
              {coinAnim && (
                <div key={coinAnim.key} className={`coin-anim ${coinAnim.value >= 0 ? 'positive' : 'negative'}`}>
                  {coinAnim.value >= 0 ? '+' : ''}{coinAnim.value}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* HOME */}
        {screen === 'home' && (
          <>
            <div className="hero-card">
              <h1 className="hero-title">Train Your Brain.<br/>Win Big Coins.</h1>
              <p className="hero-sub">{SESSION_LIMIT} puzzles · 10 unique engines · infinite learning</p>
              
              {cooldownRemaining > 0 ? (
                <div>
                  <div style={{color: 'var(--ink-muted)', fontSize: 13, marginBottom: 6}}>Next session in</div>
                  <div className="cooldown-time">{formatCooldown(cooldownRemaining)}</div>
                  <div style={{color: 'var(--ink-dim)', fontSize: 12}}>Extra games are offered after game {SESSION_LIMIT}.</div>
                </div>
              ) : (
                <button className="play-btn" onClick={() => startSession(false)}>
                  <Rocket size={20}/> Start Session · Earn coins
                </button>
              )}
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon" style={{background: 'rgba(255,51,102,0.2)'}}>
                  <Flame size={18} color="#ff3366"/>
                </div>
                <div className="stat-value">{bestStreak}</div>
                <div className="stat-label">Best Streak</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{background: 'rgba(0,229,255,0.2)'}}>
                  <Trophy size={18} color="#00e5ff"/>
                </div>
                <div className="stat-value">{totalWins}</div>
                <div className="stat-label">Total Wins</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{background: 'rgba(255,234,0,0.2)'}}>
                  <Star size={18} color="#ffea00"/>
                </div>
                <div className="stat-value">{badges.length}</div>
                <div className="stat-label">Badges</div>
              </div>
            </div>

            <div className="modes-row">
              <button className="mode-btn" onClick={() => startSession(true)}>
                <div className="mode-btn-title"><Lightbulb size={14} color="#ffea00"/> Learn Mode</div>
                <div className="mode-btn-sub">No timer. Pure practice.</div>
              </button>
              <button className="mode-btn" onClick={openLuckySpin}>
                <div className="mode-btn-title"><Gift size={14} color="#ff00aa"/> Lucky Spin</div>
                <div className="mode-btn-sub">Win up to 200 coins</div>
              </button>
            </div>

            <div className="badges-section">
              <div className="badges-title"><Award size={14}/> Achievements</div>
              {badges.length === 0 ? (
                <div style={{color: 'var(--ink-dim)', fontSize: 13}}>Play to unlock badges!</div>
              ) : (
                <div>
                  {badges.map(b => (
                    <span key={b} className="badge-chip">
                      <Crown size={12}/> {b}
                    </span>
                  ))}
                </div>
              )}
              {bestStreak >= 5 && !badges.includes('Speed Thinker') && (
                <span className="badge-chip"><Zap size={12}/> Speed Thinker</span>
              )}
              {totalWins >= 10 && (
                <span className="badge-chip"><Brain size={12}/> Memory Master</span>
              )}
              {totalWins >= 25 && (
                <span className="badge-chip"><Puzzle size={12}/> Pattern Genius</span>
              )}
            </div>
          </>
        )}

        {/* INTRO */}
        {screen === 'intro' && (
          <div className="intro-screen">
            <div style={{fontSize: 16, color: 'var(--ink-muted)'}}>Get Ready</div>
            <div className="intro-big">3... 2... 1...</div>
            <div style={{fontSize: 14, color: 'var(--ink-dim)'}}>Focus your mind 🧠</div>
          </div>
        )}

        {/* PUZZLE */}
        {screen === 'puzzle' && currentPuzzle && (
          <>
            <div className="puzzle-header">
              <button className="back-btn" onClick={() => { clearRoundTimers(); setScreen('home'); }}>
                <Home size={14}/>
              </button>
              <div className="puzzle-progress">
                {Array.from({ length: activeSessionLimit }, (_, i) => (
                  <div 
                    key={i} 
                    className={`progress-dot ${i < puzzleIndex ? 'done' : i === puzzleIndex ? 'current' : ''}`}
                  />
                ))}
              </div>
              {streak > 0 && (
                <div className="streak-chip">
                  <Flame size={14}/> {streak}
                </div>
              )}
            </div>

            <div className="timer-big">
              <div className={`timer-num ${timeLeft > maxTime*0.5 ? 'green' : timeLeft > maxTime*0.25 ? 'orange' : 'red'}`}>
                {Math.max(0, Math.ceil(timeLeft))}
              </div>
              <div className="timer-bar">
                <div 
                  className="timer-fill"
                  style={{
                    width: `${(timeLeft/maxTime) * 100}%`,
                    background: timeLeft > maxTime*0.5 
                      ? 'linear-gradient(90deg, #10b981, #00e5ff)' 
                      : timeLeft > maxTime*0.25 
                      ? 'linear-gradient(90deg, #ff8800, #ffea00)'
                      : 'linear-gradient(90deg, #ff3366, #dc2626)'
                  }}
                />
              </div>
            </div>

            <div className="puzzle-card">
              <div className="puzzle-tag">
                {puzzleType === 'quickMath' && <><Sigma size={12}/> Quick Math</>}
                {puzzleType === 'numberLogic' && <><Hash size={12}/> Number Logic</>}
                {puzzleType === 'memoryFlash' && <><Eye size={12}/> Memory Flash</>}
                {puzzleType === 'patternGrid' && <><Grid3x3 size={12}/> Pattern Grid</>}
                {puzzleType === 'oddOneOut' && <><Shuffle size={12}/> Odd One Out</>}
                {puzzleType === 'reaction' && <><Zap size={12}/> Reaction</>}
                {puzzleType === 'sequenceRecall' && <><Activity size={12}/> Sequence Recall</>}
                {puzzleType === 'compare' && <><Equal size={12}/> Compare</>}
                {puzzleType === 'gridTap' && <><MousePointerClick size={12}/> Grid Tap</>}
                {puzzleType === 'rotateFit' && <><RotateCw size={12}/> Rotate & Fit</>}
              </div>

              {/* QUICK MATH, NUMBER LOGIC, ODD ONE OUT, COMPARE */}
              {(puzzleType === 'quickMath' || puzzleType === 'numberLogic' || puzzleType === 'compare') && (
                <div className="puzzle-question">{currentPuzzle.question}</div>
              )}

              {puzzleType === 'oddOneOut' && (
                <>
                  <div style={{fontSize: 16, color: 'var(--ink-muted)', marginBottom: 12}}>{currentPuzzle.question}</div>
                </>
              )}

              {/* MEMORY FLASH */}
              {puzzleType === 'memoryFlash' && (
                <>
                  {memoryPhase === 'show' ? (
                    <>
                      <div style={{fontSize: 14, color: 'var(--ink-muted)', marginBottom: 12}}>Memorize this number</div>
                      <div className="memory-display">{memoryFlash?.join('')}</div>
                    </>
                  ) : (
                    <>
                      <div style={{fontSize: 16, color: 'var(--ink-muted)', marginBottom: 12}}>Type what you saw</div>
                      <input 
                        className="memory-input"
                        autoFocus
                        maxLength={memoryFlash?.length}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleAnswer(e.target.value);
                        }}
                        onChange={(e) => {
                          if (e.target.value.length === memoryFlash?.length) {
                            scheduleRoundTimeout(() => handleAnswer(e.target.value), 200);
                          }
                        }}
                      />
                    </>
                  )}
                </>
              )}

              {/* PATTERN GRID */}
              {puzzleType === 'patternGrid' && patternGridData && (
                <>
                  <div style={{fontSize: 14, color: 'var(--ink-muted)', marginBottom: 14}}>
                    {gridPhase === 'show' ? 'Study the full pattern' : 'Was the highlighted cell filled or empty?'}
                  </div>
                  <div className="pattern-grid">
                    {patternGridData.grid.map((cell, i) => (
                      <div 
                        key={i}
                        className={`pattern-cell ${cell && (gridPhase === 'show' || i !== patternGridData.missing) ? 'filled' : ''} ${gridPhase === 'guess' && i === patternGridData.missing ? 'missing' : ''}`}
                      />
                    ))}
                  </div>
                  {gridPhase === 'guess' && (
                    <div className="pattern-answer-row">
                      <button className="pattern-answer-btn" onClick={() => handleAnswer('Filled')}>
                        Filled
                      </button>
                      <button className="pattern-answer-btn" onClick={() => handleAnswer('Empty')}>
                        Empty
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* REACTION */}
              {puzzleType === 'reaction' && (
                <div 
                  className={`reaction-display ${countdown === 'TAP!' ? 'go' : 'wait'}`}
                  onClick={() => {
                    if (countdown === 'TAP!') handleAnswer('tapped');
                    else if (typeof countdown === 'number' || countdown === 'GO!') {
                      // too early - treat as wrong
                      if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
                      handleAnswer('early', true);
                    }
                  }}
                >
                  {countdown}
                </div>
              )}

              {/* SEQUENCE RECALL */}
              {puzzleType === 'sequenceRecall' && (
                <>
                  <div style={{fontSize: 14, color: 'var(--ink-muted)', marginBottom: 14}}>
                    {sequencePhase === 'show' ? 'Watch the sequence' : `Repeat it (${sequenceIndex}/${sequenceItems.length})`}
                  </div>
                  <div className="sequence-grid">
                    {[0,1,2,3].map(i => (
                      <button
                        key={i}
                        className={`seq-btn ${sequencePhase === 'show' && sequenceItems[sequenceIndex] === i ? `active active-${i+1}` : ''} ${sequencePhase === 'input' ? 'clickable' : ''}`}
                        onClick={() => {
                          if (sequencePhase === 'input') {
                            const newIdx = sequenceIndex + 1;
                            if (sequenceItems[sequenceIndex] === i) {
                              if (newIdx >= sequenceItems.length) {
                                handleAnswer(sequenceItems);
                              } else {
                                setSequenceIndex(newIdx);
                              }
                            } else {
                              handleAnswer([...sequenceItems.slice(0, sequenceIndex), i]);
                            }
                          }
                        }}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* GRID TAP */}
              {puzzleType === 'gridTap' && (
                <>
                  <div style={{fontSize: 14, color: 'var(--ink-muted)', marginBottom: 14}}>
                    {gridTapPhase === 'show' ? `Memorize cells (${gridTapIndex + 1}/${gridTapItems.length})` : `Tap in order (${gridTapIndex}/${gridTapItems.length})`}
                  </div>
                  <div className="gridtap-grid">
                    {[0,1,2,3,4,5,6,7,8].map(i => {
                      const showGlow = gridTapPhase === 'show' && gridTapItems[gridTapIndex] === i;
                      const tappedIdx = gridTapPhase === 'input' ? gridTapItems.slice(0, gridTapIndex).indexOf(i) : -1;
                      return (
                        <div
                          key={i}
                          className={`gridtap-cell ${showGlow ? 'glow' : ''} ${tappedIdx >= 0 ? 'tapped' : ''}`}
                          onClick={() => {
                            if (gridTapPhase === 'input') {
                              if (gridTapItems[gridTapIndex] === i) {
                                const newIdx = gridTapIndex + 1;
                                if (newIdx >= gridTapItems.length) {
                                  handleAnswer(gridTapItems);
                                } else {
                                  setGridTapIndex(newIdx);
                                }
                              } else {
                                handleAnswer([...gridTapItems.slice(0, gridTapIndex), i]);
                              }
                            }
                          }}
                        >
                          {tappedIdx >= 0 ? tappedIdx + 1 : ''}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* ROTATE FIT */}
              {puzzleType === 'rotateFit' && (
                <div className="rotate-container">
                  <div style={{fontSize: 14, color: 'var(--ink-muted)'}}>Rotate to match the target</div>
                  <div style={{display: 'flex', gap: 20, alignItems: 'center'}}>
                    <div>
                      <div style={{fontSize: 10, color: 'var(--ink-dim)', textAlign: 'center', marginBottom: 6}}>TARGET</div>
                      <div className="rotate-target">
                        <div style={{width: '100%', height: '100%', transform: `rotate(${targetRotation}deg)`, transition: 'transform 0.4s'}}>
                          <div style={{width: '100%', height: '100%', background: 'rgba(255,255,255,0.15)', borderRadius: 16, position: 'relative'}}>
                            <div style={{position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', width: 20, height: 20, background: 'rgba(255,255,255,0.5)', borderRadius: '50%'}}/>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div style={{fontSize: 10, color: 'var(--ink-dim)', textAlign: 'center', marginBottom: 6}}>YOURS</div>
                      <div style={{width: 120, height: 120}}>
                        <div className="rotate-shape" style={{transform: `rotate(${rotationAngle}deg)`}}/>
                      </div>
                    </div>
                  </div>
                  <div style={{display: 'flex', gap: 10}}>
                    <button className="rotate-btn" onClick={() => setRotationAngle(a => (a + 90) % 360)}>
                      <RotateCw size={16}/> Rotate 90°
                    </button>
                    <button className="rotate-btn" style={{background: 'linear-gradient(135deg, #10b981, #059669)'}} onClick={() => handleAnswer(rotationAngle)}>
                      <Check size={16}/> Confirm
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* OPTIONS */}
            {currentPuzzle.options && ['quickMath','numberLogic','oddOneOut','compare'].includes(puzzleType) && (
              <div className="options-grid">
                {currentPuzzle.options.map((opt, i) => (
                  <button
                    key={i}
                    className={`option-btn ${selectedAnswer === opt ? (isCorrect ? 'correct' : 'wrong') : ''}`}
                    onClick={() => handleAnswer(opt)}
                    disabled={selectedAnswer !== null}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {/* POWER-UPS */}
            {currentPuzzle.options && selectedAnswer === null && (
              <div className="power-ups">
                <button className="powerup-btn" onClick={removeWrong} disabled={walletCoins < 10}>
                  <Shuffle size={14}/>
                  <span>Remove</span>
                  <span className="powerup-cost">10</span>
                </button>
                <button className="powerup-btn" onClick={addTime} disabled={walletCoins < 20}>
                  <Clock size={14}/>
                  <span>+5 sec</span>
                  <span className="powerup-cost">20</span>
                </button>
                <button className="powerup-btn" onClick={useHint} disabled={walletCoins < 15}>
                  <Lightbulb size={14}/>
                  <span>Hint</span>
                  <span className="powerup-cost">15</span>
                </button>
                <button className="powerup-btn" disabled={streak === 0 || walletCoins < 20}>
                  <Heart size={14}/>
                  <span>Revive</span>
                  <span className="powerup-cost">20</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* FEEDBACK */}
        {screen === 'feedback' && currentPuzzle && (
          <>
            <div className={`feedback-hero ${isCorrect ? 'correct' : 'wrong'}`}>
              <div className={`feedback-icon ${isCorrect ? 'correct' : 'wrong'}`}>
                {isCorrect ? <Check size={44} strokeWidth={3}/> : <X size={44} strokeWidth={3}/>}
              </div>
              <div className="feedback-title">
                {isCorrect 
                  ? (streak >= 3 ? '🔥 On Fire!' : 'Correct!') 
                  : 'Not quite'}
              </div>
              <div className="feedback-sub">
                {isCorrect 
                  ? (reactionTime ? `Reaction: ${reactionTime}ms` : `Answer: ${currentPuzzle.answer}`) 
                  : `Answer: ${currentPuzzle.answer}`}
              </div>
              <div className={`feedback-reward ${!isCorrect ? 'negative' : ''}`}>
                <Coins size={18}/>
                {isCorrect ? '+' : ''}{sessionScore.coins - (sessionScore.coins - (coinAnim?.value ?? 0))}
                {isCorrect && streak >= 2 && ` · ${streak}x streak!`}
              </div>
            </div>

            {currentPuzzle.explanation && (
              <div className="learn-card">
                <div className="learn-label">
                  <Lightbulb size={14}/> Learn · {currentPuzzle.trick || 'Tip'}
                </div>
                <div className="learn-explanation">{currentPuzzle.explanation}</div>
              </div>
            )}

            <button className="next-btn" onClick={continueFromFeedback}>
              {puzzleIndex + 1 >= activeSessionLimit ? 'Finish Session' : `Next Puzzle (${puzzleIndex + 2}/${activeSessionLimit})`} <ChevronRight size={18}/>
            </button>
          </>
        )}

        {/* EXTRA GAMES CHOICE */}
        {screen === 'extraChoice' && (
          <>
            <div className="extra-choice-card">
              <div className="extra-choice-content">
                <div className="extra-choice-icon">
                  <Trophy size={42}/>
                </div>
                <div>
                  <div className="extra-choice-title">Normal Round Complete</div>
                  <div className="extra-choice-sub">
                    You finished {baseSessionLimit} games. Wait for the next window, or redeem coins to keep the run alive for {EXTRA_GAMES_LIMIT} more games.
                  </div>
                </div>

                <div className="extra-choice-stats">
                  <div className="extra-choice-stat">
                    <strong>{sessionScore.correct}/{baseSessionLimit}</strong>
                    <span>Correct</span>
                  </div>
                  <div className="extra-choice-stat">
                    <strong>{Number(walletCoins || 0).toLocaleString('en-IN')}</strong>
                    <span>Coins</span>
                  </div>
                  <div className="extra-choice-stat">
                    <strong>{EXTRA_GAMES_COST}</strong>
                    <span>Cost</span>
                  </div>
                </div>

                <div className="extra-choice-note">
                  Unlocks games {baseSessionLimit + 1} and {maxSessionLimit}
                </div>
              </div>
            </div>

            <div className="extra-choice-actions">
              <button
                className="next-btn"
                onClick={redeemExtraGames}
                disabled={walletCoins < EXTRA_GAMES_COST || extraGamesRedeemedThisWindow}
                style={walletCoins < EXTRA_GAMES_COST || extraGamesRedeemedThisWindow ? {opacity: 0.55, cursor: 'not-allowed'} : undefined}
              >
                <Rocket size={18}/> Redeem {EXTRA_GAMES_COST} coins · Play {EXTRA_GAMES_LIMIT} more
              </button>
              {walletCoins < EXTRA_GAMES_COST && (
                <div style={{textAlign: 'center', color: '#ffea00', fontSize: 12, fontWeight: 800}}>
                  Need {EXTRA_GAMES_COST} coins
                </div>
              )}
              <button className="back-btn" onClick={finishSessionAndStartCooldown} style={{width:'100%', justifyContent:'center', padding: 14}}>
                <Clock size={14}/> Wait for next window
              </button>
            </div>
          </>
        )}

        {/* SESSION END */}
        {screen === 'sessionEnd' && (
          <>
            <div className="session-end-card">
              <div className="trophy-big">
                <Trophy size={50} color="#1a0f00"/>
              </div>
              <div style={{fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 28, letterSpacing: -0.5}}>
                Session Complete!
              </div>
              <div style={{color: 'var(--ink-muted)', fontSize: 14, marginTop: 6}}>
                {sessionStartIndex === 0 && activeSessionLimit === baseSessionLimit && sessionScore.perfect ? `Perfect Run Bonus: +${PERFECT_SESSION_BONUS} coins` : 'Great effort!'}
              </div>
              <div className="session-stats">
                <div className="session-stat">
                  <div className="session-stat-val">{sessionScore.correct}/{gamesInCurrentRun}</div>
                  <div className="session-stat-lbl">Correct</div>
                </div>
                <div className="session-stat">
                  <div className="session-stat-val">{bestStreak}</div>
                  <div className="session-stat-lbl">Best Streak</div>
                </div>
                <div className="session-stat">
                  <div className="session-stat-val">{sessionScore.coins + (sessionStartIndex === 0 && activeSessionLimit === baseSessionLimit && sessionScore.perfect ? PERFECT_SESSION_BONUS : 0) >= 0 ? '+' : ''}{sessionScore.coins + (sessionStartIndex === 0 && activeSessionLimit === baseSessionLimit && sessionScore.perfect ? PERFECT_SESSION_BONUS : 0)}</div>
                  <div className="session-stat-lbl">Coins</div>
                </div>
              </div>
            </div>

            <button className="next-btn" onClick={openLuckySpin} style={{marginBottom: 10}}>
              <Gift size={18}/> Lucky Spin Bonus
            </button>
            <button className="back-btn" onClick={() => setScreen('home')} style={{width:'100%', justifyContent:'center', padding: 14}}>
              <Home size={14}/> Back Home
            </button>
          </>
        )}

        {/* SPIN */}
        {screen === 'spin' && (
          <>
            <div style={{textAlign: 'center', marginBottom: 20}}>
              <div className="hero-title" style={{fontSize: 28, marginTop: 10}}>Lucky Spin</div>
              <div style={{color: 'var(--ink-muted)', fontSize: 14, marginTop: 4}}>Spin to win up to 200 coins</div>
            </div>
            <div className="spin-wheel">
              <div className="spin-pointer"/>
              <div
                className="spin-wheel-inner"
                style={{ transform: `rotate(${spinRotation}deg)` }}
              >
                {LUCKY_SPIN_REWARDS.map((reward, index) => {
                  const segmentAngle = 360 / LUCKY_SPIN_REWARDS.length;
                  const angle = index * segmentAngle + segmentAngle / 2;
                  return (
                    <div
                      key={reward}
                      className={`spin-label ${luckySpinIndex === index ? 'winner' : ''}`}
                      style={{
                        transform: `rotate(${angle}deg) translateY(-84px) rotate(-${angle}deg)`
                      }}
                    >
                      +{reward}
                    </div>
                  );
                })}
              </div>
              <div className="spin-center">
                <Gem size={24} color="#ff00aa"/>
              </div>
            </div>
            {luckySpinResult !== null ? (
              <>
                <div style={{textAlign: 'center', fontSize: 32, fontFamily: 'Space Grotesk', fontWeight: 700, marginBottom: 16, color: '#ffea00'}}>
                  You won +{luckySpinResult} coins
                </div>
                <button className="back-btn" onClick={() => setScreen('home')} style={{width:'100%', justifyContent:'center', padding: 14}}>
                  <Home size={14}/> Back Home
                </button>
              </>
            ) : spinUsedThisWindow && !spinning ? (
              <>
                <div style={{textAlign: 'center', fontSize: 16, fontWeight: 800, marginBottom: 16, color: 'var(--ink-muted)'}}>
                  Spin used for this session window
                </div>
                <button className="back-btn" onClick={() => setScreen('home')} style={{width:'100%', justifyContent:'center', padding: 14}}>
                  <Home size={14}/> Back Home
                </button>
              </>
            ) : (
              <button className="play-btn" onClick={doLuckySpin} disabled={spinning || spinUsedThisWindow}>
                {spinning ? <><Sparkles size={18}/> Spinning...</> : <><Rocket size={18}/> Spin Now</>}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
