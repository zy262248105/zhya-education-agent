const STORAGE_KEY = "zhya-profile-v1";
const PLAN_KEY = "zhya-plan-v1";

const defaultProfile = {
  name: "林同学",
  grade: "七年级",
  subject: "数学",
  weakness: "移项变号",
  minutes: 25,
  style: "先提示，再讲解"
};

let profile = loadJSON(STORAGE_KEY, defaultProfile);
let planTasks = loadJSON(PLAN_KEY, null) || makePlan(profile.minutes);
let pendingPrompt = "";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const messages = $("#messages");
const composer = $("#composer");
const promptInput = $("#promptInput");
const sendButton = $("#sendButton");
const sidebar = $("#sidebar");
const scrim = $("#scrim");
const profileModal = $("#profileModal");
const quizModal = $("#quizModal");
const toast = $("#toast");

function loadJSON(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? { ...fallback, ...JSON.parse(saved) } : fallback;
  } catch {
    return fallback;
  }
}

function saveProfile() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    localStorage.setItem(PLAN_KEY, JSON.stringify(planTasks));
  } catch {
    // The prototype still works when storage is unavailable.
  }
}

function escapeHTML(value) {
  const node = document.createElement("div");
  node.textContent = value;
  return node.innerHTML;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function setProfileUI() {
  const initial = (profile.name || "林同学").slice(0, 1);
  $("#avatar").textContent = initial;
  $("#miniAvatar").textContent = initial;
  $("#profileName").textContent = profile.name || "林同学";
  $("#profileSummary").textContent = `${profile.grade} · ${profile.subject}`;
  $("#profileContext").textContent = `${profile.grade} · ${profile.subject}`;
  $("#chatSubject").textContent = `${profile.grade}${profile.subject} · ${profile.style}`;
}

function makePlan(minutes) {
  const short = minutes <= 15;
  return [
    { id: "recall", title: `回顾：${profile.weakness}`, detail: "先说一遍你知道什么，不翻答案", minutes: short ? 2 : 4, done: true },
    { id: "example", title: "看懂一个完整例子", detail: "每一步暂停一下，问我“为什么”", minutes: short ? 4 : 7, done: true },
    { id: "practice", title: "独立练 2 道同类题", detail: "只在卡住时看下一层提示", minutes: short ? 6 : 9, done: false },
    { id: "explain", title: "用自己的话讲清一步", detail: "能讲明白，才算真的学会", minutes: short ? 3 : 5, done: false }
  ];
}

function renderPlan() {
  const total = planTasks.reduce((sum, task) => sum + Number(task.minutes), 0);
  $("#planMinutes").textContent = total;
  $("#planList").innerHTML = planTasks.map((task, index) => `
    <div class="plan-task ${task.done ? "completed" : ""}" data-task-index="${index}">
      <button class="task-check" aria-label="${task.done ? "标记为未完成" : "标记为完成"}">✓</button>
      <div class="task-copy"><strong>${escapeHTML(task.title)}</strong><span>${escapeHTML(task.detail)}</span></div>
      <span class="task-duration">${task.minutes} 分钟</span>
    </div>
  `).join("");

  $$(".task-check", $("#planList")).forEach(button => {
    button.addEventListener("click", () => {
      const index = Number(button.closest(".plan-task").dataset.taskIndex);
      planTasks[index].done = !planTasks[index].done;
      saveProfile();
      renderPlan();
      showToast(planTasks[index].done ? "完成一步，进步已经发生" : "已恢复为待完成");
    });
  });

  const done = planTasks.filter(task => task.done).length;
  const percent = Math.round(done / planTasks.length * 100);
  $("#focusRing").style.setProperty("--progress", percent);
  $("#focusRing span").textContent = `${done}/${planTasks.length}`;
}

function renderWeek() {
  const days = [
    ["一", "✓", "done"], ["二", "✓", "done"], ["三", "12", "done"], ["四", "18", "done"],
    ["五", "20", "done"], ["六", "·", ""], ["今", "25", "today"]
  ];
  $("#weekStrip").innerHTML = days.map(([day, mark, state]) => `
    <div class="day-cell ${state}"><span>${day}</span><i>${mark}</i></div>
  `).join("");
}

function messageTemplate(role, content) {
  if (role === "user") {
    return `<div class="message user"><div class="message-content">${content}</div></div>`;
  }
  return `
    <div class="message agent">
      <div class="message-avatar">芽</div>
      <div class="message-content"><span class="agent-kicker">知芽 · 学习教练</span>${content}</div>
    </div>`;
}

function addMessage(role, content) {
  messages.insertAdjacentHTML("beforeend", messageTemplate(role, content));
  messages.scrollTop = messages.scrollHeight;
}

function addTyping() {
  const id = `typing-${Date.now()}`;
  messages.insertAdjacentHTML("beforeend", `
    <div class="message agent" id="${id}">
      <div class="message-avatar">芽</div>
      <div class="message-content typing" aria-label="知芽正在思考"><i></i><i></i><i></i></div>
    </div>`);
  messages.scrollTop = messages.scrollHeight;
  return id;
}

function removeTyping(id) {
  document.getElementById(id)?.remove();
}

function welcomeMessage() {
  return `
    <p class="agent-intro">你好，${escapeHTML(profile.name)}。我先不急着讲题，想和你一起找清楚：<strong>今天最值得解决的那一步是什么。</strong></p>
    <div class="step-box">
      <span>我从你的画像里看到</span>
      <strong>${escapeHTML(profile.grade)}${escapeHTML(profile.subject)} · 卡点：${escapeHTML(profile.weakness)}</strong>
      <p>今天可以投入 ${profile.minutes} 分钟，偏好“${escapeHTML(profile.style)}”。</p>
    </div>
    <p>你想先试试哪一项？也可以直接把题目发给我。</p>
    <div class="inline-actions">
      <button data-prompt="今天只有${profile.minutes}分钟，帮我复习${escapeHTML(profile.weakness)}">按今天的计划学</button>
      <button data-prompt="我想做一次5分钟学情诊断">先做个小诊断</button>
    </div>
    <div class="source-line"><svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"/></svg>依据当前学习画像与今日可用时间生成</div>
  `;
}

function resetConversation() {
  messages.innerHTML = "";
  addMessage("agent", welcomeMessage());
}

function detectIntent(text) {
  const normalized = text.trim().toLowerCase();
  if (/直接(给|告诉).*(答案|结果)|代写|帮我写作业|考试.*答案|作弊/.test(normalized)) return "cheating";
  if (/焦虑|紧张|难受|不想学|学不会|累|崩溃|难过/.test(normalized)) return "emotion";
  if (/诊断|测试|测一测|评估/.test(normalized)) return "diagnostic";
  if (/计划|安排|复习|进度|本周/.test(normalized)) return "plan";
  if (/一元一次|2\s*\(x|方程|移项|括号|未知数|写成了\s*2x|把\s*x\s*都|x\s*放|合并后|等式两边/.test(normalized)) return "equation";
  if (/函数|坐标|图像/.test(normalized)) return "function";
  if (/英语|单词|阅读|语法/.test(normalized)) return "english";
  if (/作文|阅读|语文|古诗/.test(normalized)) return "chinese";
  if (/为什么|怎么理解|讲讲|解释|提示|不会/.test(normalized)) return "explain";
  return "general";
}

function planResponse(text) {
  const requestedMinutes = Number((text.match(/(\d{1,2})\s*分钟/) || [])[1] || profile.minutes);
  const minutes = Math.max(10, Math.min(60, Number.isFinite(requestedMinutes) ? requestedMinutes : 25));
  const taskCount = minutes <= 15 ? 3 : 4;
  const base = Math.floor(minutes / taskCount);
  const remainder = minutes - base * taskCount;
  const tasks = [
    `用 ${base + remainder} 分钟回看“${profile.weakness}”的关键结论`,
    `用 ${base} 分钟做一个例题，每一步先自己猜`,
    `用 ${base} 分钟做 1-2 道题，只看提示不抄答案`,
    `用 ${base} 分钟说出“我这步为什么这样做”`
  ].slice(0, taskCount);
  return `
    <p>可以。${minutes} 分钟足够做一次<strong>完整的小闭环</strong>，不需要把所有内容都塞进来。</p>
    <div class="step-box">
      <span>知芽给你排的轻量计划</span>
      ${tasks.map((task, index) => `<p>${index + 1}. ${task}</p>`).join("")}
    </div>
    <p>现在只做第一项就够：<strong>不看笔记，说出“${escapeHTML(profile.weakness)}”里最关键的一句话。</strong>说错也没关系，我会接着问。</p>
    <div class="inline-actions">
      <button data-view-target="plan">把计划放进今日清单</button>
      <button data-prompt="请用苏格拉底提问带我复习${escapeHTML(profile.weakness)}">现在开始第一项</button>
    </div>
    <div class="source-line"><svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18"/></svg>依据可用时间、当前卡点与“先提示后讲解”偏好</div>
  `;
}

function equationResponse(text) {
  const direct = /2\s*\(\s*x\s*-\s*3\s*\)\s*=\s*4\s*x\s*\+\s*6/.test(text);
  if (!direct) {
    return `
      <p>我们先不急着跳到答案。解一元一次方程，核心不是背步骤，而是每一步都问：<strong>“我对等式两边做了什么？”</strong></p>
      <div class="step-box">
        <span>先做一个小检查</span>
        <strong>你看到括号时，通常会先展开，还是先想有没有更简单的路？</strong>
        <p>把你的第一反应发给我。说出来，比直接看步骤更有用。</p>
      </div>
      <p>如果你愿意，也可以把完整题目发来。我会根据你停下来的位置，只给刚好够用的提示。</p>
      <div class="source-line"><svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/></svg>方法依据：等式性质与分配律</div>
    `;
  }
  return `
    <p>这题很值得停下来。很多同学会一口气算完，但先盯住<strong>“哪一部分还能化简”</strong>，错误会少很多。</p>
    <div class="step-box">
      <span>第 1 层提示</span>
      <strong>左边 2(x − 3) 可以先变成什么？</strong>
      <p>试着用分配律写出“2 乘 x”和“2 乘 −3”。先不用管等号右边。</p>
    </div>
    <p>把你的第一步发给我。如果仍然不确定，回复“再提示一点”，我会给第 2 层提示，但先不揭晓最终答案。</p>
    <div class="inline-actions">
      <button data-prompt="我写成了2x减6，但接下来不确定怎么办">我展开了，下一步呢</button>
      <button data-prompt="再提示一点：2(x-3)=4x+6，先怎么做">再提示一点</button>
    </div>
    <div class="source-line"><svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"/></svg>知识点：分配律、移项变号；难度：七年级</div>
  `;
}

function emotionResponse() {
  return `
    <p>这种感觉是真的，不是你“矫情”或“不够努力”。当你同时面对很多不会的内容时，大脑很难决定先做哪一步。</p>
    <div class="step-box">
      <span>我们先把目标缩小</span>
      <strong>接下来 3 分钟只做一件事：找出“最不确定的那一步”，不用解决它。</strong>
      <p>比如打开一道错题，圈出你停住的位置，然后告诉我。</p>
    </div>
    <p>如果焦虑持续影响睡眠、吃饭或上学，请把这件事告诉信任的家长、老师或学校心理老师。你不需要一个人扛。</p>
    <div class="inline-actions">
      <button data-prompt="我找到了，是移项的时候不知道要不要变号">我已经找到卡点</button>
      <button data-view-target="plan">先看一个很轻的计划</button>
    </div>
  `;
}

function cheatingResponse() {
  return `
    <p>我可以帮你把解题过程讲懂，但不能替你提交作业答案或帮助考试作弊。那样短期会轻松，反而更难发现你真正卡住的地方。</p>
    <div class="step-box">
      <span>换个有用的方式</span>
      <strong>把题目和你的尝试发来。我会先看你的思路，只用问题提示下一步。</strong>
      <p>如果你完全不会，我们也可以从这道题需要的旧知识开始补。</p>
    </div>
    <div class="inline-actions"><button data-prompt="我想从最基础的等式性质开始学">从基础开始</button></div>
  `;
}

function functionResponse() {
  return `
    <p>函数最容易卡在“图像、表达式、表格在说同一件事”却彼此对不上。我们先用一个生活化画面：<strong>把函数看成一台有输入和输出的机器。</strong></p>
    <div class="step-box">
      <span>先问自己</span>
      <strong>x = 2 时，这台机器吐出的 y 是多少？</strong>
      <p>把函数表达式发给我，我帮你只关注一个点，再逐步连成图像。</p>
    </div>
    <div class="inline-actions">
      <button data-prompt="我想用生活化比喻理解一次函数图像">换个比喻</button>
      <button data-prompt="给我一道一次函数入门题，先不告诉我答案">给我一道入门题</button>
    </div>
  `;
}

function englishResponse() {
  return `
    <p>英语学习可以拆成三条线：<strong>听懂、读懂、说出来</strong>。先不要同时追三件事。</p>
    <div class="step-box">
      <span>先选一个最小入口</span>
      <strong>把你今天最想解决的英语问题发来：一个单词、一段阅读，还是语法规则？</strong>
      <p>我会先检查你已经认识什么，再从最近发展区给提示。</p>
    </div>
    <div class="inline-actions">
      <button data-prompt="用10分钟帮我记一组和校园生活有关的英语单词">10 分钟记单词</button>
      <button data-prompt="我想练习英语阅读，先教我找主旨句">练习阅读</button>
    </div>
  `;
}

function chineseResponse() {
  return `
    <p>语文不需要“标准感受”。好的答案来自两个动作：<strong>回到原文找依据，再说清楚你的判断。</strong></p>
    <div class="step-box">
      <span>先把范围缩小</span>
      <strong>把原文片段或作文题目发来，同时告诉我：你目前最不确定的是“理解”还是“表达”？</strong>
    </div>
    <p>我会用追问帮你形成自己的观点，而不是给一篇可直接抄写的范文。</p>
    <div class="inline-actions">
      <button data-prompt="帮我练习从原文找依据回答阅读理解题">练阅读找依据</button>
      <button data-prompt="作文开头写不出来，请用提问帮我找素材">帮我找作文素材</button>
    </div>
  `;
}

function generalResponse() {
  return `
    <p>我听懂了：你想要的不是一句现成结论，而是<strong>知道下一步怎么学</strong>。</p>
    <div class="step-box">
      <span>先收窄到一个动作</span>
      <strong>能告诉我具体题目、知识点，或者你现在停在哪一步吗？</strong>
      <p>例如：“我会展开括号，但移项时总忘记变号。”信息越具体，我越能给出适合你的提示。</p>
    </div>
    <div class="inline-actions">
      <button data-prompt="我想做一次5分钟学情诊断">先做个诊断</button>
      <button data-prompt="帮我制定今天的学习计划">安排今天</button>
    </div>
    <div class="source-line"><svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18"/></svg>下一步：收集一道真实题目或一个具体学习目标</div>
  `;
}

function buildResponse(text) {
  if (/写成了\s*2x\s*减\s*6/.test(text)) {
    return {
      intent: "equation",
      html: `
        <p>很好，第一步已经对了。现在左边是 <strong>2x − 6</strong>，所以等式变成：</p>
        <div class="step-box"><strong>2x − 6 = 4x + 6</strong><p>下一步，你更愿意先把 x 都放左边，还是都放右边？先选一边，并说出你要做的运算。</p></div>
        <div class="inline-actions"><button data-prompt="我想把x都放左边，两边同时减去4x">把 x 都放左边</button><button data-prompt="我想把x都放右边，两边同时减去2x">把 x 都放右边</button></div>
      `
    };
  }
  if (/把\s*x\s*都放左边|两边同时减去\s*4x/.test(text)) {
    return {
      intent: "equation",
      html: `
        <p>方向是对的。只要两边同时减去 4x，等式仍然成立。</p>
        <div class="step-box"><span>你先完成这一步</span><strong>2x − 4x − 6 = 6</strong><p>左边还能合并成什么？只写这一小步，不要求一次做到最后。</p></div>
        <div class="inline-actions"><button data-prompt="合并后是负2x减6等于6，接下来呢">我合并好了</button><button data-prompt="再提示一点，为什么两边做同样运算等式不变">讲讲等式为什么不变</button></div>
      `
    };
  }
  if (/把\s*x\s*都放右边|两边同时减去\s*2x/.test(text)) {
    return {
      intent: "equation",
      html: `
        <p>也可以，把 x 集中到哪一边都能得到同一个答案。只要记住：<strong>两边必须做同样的运算。</strong></p>
        <div class="step-box"><span>第 1 小步</span><strong>−6 = 4x − 2x + 6</strong><p>右边 4x − 2x 可以合并成什么？先只写这一步。</p></div>
        <div class="inline-actions"><button data-prompt="右边合并后是2x，接下来6要怎么处理">我合并好了</button></div>
      `
    };
  }
  if (/合并后是负\s*2x|两边加\s*6|加\s*6/.test(text)) {
    return {
      intent: "equation",
      html: `
        <p>对，现在关键的一步是让 <strong>−6</strong> 离开左边。想一想：等式两边同时加 6，会发生什么？</p>
        <div class="step-box"><span>只做这一个动作</span><strong>−2x − 6 + 6 = 6 + 6</strong><p>先自己把两边化简，再告诉我结果。最后一步也由你来完成。</p></div>
        <div class="inline-actions"><button data-prompt="化简后是负2x等于12，最后怎么求x">我化简好了</button></div>
      `
    };
  }
  if (/负\s*2x\s*等于\s*12|最后怎么求\s*x/.test(text)) {
    return {
      intent: "equation",
      html: `
        <p>你离答案只差一个“把负号也一起处理”的动作。不要直接去掉负号，先问：怎样让 x 前面的系数变成 1？</p>
        <div class="step-box"><strong>两边同时除以 −2</strong><p>这一步由你写：−2x ÷ (−2) = 12 ÷ (−2)。算完后，用原式代入检验，看看两边是否相等。</p></div>
        <div class="inline-actions"><button data-prompt="我算出x等于负6，怎么代回原方程检验">教我代入检验</button></div>
      `
    };
  }
  const intent = detectIntent(text);
  switch (intent) {
    case "cheating": return { html: cheatingResponse(), intent };
    case "emotion": return { html: emotionResponse(), intent };
    case "plan": return { html: planResponse(text), intent };
    case "equation": return { html: equationResponse(text), intent };
    case "function": return { html: functionResponse(), intent };
    case "english": return { html: englishResponse(), intent };
    case "chinese": return { html: chineseResponse(), intent };
    case "diagnostic": return { html: "", intent };
    case "explain": return { html: equationResponse(text), intent };
    default: return { html: generalResponse(), intent };
  }
}

function sendPrompt(rawText) {
  const text = rawText.trim();
  if (!text) return;

  addMessage("user", escapeHTML(text).replace(/\n/g, "<br>"));
  promptInput.value = "";
  resizeTextarea();
  $("#suggestionArea").style.display = "none";

  const response = buildResponse(text);
  if (response.intent === "diagnostic") {
    const typingId = addTyping();
    window.setTimeout(() => {
      removeTyping(typingId);
      addMessage("agent", "<p>好，我们用 3 个小问题找卡点。不要查资料，按第一反应作答就可以。</p>");
      openQuiz();
    }, 500);
    return;
  }

  const typingId = addTyping();
  window.setTimeout(() => {
    removeTyping(typingId);
    addMessage("agent", response.html);
    if (response.intent === "equation" && /再提示一点/.test(text)) {
      addMessage("agent", `
        <p>第 2 层提示：分配律可以这样想，“括号外的人，要敲两次门”。</p>
        <div class="step-box"><strong>2 × x = 2x；2 × (−3) = −6</strong><p>所以先把它改写成 2x − 6 = 4x + 6。现在停下来，别急着往下算：你准备让 x 留在哪一边？</p></div>
      `);
    }
  }, 520);
}

function resizeTextarea() {
  promptInput.style.height = "34px";
  promptInput.style.height = `${Math.min(promptInput.scrollHeight, 100)}px`;
}

function switchView(name) {
  const titles = { learn: "学习舱", plan: "今日计划", review: "错题复盘", report: "成长报告", about: "智能体说明" };
  $$(".view").forEach(view => view.classList.toggle("active", view.id === `${name}View`));
  $$(".nav-item[data-view-target]").forEach(item => item.classList.toggle("active", item.dataset.viewTarget === name));
  $("#viewTitle").textContent = titles[name] || "学习舱";
  closeMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openMenu() {
  sidebar.classList.add("open");
  scrim.classList.add("show");
}

function closeMenu() {
  sidebar.classList.remove("open");
  scrim.classList.remove("show");
}

function openProfile() {
  $("#nameInput").value = profile.name;
  $("#gradeInput").value = profile.grade;
  $("#subjectInput").value = profile.subject;
  $("#weaknessInput").value = profile.weakness;
  $("#minutesInput").value = profile.minutes;
  $("#minutesValue").textContent = `${profile.minutes} 分钟`;
  $("#styleInput").value = profile.style;
  profileModal.showModal();
  closeMenu();
}

function openQuiz() {
  quizState.index = 0;
  quizState.answers = [];
  quizState.selected = null;
  renderQuiz();
  quizModal.showModal();
}

const quizQuestions = [
  {
    prompt: "解方程 2x + 3 = 11，第一步你最想做什么？",
    options: ["两边同时减 3", "两边同时除以 2", "把 3 移到右边，符号不变", "先代入 x = 1 试试"],
    answer: 0,
    concept: "等式性质"
  },
  {
    prompt: "方程 3(x − 2) = 9，展开括号后应该得到？",
    options: ["3x − 2 = 9", "3x + 2 = 9", "3x − 6 = 9", "x − 6 = 9"],
    answer: 2,
    concept: "去括号"
  },
  {
    prompt: "把 5x − 4 = 2x + 8 中的 2x 移到左边，正确变化是？",
    options: ["5x + 2x = 8 + 4", "5x − 2x = 8 + 4", "5x − 2x = 8 − 4", "5x + 2x = 8 − 4"],
    answer: 1,
    concept: "移项变号"
  }
];

const quizState = { index: 0, answers: [], selected: null };

function renderQuiz() {
  if (quizState.index >= quizQuestions.length) {
    renderQuizResult();
    return;
  }
  const question = quizQuestions[quizState.index];
  $("#quizProgress").style.width = `${((quizState.index + 1) / quizQuestions.length) * 100}%`;
  $("#quizTitle").textContent = `第 ${quizState.index + 1} 题，共 ${quizQuestions.length} 题`;
  $("#quizContent").innerHTML = `
    <div class="quiz-question">
      <span>知识点：${question.concept}</span>
      <h3>${question.prompt}</h3>
      <div class="quiz-options">
        ${question.options.map((option, index) => `
          <button class="quiz-option ${quizState.selected === index ? "selected" : ""}" data-option="${index}">
            <i>${String.fromCharCode(65 + index)}</i><span>${option}</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;
  $("#quizNext").textContent = quizState.index === quizQuestions.length - 1 ? "看诊断结果" : "下一题";
  $("#quizNext").disabled = quizState.selected === null;

  $$(".quiz-option").forEach(option => option.addEventListener("click", () => {
    quizState.selected = Number(option.dataset.option);
    renderQuiz();
  }));
}

function renderQuizResult() {
  const score = quizState.answers.filter((answer, index) => answer === quizQuestions[index].answer).length;
  $("#quizProgress").style.width = "100%";
  $("#quizTitle").textContent = "你的起点，不是标签";
  $("#quizContent").innerHTML = `
    <div class="quiz-result">
      <div class="result-score">${score}<small>/${quizQuestions.length}</small></div>
      <h3>${score === 3 ? "基础判断很稳" : score >= 2 ? "有一个关键卡点值得补" : "先把等式性质拿稳"}</h3>
      <p>${score === 3 ? "你已经有清晰的解题方向。下一步不是多刷题，而是把过程讲清楚，检验迁移能力。" : "诊断不是为了给你打分，而是把复习范围缩小。今晚只需要处理一个最需要补的概念。"}</p>
      <div class="result-bars">
        <div class="mastery-item"><div><span>等式性质</span><strong>${quizState.answers[0] === 0 ? "已理解" : "需回顾"}</strong></div><div class="bar"><i style="width:${quizState.answers[0] === 0 ? 82 : 42}%"></i></div></div>
        <div class="mastery-item warm"><div><span>去括号</span><strong>${quizState.answers[1] === 2 ? "已理解" : "需复习"}</strong></div><div class="bar"><i style="width:${quizState.answers[1] === 2 ? 76 : 43}%"></i></div></div>
        <div class="mastery-item needs"><div><span>移项变号</span><strong>${quizState.answers[2] === 1 ? "已理解" : "建议专练"}</strong></div><div class="bar"><i style="width:${quizState.answers[2] === 1 ? 74 : 36}%"></i></div></div>
      </div>
    </div>
  `;
  $("#quizNext").textContent = "带着结果回到学习舱";
  $("#quizNext").disabled = false;
}

$("#quizNext").addEventListener("click", () => {
  if (quizState.index >= quizQuestions.length) {
    quizModal.close();
    switchView("learn");
    addMessage("agent", `
      <p>诊断结果已经更新到学习画像。我们把目标收窄到<strong>${quizState.answers[2] === 1 ? "把移项的理由讲清楚" : "移项变号"}</strong>。</p>
      <div class="step-box"><span>下一步</span><strong>先看一句话：移项时，为什么符号要反过来？用你的话说说看。</strong></div>
      <div class="inline-actions"><button data-prompt="我想换个生活化比喻理解移项变号">给我一个比喻</button><button data-prompt="给我一道移项变号的入门题">直接试一题</button></div>
    `);
    showToast("学习画像已更新");
    return;
  }

  quizState.answers[quizState.index] = quizState.selected;
  quizState.index += 1;
  quizState.selected = null;
  renderQuiz();
});

$("#closeQuiz").addEventListener("click", () => quizModal.close());

$("#profileForm").addEventListener("submit", event => {
  event.preventDefault();
  profile = {
    name: $("#nameInput").value.trim() || "同学",
    grade: $("#gradeInput").value,
    subject: $("#subjectInput").value,
    weakness: $("#weaknessInput").value.trim() || "当前重点",
    minutes: Number($("#minutesInput").value),
    style: $("#styleInput").value
  };
  planTasks = makePlan(profile.minutes);
  saveProfile();
  setProfileUI();
  renderPlan();
  resetConversation();
  profileModal.close();
  showToast("已按你的新画像调整建议");
});

$("#cancelProfile").addEventListener("click", () => profileModal.close());
$("#closeProfileTop").addEventListener("click", () => profileModal.close());

$("#minutesInput").addEventListener("input", event => {
  $("#minutesValue").textContent = `${event.target.value} 分钟`;
});

composer.addEventListener("submit", event => {
  event.preventDefault();
  sendPrompt(promptInput.value);
});

promptInput.addEventListener("input", resizeTextarea);
promptInput.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    composer.requestSubmit();
  }
});

