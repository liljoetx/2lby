(() => {
  "use strict";

  // ===== Hearts background =====
  const heartsLayer = document.getElementById("hearts");
  const HEART_GLYPHS = ["❤️","💗","💕","💖","💓","💘","🩷"];
  function spawnHeart(){
    const h = document.createElement("div");
    h.className = "heart";
    h.textContent = HEART_GLYPHS[Math.floor(Math.random() * HEART_GLYPHS.length)];

    const left = Math.random() * 100;
    const size = 14 + Math.random() * 18;
    const dur  = 8 + Math.random() * 6;
    const delay = Math.random() * 2;
    const rotFrom = (Math.random()*40 - 20).toFixed(1);
    const rotTo   = (Math.random()*40 - 20).toFixed(1);
    const sway    = (Math.random()*50 - 25).toFixed(0);

    h.style.left = left + "vw";
    h.style.setProperty("--s", size + "px");
    h.style.setProperty("--rot-from", rotFrom + "deg");
    h.style.setProperty("--rot-to", rotTo + "deg");
    h.style.setProperty("--sway", sway + "px");
    h.style.animationDuration = dur + "s";
    h.style.animationDelay = delay + "s";

    heartsLayer.appendChild(h);
    setTimeout(()=> h.remove(), (dur + delay) * 1000 + 100);
  }
  for(let i=0;i<10;i++) spawnHeart();
  setInterval(spawnHeart, 900);

  // ===== Gate =====
  const gate = document.getElementById("gate");
  const main = document.getElementById("main");
  const gateBox = document.getElementById("gateBox");
  const passInput = document.getElementById("pass");
  const enterBtn = document.getElementById("enterBtn");
  const err = document.getElementById("err");
  const ok = document.getElementById("ok");

  document.getElementById("passHint").textContent = "الباسورد: " + CONFIG.passwordHint;

  async function sha256Hex(text){
    const data = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  // ===== إشعار على الموبايل عن طريق ntfy.sh لما حد يدخل صح =====
  function sendLoginNotification(){
    if(!CONFIG.notifyTopic) return;
    const now = new Date();
    const dateStr = now.toLocaleDateString("ar-EG-u-nu-latn", { day:"2-digit", month:"long", year:"numeric" });
    const timeStr = now.toLocaleTimeString("ar-EG-u-nu-latn", { hour:"2-digit", minute:"2-digit", hour12:true });
    const body = `${CONFIG.herName || "حبيبتك"} دخلت الموقع 👑\nبتاريخ ${dateStr}\nالساعة ${timeStr}`;

    fetch(`https://ntfy.sh/${encodeURIComponent(CONFIG.notifyTopic)}`, {
      method: "POST",
      body,
      headers: {
        "Title": "Love site visit",
        "Tags": "heart"
      }
    }).catch(()=>{ /* ماينفعش الدخول يتعطل لو الإشعار فشل */ });
  }

  // ===== محاولات محدودة عشان تصعّبي التخمين العشوائي للباسورد =====
  const MAX_FAILS = 5;
  const LOCK_MS = 30000;
  const LOCK_KEY = "loveSite_lockUntil";
  const FAIL_KEY = "loveSite_fails";
  let lockTimer = null;

  function getLockRemaining(){
    const until = parseInt(localStorage.getItem(LOCK_KEY) || "0", 10);
    return Math.max(0, until - Date.now());
  }
  function setLocked(ms){
    localStorage.setItem(LOCK_KEY, String(Date.now() + ms));
    localStorage.setItem(FAIL_KEY, "0");
  }
  function registerFail(){
    const fails = parseInt(localStorage.getItem(FAIL_KEY) || "0", 10) + 1;
    localStorage.setItem(FAIL_KEY, String(fails));
    if(fails >= MAX_FAILS) setLocked(LOCK_MS);
  }
  function clearAttempts(){
    localStorage.removeItem(FAIL_KEY);
    localStorage.removeItem(LOCK_KEY);
  }
  function applyLockUI(){
    const remaining = getLockRemaining();
    clearInterval(lockTimer);
    if(remaining <= 0){
      passInput.disabled = false;
      enterBtn.disabled = false;
      return;
    }
    passInput.disabled = true;
    enterBtn.disabled = true;
    ok.style.display = "none";
    const tick = ()=>{
      const left = Math.ceil(getLockRemaining() / 1000);
      if(left <= 0){
        clearInterval(lockTimer);
        err.style.display = "none";
        passInput.disabled = false;
        enterBtn.disabled = false;
        return;
      }
      err.style.display = "block";
      err.textContent = `حاولتي كتير… استني ${left} ثانية وجربي تاني 💤`;
    };
    tick();
    lockTimer = setInterval(tick, 1000);
  }
  applyLockUI();

  async function unlock(){
    if(getLockRemaining() > 0){ applyLockUI(); return; }

    const v = (passInput.value || "").trim();
    const hash = await sha256Hex(v);

    if(hash === CONFIG.passwordHash){
      clearAttempts();
      sendLoginNotification();
      err.style.display = "none";
      err.textContent = "الباسورد غلط… جرّبي تاني 💔";
      ok.style.display = "block";
      setTimeout(()=>{
        gate.style.display = "none";
        main.style.display = "block";
        window.scrollTo({top:0, behavior:"smooth"});
        initMain();
      }, 650);
    }else{
      registerFail();
      ok.style.display = "none";
      if(getLockRemaining() > 0){
        applyLockUI();
      }else{
        err.textContent = "الباسورد غلط… جرّبي تاني 💔";
        err.style.display = "block";
      }
      gateBox.classList.remove("shake");
      void gateBox.offsetWidth;
      gateBox.classList.add("shake");
      passInput.value = "";
      passInput.focus();
    }
  }
  enterBtn.addEventListener("click", unlock);
  passInput.addEventListener("keydown", (e)=>{ if(e.key==="Enter") unlock(); });

  // ===== Lightbox (with prev/next) =====
  const lightbox = document.getElementById("lightbox");
  const lbImg = document.getElementById("lbImg");
  const lbCap = document.getElementById("lbCap");
  const lbClose = document.getElementById("lbClose");
  const lbPrev = document.getElementById("lbPrev");
  const lbNext = document.getElementById("lbNext");

  let lbList = [];
  let lbIndex = 0;

  function showLB(){
    const item = lbList[lbIndex];
    lbImg.src = item.src;
    lbCap.textContent = item.caption || `${lbIndex+1} / ${lbList.length}`;
    const multi = lbList.length > 1;
    lbPrev.style.display = multi ? "flex" : "none";
    lbNext.style.display = multi ? "flex" : "none";
  }
  function openLB(list, index){
    lbList = list;
    lbIndex = index;
    showLB();
    lightbox.style.display = "flex";
  }
  function closeLB(){
    lightbox.style.display = "none";
    lbImg.src = "";
  }
  lbClose.addEventListener("click", closeLB);
  lightbox.addEventListener("click", (e)=>{ if(e.target === lightbox) closeLB(); });
  lbPrev.addEventListener("click", ()=>{ lbIndex = (lbIndex - 1 + lbList.length) % lbList.length; showLB(); });
  lbNext.addEventListener("click", ()=>{ lbIndex = (lbIndex + 1) % lbList.length; showLB(); });
  document.addEventListener("keydown", (e)=>{
    if(lightbox.style.display !== "flex") return;
    if(e.key === "Escape") closeLB();
    if(e.key === "ArrowLeft") lbNext.click();
    if(e.key === "ArrowRight") lbPrev.click();
  });

  // ===== Music =====
  let audio, musicOn = false;
  function setupMusic(){
    audio = new Audio(CONFIG.musicSrc);
    audio.loop = true;
    audio.volume = 0.7;
    const musicBtn = document.getElementById("musicBtn");
    const musicHint = document.getElementById("musicHint");

    musicBtn.addEventListener("click", async ()=>{
      try{
        if(!musicOn){
          await audio.play();
          musicOn = true;
          musicBtn.textContent = "⏸️ إيقاف الأغنية";
          musicHint.textContent = "";
        }else{
          audio.pause();
          musicOn = false;
          musicBtn.textContent = "🎵 شغّلي الأغنية";
        }
      }catch(e){
        musicHint.textContent = "الأغنية مش موجودة أو مش قادر يشغّلها.";
      }
    });
  }

  // ===== Countdown =====
  function diffParts(from, to){
    let years = to.getFullYear() - from.getFullYear();
    let months = to.getMonth() - from.getMonth();
    let days = to.getDate() - from.getDate();
    let hours = to.getHours() - from.getHours();
    let mins = to.getMinutes() - from.getMinutes();
    let secs = to.getSeconds() - from.getSeconds();
    let ms = to.getMilliseconds() - from.getMilliseconds();

    if(ms < 0){ ms += 1000; secs--; }
    if(secs < 0){ secs += 60; mins--; }
    if(mins < 0){ mins += 60; hours--; }
    if(hours < 0){ hours += 24; days--; }
    if(days < 0){
      const prevMonth = new Date(to.getFullYear(), to.getMonth(), 0).getDate();
      days += prevMonth;
      months--;
    }
    if(months < 0){ months += 12; years--; }
    return { years, months, days, hours, mins, secs, ms };
  }

  function startCountdown(){
    const startDate = new Date(CONFIG.startDate);
    const els = {
      y: document.getElementById("cY"),
      mo: document.getElementById("cMo"),
      d: document.getElementById("cD"),
      h: document.getElementById("cH"),
      mi: document.getElementById("cMi"),
      s: document.getElementById("cS"),
      ms: document.getElementById("cMs")
    };
    function tick(){
      const now = new Date();
      if(now < startDate){
        Object.values(els).forEach(el => el.textContent = el === els.ms ? "000" : "00");
        return;
      }
      const p = diffParts(startDate, now);
      els.y.textContent = String(p.years).padStart(2,"0");
      els.mo.textContent = String(p.months).padStart(2,"0");
      els.d.textContent = String(p.days).padStart(2,"0");
      els.h.textContent = String(p.hours).padStart(2,"0");
      els.mi.textContent = String(p.mins).padStart(2,"0");
      els.s.textContent = String(p.secs).padStart(2,"0");
      els.ms.textContent = String(p.ms).padStart(3,"0");
    }
    tick();
    setInterval(tick, 37);
  }

  // ===== Reveal on scroll =====
  function setupReveal(){
    const items = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(e.isIntersecting){
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    items.forEach(el=> io.observe(el));
  }

  // ===== Scroll to top =====
  function setupToTop(){
    const btn = document.getElementById("toTop");
    window.addEventListener("scroll", ()=>{
      btn.classList.toggle("show", window.scrollY > 500);
    });
    btn.addEventListener("click", ()=> window.scrollTo({top:0, behavior:"smooth"}));
  }

  // ===== Game: catch the hearts =====
  function setupGame(){
    const GAME_DURATION = 20;
    const BEST_KEY = "loveSite_bestScore";
    const HEARTS = ["❤️","💗","💕","💖","💓","💘"];

    const startBtn = document.getElementById("gameStartBtn");
    const area = document.getElementById("gameArea");
    const hint = document.getElementById("gameHint");
    const timeEl = document.getElementById("gameTime");
    const scoreEl = document.getElementById("gameScore");
    const bestEl = document.getElementById("gameBest");
    const resultEl = document.getElementById("gameResult");

    let score = 0;
    let timeLeft = GAME_DURATION;
    let spawnTimer = null;
    let countdownTimer = null;
    let running = false;

    bestEl.textContent = localStorage.getItem(BEST_KEY) || "0";

    function spawnGameHeart(){
      const h = document.createElement("button");
      h.type = "button";
      h.className = "gameHeart";
      h.setAttribute("aria-label", "قلب");
      h.textContent = HEARTS[Math.floor(Math.random() * HEARTS.length)];

      const areaWidth = area.clientWidth;
      const left = Math.random() * Math.max(0, areaWidth - 40);
      h.style.left = left + "px";
      h.style.animationDuration = (2.3 + Math.random() * 1.7) + "s";

      const remove = ()=> h.remove();
      h.addEventListener("animationend", remove);
      h.addEventListener("click", ()=>{
        if(!running || h.classList.contains("popped")) return;
        score++;
        scoreEl.textContent = String(score);

        const plus = el("div", "gamePlus", "+1");
        plus.style.left = h.style.left;
        plus.style.top = (h.offsetTop) + "px";
        area.appendChild(plus);
        setTimeout(()=> plus.remove(), 700);

        h.classList.add("popped");
        setTimeout(remove, 220);
      });

      area.appendChild(h);
    }

    function resultMessage(finalScore){
      if(finalScore >= 18) return `😍 ${finalScore} نقطة! وحش زي حبي بالظبط`;
      if(finalScore >= 10) return `💗 ${finalScore} نقطة! حلوة أوي`;
      if(finalScore >= 4)  return `🙂 ${finalScore} نقطة! جربي تاني تكسري رقمك`;
      return `💞 ${finalScore} نقطة… معلش، حبي مش بيتحسب بالنقط برضو بحبك`;
    }

    function endGame(){
      running = false;
      clearInterval(spawnTimer);
      clearInterval(countdownTimer);
      area.querySelectorAll(".gameHeart").forEach(h => h.remove());
      startBtn.disabled = false;
      startBtn.textContent = "العبي تاني 🔁";

      let msg = resultMessage(score);
      const best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10);
      if(score > best){
        localStorage.setItem(BEST_KEY, String(score));
        bestEl.textContent = String(score);
        msg += " — رقم قياسي جديد! 🏆";
      }
      resultEl.textContent = msg;
      resultEl.style.display = "block";
    }

    function startGame(){
      if(running) return;
      running = true;
      score = 0;
      timeLeft = GAME_DURATION;
      scoreEl.textContent = "0";
      timeEl.textContent = String(timeLeft);
      resultEl.style.display = "none";
      hint.style.display = "none";
      startBtn.disabled = true;

      spawnGameHeart();
      spawnTimer = setInterval(spawnGameHeart, 600);
      countdownTimer = setInterval(()=>{
        timeLeft--;
        timeEl.textContent = String(Math.max(0, timeLeft));
        if(timeLeft <= 0) endGame();
      }, 1000);
    }

    startBtn.addEventListener("click", startGame);
  }

  // ===== Game tabs =====
  function setupGameTabs(){
    const tabs = document.querySelectorAll(".gameTab");
    tabs.forEach(tab=>{
      tab.addEventListener("click", ()=>{
        tabs.forEach(t=> t.classList.toggle("active", t === tab));
        document.querySelectorAll(".gamePanel").forEach(panel=>{
          panel.hidden = panel.id !== tab.dataset.panel;
        });
      });
    });
  }

  // ===== Game: memory match =====
  function setupMemoryGame(){
    const BEST_KEY = "loveSite_bestMemoryMoves";
    const SYMBOLS = ["❤️","💗","💕","💖","💓","💘","🩷","💜"];

    const startBtn = document.getElementById("memoryStartBtn");
    const grid = document.getElementById("memoryGrid");
    const movesEl = document.getElementById("memoryMoves");
    const bestEl = document.getElementById("memoryBest");
    const resultEl = document.getElementById("memoryResult");

    const bestStored = localStorage.getItem(BEST_KEY);
    bestEl.textContent = bestStored || "—";

    let cards = [];
    let flippedEls = [];
    let matchesFound = 0;
    let moves = 0;
    let lock = false;

    function shuffledDeck(){
      const deck = [...SYMBOLS, ...SYMBOLS];
      for(let i = deck.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      return deck;
    }

    function render(){
      grid.innerHTML = "";
      cards.forEach((symbol, i)=>{
        const card = el("button", "memoryCard");
        card.type = "button";
        card.dataset.index = String(i);
        card.setAttribute("aria-label", "كارت");
        grid.appendChild(card);
      });
    }

    function flipCard(card, symbol){
      card.classList.add("flipped");
      card.textContent = symbol;
    }
    function unflipCard(card){
      card.classList.remove("flipped");
      card.textContent = "";
    }

    function onCardClick(e){
      const card = e.target.closest(".memoryCard");
      if(!card || lock) return;
      if(card.classList.contains("flipped") || card.classList.contains("matched")) return;

      const idx = parseInt(card.dataset.index, 10);
      flipCard(card, cards[idx]);
      flippedEls.push(card);

      if(flippedEls.length < 2) return;

      moves++;
      movesEl.textContent = String(moves);

      const [a, b] = flippedEls;
      const ai = parseInt(a.dataset.index, 10);
      const bi = parseInt(b.dataset.index, 10);

      if(cards[ai] === cards[bi]){
        a.classList.add("matched");
        b.classList.add("matched");
        flippedEls = [];
        matchesFound++;
        if(matchesFound === SYMBOLS.length) finishGame();
      }else{
        lock = true;
        setTimeout(()=>{
          unflipCard(a);
          unflipCard(b);
          flippedEls = [];
          lock = false;
        }, 700);
      }
    }

    function finishGame(){
      let msg = `🎉 خلصتي كل الأزواج في ${moves} محاولة!`;
      const best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10);
      if(!best || moves < best){
        localStorage.setItem(BEST_KEY, String(moves));
        bestEl.textContent = String(moves);
        msg += " — رقم قياسي جديد! 🏆";
      }
      resultEl.textContent = msg;
      resultEl.style.display = "block";
    }

    function startMemory(){
      cards = shuffledDeck();
      flippedEls = [];
      matchesFound = 0;
      moves = 0;
      lock = false;
      movesEl.textContent = "0";
      resultEl.style.display = "none";
      render();
    }

    grid.addEventListener("click", onCardClick);
    startBtn.addEventListener("click", startMemory);
    startMemory();
  }

  function el(tag, cls, text){
    const e = document.createElement(tag);
    if(cls) e.className = cls;
    if(text !== undefined) e.textContent = text;
    return e;
  }

  function initMain(){
    document.getElementById("anniv").textContent = CONFIG.annivDisplay;
    document.getElementById("anniv2").textContent = CONFIG.annivDisplay;
    document.getElementById("heroTitle").textContent = CONFIG.heroTitle;
    document.getElementById("loveLine").textContent = CONFIG.heroText;
    document.getElementById("footerText").textContent = CONFIG.footerText;
    document.title = (CONFIG.herName || "Love") + " ❤️";

    setupMusic();

    // رسائل
    const box = document.getElementById("messages");
    box.innerHTML = "";
    CONFIG.messages.forEach(t=>{
      const d = el("div", "msg", t);
      box.appendChild(d);
    });

    // أسباب الحب
    const reasonBox = document.getElementById("reasonBox");
    const reasonBtn = document.getElementById("reasonBtn");
    function randomReason(){
      const list = CONFIG.reasons;
      const r = list[Math.floor(Math.random() * list.length)];
      reasonBox.textContent = r;
    }
    reasonBtn.addEventListener("click", randomReason);
    randomReason();

    // Timeline
    const tBox = document.getElementById("timelineBox");
    tBox.innerHTML = "";
    const timelinePhotos = CONFIG.timeline.filter(i=>i.photo).map(i=>({src:i.photo, caption:i.title}));

    CONFIG.timeline.forEach((item)=>{
      const wrap = el("div", "tItem");
      const dot = el("div", "tDot");
      const card = el("div", "tCard");
      const top = el("div", "tTop");
      const title = el("div", "tTitle", item.title || "ذكرى");
      const date = el("div", "tDate", item.date || "—");
      top.appendChild(title);
      top.appendChild(date);
      const text = el("div", "tText", item.text || "");
      card.appendChild(top);
      card.appendChild(text);

      if(item.photo || item.video){
        const media = el("div", "tMedia");

        if(item.photo){
          const mini = el("div", "miniThumb");
          let broken = false;
          const img = document.createElement("img");
          img.src = item.photo;
          img.alt = item.title || "صورة";
          img.loading = "lazy";
          img.onerror = ()=> {
            broken = true;
            mini.innerHTML = "";
            mini.appendChild(el("div", "tNote", "صورة مش موجودة"));
            mini.style.cursor = "default";
          };
          mini.appendChild(img);
          mini.addEventListener("click", ()=>{
            if(broken) return;
            const idx = timelinePhotos.findIndex(p=>p.src === item.photo);
            openLB(timelinePhotos, idx >= 0 ? idx : 0);
          });
          media.appendChild(mini);
        }
        if(item.video){
          const vWrap = document.createElement("div");
          const v = document.createElement("video");
          v.controls = true;
          v.src = item.video;
          v.onerror = ()=> {
            vWrap.innerHTML = "";
            vWrap.appendChild(el("div", "tNote", "الفيديو مش موجود في المسار ده."));
          };
          vWrap.appendChild(v);
          media.appendChild(vWrap);
        }
        card.appendChild(media);
      }

      wrap.appendChild(dot);
      wrap.appendChild(card);
      tBox.appendChild(wrap);
    });

    // Album
    const album = document.getElementById("albumGrid");
    album.innerHTML = "";
    const albumList = CONFIG.album.map(p=>({src:p.src, caption:p.caption}));
    CONFIG.album.forEach((p, i)=>{
      const tile = el("div", "thumb" + (p.landscape ? " landscape" : ""));
      let broken = false;
      const img = document.createElement("img");
      img.alt = p.caption || `صورة ${i+1}`;
      img.loading = "lazy";
      img.src = p.src;
      img.onerror = ()=> {
        broken = true;
        tile.className = "thumb missing";
        tile.textContent = "الصورة مش موجودة: " + p.src;
      };
      tile.appendChild(img);
      tile.addEventListener("click", ()=> { if(!broken) openLB(albumList, i); });
      album.appendChild(tile);
    });

    // Videos
    const vgrid = document.getElementById("videoGrid");
    vgrid.innerHTML = "";
    CONFIG.videos.forEach((src)=>{
      const v = document.createElement("video");
      v.controls = true;
      v.src = src;
      v.onerror = ()=>{
        const ph = el("div", "videoMissing", "الفيديو مش موجود: " + src);
        v.replaceWith(ph);
      };
      vgrid.appendChild(v);
    });

    // Secret
    const revealBtn = document.getElementById("revealBtn");
    const secretMsg = document.getElementById("secretMsg");
    secretMsg.textContent = CONFIG.secretMessage;
    revealBtn.addEventListener("click", ()=>{
      const show = secretMsg.style.display !== "block";
      secretMsg.style.display = show ? "block" : "none";
      revealBtn.textContent = show ? "اقفلي 🔒" : "دوسي 👑";
    });

    startCountdown();
    setupReveal();
    setupToTop();
    setupGameTabs();
    setupGame();
    setupMemoryGame();
  }
})();
