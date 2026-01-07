import React, { useState, useEffect, useRef } from 'react';

const TsumTsumPuzzle = () => {
  const canvasRef = useRef(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  
  // ゲーム設定
  const COLS = 6;
  const ROWS = 8;
  
  // 臓器画像のパス
  const ORGAN_IMAGES = [
    '/images/heart_organ.png',    // 0: 心臓
    '/images/brain_organ.png',    // 1: 脳
    '/images/lung_organ.png',     // 2: 肺
    '/images/kidney_organ.png',   // 3: 腎臓
    '/images/liver_organ.png',    // 4: 肝臓
    '/images/bone_organ.png'      // 5: 骨
  ];
  
  const COLORS = ['#FF9AA2', '#FFB7B2', '#FFDAC1', '#E2F0CB', '#B5EAD7', '#C7CEEA'];
  const COLOR_NAMES = ['心臓', '脳', '肺', '腎臓', '肝臓', '骨'];
  
  // ゲーム状態
  const gameStateRef = useRef({
    grid: [],
    selectedCells: [],
    isDrawing: false,
    lastCell: null,
    cellSize: 0,
    offsetX: 0,
    offsetY: 0,
    particles: [], // パーティクル用
    wobbleTimers: [], // 各ブロックの揺れタイマー
    organImages: [] // 臓器画像オブジェクト
  });

  // 画像の事前ロード
  useEffect(() => {
    const loadImages = async () => {
      console.log('Loading images...');
      const images = [];
      let loadedCount = 0;
      
      ORGAN_IMAGES.forEach((src, index) => {
        const img = new Image();
        
        img.onload = () => {
          console.log(`Image ${index} loaded: ${src}`);
          loadedCount++;
          if (loadedCount === ORGAN_IMAGES.length) {
            console.log('All images loaded!');
            gameStateRef.current.organImages = images;
            setImagesLoaded(true);
          }
        };
        
        img.onerror = (error) => {
          console.error(`Failed to load image ${index}: ${src}`, error);
          loadedCount++;
          if (loadedCount === ORGAN_IMAGES.length) {
            console.log('All images processed (some may have failed)');
            gameStateRef.current.organImages = images;
            setImagesLoaded(true);
          }
        };
        
        images[index] = img;
        img.src = src; // srcの設定は最後に
      });
    };
    
    loadImages();
  }, []);

  // グリッド初期化（繋げやすい配置）
  const initGrid = () => {
    const grid = [];
    const wobbleTimers = [];
    
    // まず全部ランダムで埋める
    for (let row = 0; row < ROWS; row++) {
      grid[row] = [];
      wobbleTimers[row] = [];
      for (let col = 0; col < COLS; col++) {
        grid[row][col] = {
          color: Math.floor(Math.random() * COLORS.length),
          selected: false
        };
        // 各ブロックにランダムな揺れタイミングを設定
        wobbleTimers[row][col] = {
          wobble: 0,
          nextWobble: Math.random() * 8000 + 5000, // 5-13秒後に揺れる（より長い間隔）
          lastUpdate: Date.now()
        };
      }
    }
    
    // 繋がりやすくするための調整
    // ランダムな場所に「意図的なグループ」を作る
    const numGroups = 3 + Math.floor(Math.random() * 3); // 3-5グループ
    
    for (let i = 0; i < numGroups; i++) {
      const startRow = Math.floor(Math.random() * (ROWS - 2));
      const startCol = Math.floor(Math.random() * (COLS - 2));
      const color = Math.floor(Math.random() * COLORS.length);
      const groupSize = 3 + Math.floor(Math.random() * 2); // 3-4個
      
      // ランダムな形でグループを作る
      const positions = [[startRow, startCol]];
      grid[startRow][startCol].color = color;
      
      for (let j = 1; j < groupSize; j++) {
        const lastPos = positions[positions.length - 1];
        const neighbors = [
          [lastPos[0] - 1, lastPos[1]],
          [lastPos[0] + 1, lastPos[1]],
          [lastPos[0], lastPos[1] - 1],
          [lastPos[0], lastPos[1] + 1]
        ];
        
        // 有効な隣接セルを探す
        const validNeighbors = neighbors.filter(([r, c]) => 
          r >= 0 && r < ROWS && c >= 0 && c < COLS &&
          !positions.some(([pr, pc]) => pr === r && pc === c)
        );
        
        if (validNeighbors.length > 0) {
          const nextPos = validNeighbors[Math.floor(Math.random() * validNeighbors.length)];
          positions.push(nextPos);
          grid[nextPos[0]][nextPos[1]].color = color;
        }
      }
    }
    
    gameStateRef.current.wobbleTimers = wobbleTimers;
    return grid;
  };

  // ゲーム開始
  const startGame = () => {
    gameStateRef.current.grid = initGrid();
    setScore(0);
    setCombo(0);
    setTimeLeft(60);
    setIsPlaying(true);
    setGameOver(false);
    setIsPaused(false);
    drawGame();
  };

  // 一時停止
  const pauseGame = () => {
    setIsPaused(true);
  };

  // 再開
  const resumeGame = () => {
    setIsPaused(false);
  };

  // ゲーム終了
  const quitGame = () => {
    setIsPlaying(false);
    setIsPaused(false);
    gameStateRef.current.grid = [];
  };

  // シャッフル
  const shuffleGrid = () => {
    if (!isPlaying || isPaused) return;
    
    const { grid } = gameStateRef.current;
    const colors = [];
    
    // 全ての色を収集
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        colors.push(grid[row][col].color);
      }
    }
    
    // シャッフル
    for (let i = colors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [colors[i], colors[j]] = [colors[j], colors[i]];
    }
    
    // 再配置
    let index = 0;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        grid[row][col].color = colors[index++];
      }
    }
    
    drawGame();
  };

  // タイマー
  useEffect(() => {
    if (!isPlaying || gameOver || isPaused) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsPlaying(false);
          setGameOver(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isPlaying, gameOver, isPaused]);

  // キャンバス描画
  const drawGame = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // 可愛い背景グラデーション
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#FFE5E5');
    gradient.addColorStop(0.5, '#FFF0F5');
    gradient.addColorStop(1, '#E8F5FF');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // グリッドが空なら背景だけ描画して終了
    const grid = gameStateRef.current.grid;
    if (!grid || grid.length === 0) {
      return;
    }
    
    // 背景のキラキラ模様
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for (let i = 0; i < 20; i++) {
      const x = (Math.sin(Date.now() / 1000 + i) * 0.5 + 0.5) * width;
      const y = ((Date.now() / 2000 + i * 0.3) % 1) * height;
      const size = 3 + Math.sin(Date.now() / 500 + i) * 2;
      
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // セルサイズ計算（画面いっぱいに）
    const cellSize = Math.min(
      (width - 40) / COLS,
      (height - 140) / ROWS  // 200 → 140 に変更（上下の余白を小さく）
    );
    gameStateRef.current.cellSize = cellSize;
    
    // グリッド中央配置
    const gridWidth = cellSize * COLS;
    const gridHeight = cellSize * ROWS;
    const offsetX = (width - gridWidth) / 2;
    const offsetY = 50;  // 100 → 50 に変更（上部余白を小さく）
    gameStateRef.current.offsetX = offsetX;
    gameStateRef.current.offsetY = offsetY;
    
    // 現在時刻
    const now = Date.now();
    
    // グリッド描画
    const wobbleTimers = gameStateRef.current.wobbleTimers;
    
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const cell = grid[row][col];
        const x = offsetX + col * cellSize;
        const y = offsetY + row * cellSize;
        
        // 揺れの計算
        let wobbleX = 0;
        let wobbleY = 0;
        let scale = 1;
        
        if (wobbleTimers[row] && wobbleTimers[row][col]) {
          const timer = wobbleTimers[row][col];
          const elapsed = now - timer.lastUpdate;
          
          // 揺れタイミングになったら揺れ開始
          if (elapsed > timer.nextWobble && timer.wobble === 0) {
            timer.wobble = 1;
            timer.lastUpdate = now;
          }
          
          // 揺れ中
          if (timer.wobble > 0) {
            const wobbleProgress = (now - timer.lastUpdate) / 800; // 0.8秒かけてゆっくり揺れる
            
            if (wobbleProgress < 1) {
              // イージング関数（柔らかい動き）
              const easeOut = 1 - Math.pow(1 - wobbleProgress, 3);
              const damping = 1 - wobbleProgress; // 減衰
              
              // ぷるぷる揺れ（周波数を下げて柔らかく）
              const frequency = 8; // 揺れの速さを遅く
              const amplitude = 4; // 揺れの大きさを少し大きく
              
              // 横揺れと縦揺れを少しずらして自然に
              wobbleX = Math.sin(easeOut * Math.PI * frequency) * amplitude * damping;
              wobbleY = Math.sin(easeOut * Math.PI * frequency * 0.7 + 0.5) * amplitude * 0.8 * damping;
              
              // スケールもゆっくり変化（ぷにぷに感）
              scale = 1 + Math.sin(easeOut * Math.PI * frequency * 0.5) * 0.08 * damping;
            } else {
              // 揺れ終了、次の揺れタイミングを設定
              timer.wobble = 0;
              timer.nextWobble = Math.random() * 10000 + 8000; // 8-18秒後（かなり長い間隔）
              timer.lastUpdate = now;
            }
          }
        }
        
        const centerX = x + cellSize/2 + wobbleX;
        const centerY = y + cellSize/2 + wobbleY;
        const imageSize = cellSize * 0.9 * scale; // 画像サイズ（セルの90%）
        
        // 臓器画像をそのままの形で描画
        const organImage = gameStateRef.current.organImages[cell.color];
        if (organImage && organImage.complete) {
          ctx.save();
          
          // 影（画像の下に）
          ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 4;
          
          // 画像を中央に配置（透明背景がそのまま表示される）
          ctx.drawImage(
            organImage,
            centerX - imageSize / 2,
            centerY - imageSize / 2,
            imageSize,
            imageSize
          );
          ctx.restore();
        }
        
        // 選択エフェクト（光るボックス）
        if (cell.selected) {
          // 光るボックス
          ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)';
          ctx.lineWidth = 4;
          ctx.shadowColor = 'rgba(255, 215, 0, 0.6)';
          ctx.shadowBlur = 15;
          
          const boxSize = cellSize * 0.85;
          ctx.strokeRect(
            centerX - boxSize / 2,
            centerY - boxSize / 2,
            boxSize,
            boxSize
          );
          
          ctx.shadowBlur = 0;
        }
      }
    }
    
    // 選択ライン（虹色グラデーション）
    const selectedCells = gameStateRef.current.selectedCells;
    if (selectedCells.length > 1) {
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 10;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 20;
      
      // 虹色グラデーション
      const firstCell = selectedCells[0];
      const lastCell = selectedCells[selectedCells.length - 1];
      const gradient = ctx.createLinearGradient(
        offsetX + firstCell[1] * cellSize + cellSize/2,
        offsetY + firstCell[0] * cellSize + cellSize/2,
        offsetX + lastCell[1] * cellSize + cellSize/2,
        offsetY + lastCell[0] * cellSize + cellSize/2
      );
      gradient.addColorStop(0, '#FF6B9D');
      gradient.addColorStop(0.5, '#FEC165');
      gradient.addColorStop(1, '#67E9F1');
      ctx.strokeStyle = gradient;
      
      ctx.beginPath();
      for (let i = 0; i < selectedCells.length; i++) {
        const [row, col] = selectedCells[i];
        const x = offsetX + col * cellSize + cellSize/2;
        const y = offsetY + row * cellSize + cellSize/2;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    
    // パーティクル描画
    drawParticles(ctx);
  };

  // 星を描く
  const drawStar = (ctx, cx, cy, spikes, outerRadius, innerRadius, rotation) => {
    let rot = Math.PI / 2 * 3 + rotation;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fill();
  };

  // パーティクル描画
  const drawParticles = (ctx) => {
    const particles = gameStateRef.current.particles;
    
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      
      // パーティクル更新
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.5; // 重力
      p.life--;
      p.size *= 0.95;
      
      if (p.life <= 0 || p.size < 0.5) {
        particles.splice(i, 1);
      }
    }
  };

  // パーティクル生成
  const createParticles = (x, y, color) => {
    const particles = gameStateRef.current.particles;
    
    for (let i = 0; i < 15; i++) {
      particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8 - 3,
        size: 3 + Math.random() * 5,
        color: color,
        life: 30 + Math.random() * 20
      });
    }
  };

  // 可愛い顔を描く
  const drawCuteFace = (ctx, x, y, size, isSelected) => {
    // 目
    const eyeSize = size * (isSelected ? 0.18 : 0.15);
    const eyeOffset = size * 0.28;
    
    // 白目
    ctx.fillStyle = '#FFF';
    ctx.beginPath();
    ctx.arc(x - eyeOffset, y - eyeOffset * 0.4, eyeSize * 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + eyeOffset, y - eyeOffset * 0.4, eyeSize * 1.4, 0, Math.PI * 2);
    ctx.fill();
    
    // 黒目
    ctx.fillStyle = '#2C3E50';
    ctx.beginPath();
    ctx.arc(x - eyeOffset, y - eyeOffset * 0.4, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + eyeOffset, y - eyeOffset * 0.4, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    
    // ハイライト（目の輝き）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(x - eyeOffset + eyeSize * 0.3, y - eyeOffset * 0.4 - eyeSize * 0.3, eyeSize * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + eyeOffset + eyeSize * 0.3, y - eyeOffset * 0.4 - eyeSize * 0.3, eyeSize * 0.4, 0, Math.PI * 2);
    ctx.fill();
    
    // 口（笑顔）
    ctx.strokeStyle = '#FF6B9D';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (isSelected) {
      // 大きな笑顔
      ctx.arc(x, y + eyeOffset * 0.4, eyeOffset * 0.9, 0.15 * Math.PI, 0.85 * Math.PI);
    } else {
      // 普通の笑顔
      ctx.arc(x, y + eyeOffset * 0.6, eyeOffset * 0.7, 0.2 * Math.PI, 0.8 * Math.PI);
    }
    ctx.stroke();
    
    // チーク（ほっぺ）
    if (isSelected) {
      ctx.fillStyle = 'rgba(255, 182, 193, 0.5)';
      ctx.beginPath();
      ctx.ellipse(x - eyeOffset * 1.2, y + eyeOffset * 0.3, eyeOffset * 0.4, eyeOffset * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + eyeOffset * 1.2, y + eyeOffset * 0.3, eyeOffset * 0.4, eyeOffset * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // 座標からセル取得
  const getCellFromPosition = (x, y) => {
    const { cellSize, offsetX, offsetY } = gameStateRef.current;
    const col = Math.floor((x - offsetX) / cellSize);
    const row = Math.floor((y - offsetY) / cellSize);
    
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
      return [row, col];
    }
    return null;
  };

  // セル選択開始
  const startSelection = (x, y) => {
    const cell = getCellFromPosition(x, y);
    if (!cell || !isPlaying || isPaused) return;
    
    const [row, col] = cell;
    const grid = gameStateRef.current.grid;
    
    gameStateRef.current.isDrawing = true;
    gameStateRef.current.selectedCells = [[row, col]];
    gameStateRef.current.lastCell = cell;
    grid[row][col].selected = true;
    
    drawGame();
  };

  // セル選択中
  const continueSelection = (x, y) => {
    if (!gameStateRef.current.isDrawing || !isPlaying || isPaused) return;
    
    const cell = getCellFromPosition(x, y);
    if (!cell) return;
    
    const [row, col] = cell;
    const { selectedCells, lastCell, grid } = gameStateRef.current;
    
    // 同じセルなら何もしない
    if (lastCell && lastCell[0] === row && lastCell[1] === col) return;
    
    // 最初に選択した色
    const firstColor = grid[selectedCells[0][0]][selectedCells[0][1]].color;
    const currentColor = grid[row][col].color;
    
    // 色が違ったら無視
    if (currentColor !== firstColor) return;
    
    // 隣接チェック（8方向：上下左右＋斜め）
    const isAdjacent = lastCell && (
      Math.abs(row - lastCell[0]) <= 1 && Math.abs(col - lastCell[1]) <= 1 &&
      !(row === lastCell[0] && col === lastCell[1])
    );
    
    if (!isAdjacent) return;
    
    // 既に選択済みかチェック
    const alreadySelected = selectedCells.some(([r, c]) => r === row && c === col);
    
    if (alreadySelected) {
      // 一つ前に戻る処理
      if (selectedCells.length > 1) {
        const prevCell = selectedCells[selectedCells.length - 2];
        if (prevCell[0] === row && prevCell[1] === col) {
          const removed = selectedCells.pop();
          grid[removed[0]][removed[1]].selected = false;
          gameStateRef.current.lastCell = cell;
        }
      }
    } else {
      // 新規追加
      selectedCells.push([row, col]);
      grid[row][col].selected = true;
      gameStateRef.current.lastCell = cell;
    }
    
    drawGame();
  };

  // セル選択終了
  const endSelection = () => {
    if (!gameStateRef.current.isDrawing || !isPlaying || isPaused) return;
    
    const { selectedCells, grid } = gameStateRef.current;
    
    // 3個以上で消去
    if (selectedCells.length >= 3) {
      // パーティクル生成
      selectedCells.forEach(([row, col]) => {
        const x = gameStateRef.current.offsetX + col * gameStateRef.current.cellSize + gameStateRef.current.cellSize/2;
        const y = gameStateRef.current.offsetY + row * gameStateRef.current.cellSize + gameStateRef.current.cellSize/2;
        const color = COLORS[grid[row][col].color];
        createParticles(x, y, color);
      });
      
      // スコア計算
      const points = selectedCells.length * 10 * (combo + 1);
      setScore(prev => prev + points);
      setCombo(prev => prev + 1);
      
      // 選択セルをクリア
      selectedCells.forEach(([row, col]) => {
        grid[row][col].selected = false;
      });
      
      // ブロックを消して補充
      refillGrid(selectedCells);
    } else {
      // 選択解除
      selectedCells.forEach(([row, col]) => {
        grid[row][col].selected = false;
      });
      setCombo(0);
    }
    
    gameStateRef.current.isDrawing = false;
    gameStateRef.current.selectedCells = [];
    gameStateRef.current.lastCell = null;
    
    drawGame();
  };

  // グリッド補充（繋がりやすく）
  const refillGrid = (removedCells) => {
    const { grid } = gameStateRef.current;
    
    removedCells.forEach(([row, col]) => {
      // 周辺の色を調べる
      const neighbors = [
        [row - 1, col], [row + 1, col],
        [row, col - 1], [row, col + 1]
      ];
      
      const neighborColors = neighbors
        .filter(([r, c]) => r >= 0 && r < ROWS && c >= 0 && c < COLS)
        .map(([r, c]) => grid[r][c].color);
      
      // 30%の確率で隣接する色と同じにする（繋がりやすく）
      if (neighborColors.length > 0 && Math.random() < 0.3) {
        const randomNeighborColor = neighborColors[Math.floor(Math.random() * neighborColors.length)];
        grid[row][col].color = randomNeighborColor;
      } else {
        // それ以外は完全ランダム
        grid[row][col].color = Math.floor(Math.random() * COLORS.length);
      }
    });
  };

  // マウス/タッチイベント
  const handleStart = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let x, y;
    if (e.type === 'mousedown') {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    } else {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    }
    
    startSelection(x, y);
  };

  const handleMove = (e) => {
    if (!gameStateRef.current.isDrawing) return; // ドラッグ中のみ
    e.preventDefault();
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let x, y;
    if (e.type === 'mousemove') {
      if (e.buttons !== 1) return; // 左クリック押下中のみ
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    } else {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    }
    
    continueSelection(x, y);
  };

  const handleEnd = (e) => {
    e.preventDefault();
    endSelection();
  };

  // キャンバスサイズ調整
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      if (gameStateRef.current.grid.length > 0) {
        drawGame();
      }
    };
    
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // 初期描画
  useEffect(() => {
    if (gameStateRef.current.grid.length > 0) {
      drawGame();
    }
  }, [score, combo, timeLeft]);

  // アニメーションループ（パーティクル用）
  useEffect(() => {
    let animationId;
    
    const animate = () => {
      if (gameStateRef.current.particles.length > 0 || gameStateRef.current.grid.length > 0) {
        drawGame();
      }
      animationId = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      margin: 0, 
      padding: 0, 
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #FFE5E5 0%, #FFF0F5 50%, #E8F5FF 100%)',
      position: 'relative',
      touchAction: 'none',
      fontFamily: '"Comic Sans MS", "Segoe UI Emoji", cursive'
    }}>
      {/* スコア表示 */}
      {isPlaying && (
        <div style={{
          position: 'absolute',
          top: '5px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 'clamp(4px, 1vw, 10px)',
          zIndex: 10,
          fontSize: 'clamp(11px, 2.5vw, 16px)',
          fontWeight: 'bold',
          color: '#FF6B9D'
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            padding: 'clamp(3px, 0.8vw, 8px) clamp(8px, 2vw, 14px)',
            borderRadius: '15px',
            boxShadow: '0 2px 8px rgba(255, 107, 157, 0.2)',
            whiteSpace: 'nowrap'
          }}>
            ⏱️ {timeLeft}秒
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            padding: 'clamp(3px, 0.8vw, 8px) clamp(8px, 2vw, 14px)',
            borderRadius: '15px',
            boxShadow: '0 2px 8px rgba(255, 193, 7, 0.2)',
            whiteSpace: 'nowrap'
          }}>
            🌟 {score}点
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.95)',
            padding: 'clamp(3px, 0.8vw, 8px) clamp(8px, 2vw, 14px)',
            borderRadius: '15px',
            boxShadow: '0 2px 8px rgba(255, 87, 34, 0.2)',
            whiteSpace: 'nowrap'
          }}>
            🔥 {combo}コンボ
          </div>
        </div>
      )}
      
      {/* コントロールボタン（画面下部） */}
      {isPlaying && !isPaused && (
        <div style={{
          position: 'absolute',
          bottom: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 'clamp(4px, 1vw, 10px)',
          zIndex: 10
        }}>
          <button
            onClick={shuffleGrid}
            style={{
              padding: 'clamp(5px, 1.2vw, 10px) clamp(10px, 2.5vw, 20px)',
              fontSize: 'clamp(10px, 2.2vw, 14px)',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #B794F4 0%, #9F7AEA 100%)',
              color: '#FFF',
              border: 'none',
              borderRadius: '18px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(183, 148, 244, 0.3)',
              transition: 'transform 0.1s',
              whiteSpace: 'nowrap'
            }}
            onMouseDown={(e) => e.target.style.transform = 'scale(0.95)'}
            onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
          >
            🔀 シャッフル
          </button>
          <button
            onClick={pauseGame}
            style={{
              padding: 'clamp(5px, 1.2vw, 10px) clamp(10px, 2.5vw, 20px)',
              fontSize: 'clamp(10px, 2.2vw, 14px)',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #FBD38D 0%, #F6AD55 100%)',
              color: '#FFF',
              border: 'none',
              borderRadius: '18px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(251, 211, 141, 0.3)',
              transition: 'transform 0.1s',
              whiteSpace: 'nowrap'
            }}
            onMouseDown={(e) => e.target.style.transform = 'scale(0.95)'}
            onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
          >
            ⏸️ 停止
          </button>
          <button
            onClick={quitGame}
            style={{
              padding: 'clamp(5px, 1.2vw, 10px) clamp(10px, 2.5vw, 20px)',
              fontSize: 'clamp(10px, 2.2vw, 14px)',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #FC8181 0%, #F56565 100%)',
              color: '#FFF',
              border: 'none',
              borderRadius: '18px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(252, 129, 129, 0.3)',
              transition: 'transform 0.1s',
              whiteSpace: 'nowrap'
            }}
            onMouseDown={(e) => e.target.style.transform = 'scale(0.95)'}
            onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
          >
            ❌ 終了
          </button>
        </div>
      )}
      
      {/* キャンバス */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        style={{ 
          display: 'block',
          cursor: isPlaying ? 'pointer' : 'default'
        }}
      />
      
      {/* スタート画面 */}
      {!isPlaying && !gameOver && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          zIndex: 20
        }}>
          <h1 style={{ 
            color: '#FF6B9D', 
            fontSize: '56px',
            marginBottom: '10px',
            textShadow: '4px 4px 0px rgba(255, 107, 157, 0.2)',
            fontFamily: '"Comic Sans MS", cursive'
          }}>
            🌟臓器パズル🌟
          </h1>
          <p style={{ 
            color: '#FF6B9D', 
            fontSize: '20px',
            marginBottom: '40px',
            fontWeight: 'bold'
          }}>
            同じ臓器を3個以上繋げて消そう！
          </p>
          {!imagesLoaded ? (
            <div style={{
              color: '#FFA500',
              fontSize: '18px',
              fontWeight: 'bold'
            }}>
              🏥 画像読み込み中...
            </div>
          ) : (
            <button
              onClick={startGame}
              style={{
                padding: '20px 60px',
                fontSize: '28px',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #FEC163 0%, #DE4313 100%)',
                color: '#FFF',
                border: 'none',
                borderRadius: '50px',
                cursor: 'pointer',
                boxShadow: '0 8px 25px rgba(254, 193, 99, 0.5)',
                transition: 'transform 0.2s',
                fontFamily: '"Comic Sans MS", cursive'
              }}
              onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
              onMouseDown={(e) => e.target.style.transform = 'scale(0.95)'}
              onMouseUp={(e) => e.target.style.transform = 'scale(1.05)'}
            >
              ✨ スタート ✨
            </button>
          )}
        </div>
      )}
      
      {/* ゲームオーバー */}
      {gameOver && (
        <>
          {/* 暗いオーバーレイ */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.6)',
            zIndex: 15
          }} />
          
          {/* ゲームオーバーメッセージ */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.95)',
            padding: '50px',
            borderRadius: '30px',
            boxShadow: '0 10px 40px rgba(255, 107, 157, 0.3)',
            zIndex: 20
          }}>
            <h2 style={{ 
              color: '#FF6B9D', 
              fontSize: '48px',
              marginBottom: '20px',
              fontFamily: '"Comic Sans MS", cursive'
            }}>
              🎮 ゲームオーバー！
            </h2>
            <p style={{ 
              color: '#FFA500', 
              fontSize: '36px',
              marginBottom: '10px',
              fontWeight: 'bold'
            }}>
              🌟 {score}点
            </p>
            <p style={{ 
              color: '#FF6B9D', 
              fontSize: '24px',
              marginBottom: '40px'
            }}>
              最高コンボ: {combo} 🔥
            </p>
            <button
              onClick={startGame}
              style={{
                padding: '18px 55px',
                fontSize: '26px',
                fontWeight: 'bold',
                background: 'linear-gradient(135deg, #68D391 0%, #38B2AC 100%)',
                color: '#FFF',
                border: 'none',
                borderRadius: '50px',
                cursor: 'pointer',
                boxShadow: '0 6px 20px rgba(104, 211, 145, 0.4)',
                fontFamily: '"Comic Sans MS", cursive'
              }}
            >
              🎯 もう一度！
            </button>
          </div>
        </>
      )}
      
      {/* 一時停止画面 */}
      {isPaused && (
        <>
          {/* 暗いオーバーレイ */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.6)',
            zIndex: 15
          }} />
          
          {/* 一時停止メッセージ */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.95)',
            padding: '50px',
            borderRadius: '30px',
            boxShadow: '0 10px 40px rgba(255, 107, 157, 0.3)',
            zIndex: 20
          }}>
            <h2 style={{ 
              color: '#FF6B9D', 
              fontSize: '48px',
              marginBottom: '30px',
              fontFamily: '"Comic Sans MS", cursive'
            }}>
              ⏸️ 一時停止中
            </h2>
            <p style={{ 
              color: '#FFA500', 
              fontSize: '24px',
              marginBottom: '40px',
              fontWeight: 'bold'
            }}>
              現在のスコア: {score}点 ✨
            </p>
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
              <button
                onClick={resumeGame}
                style={{
                  padding: '18px 45px',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  background: 'linear-gradient(135deg, #68D391 0%, #38B2AC 100%)',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: '50px',
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(104, 211, 145, 0.4)',
                  fontFamily: '"Comic Sans MS", cursive'
                }}
              >
                ▶️ 再開
              </button>
              <button
                onClick={quitGame}
                style={{
                  padding: '18px 45px',
                  fontSize: '24px',
                  fontWeight: 'bold',
                  background: 'linear-gradient(135deg, #FC8181 0%, #F56565 100%)',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: '50px',
                  cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(252, 129, 129, 0.4)',
                  fontFamily: '"Comic Sans MS", cursive'
                }}
              >
                🚪 終了
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TsumTsumPuzzle;