document.addEventListener("click", event => {
  const promptTrigger = event.target.closest("[data-prompt]");
  if (promptTrigger) {
    const text = promptTrigger.dataset.prompt;
    switchView("learn");
    sendPrompt(text);
    return;
  }
  const viewTrigger = event.target.closest("[data-view-target]");
  if (viewTrigger) {
    event.preventDefault();
    switchView(viewTrigger.dataset.viewTarget);
  }
});

$("#menuButton").addEventListener("click", openMenu);
scrim.addEventListener("click", closeMenu);
$("#openProfile").addEventListener("click", openProfile);
$("#adjustProfileTop").addEventListener("click", openProfile);
$("#openSettings").addEventListener("click", openProfile);
$("#logoutButton").addEventListener("click", () => {
  sessionStorage.removeItem("zhya-demo-auth");
  window.location.href = "login.html";
});
$("#newConversation").addEventListener("click", () => {
  resetConversation();
  showToast("已经换成一个新话题");
});
$("#regeneratePlan").addEventListener("click", openProfile);
$("#addPlanTask").addEventListener("click", () => {
  const title = window.prompt("想加上什么学习任务？");
  if (!title?.trim()) return;
  planTasks.push({ id: `custom-${Date.now()}`, title: title.trim(), detail: "我自己添加的小目标", minutes: 5, done: false });
  saveProfile();
  renderPlan();
  renderWeek();
  showToast("已加入今日计划");
});

$$(".report-period button").forEach(button => button.addEventListener("click", () => {
  $$(".report-period button").forEach(item => item.classList.remove("active"));
  button.classList.add("active");
  showToast(button.textContent === "近 7 天" ? "正在查看近 7 天学习变化" : "近 30 天完整数据将在正式版开放");
}));

setProfileUI();
renderPlan();
renderWeek();
resetConversation();
