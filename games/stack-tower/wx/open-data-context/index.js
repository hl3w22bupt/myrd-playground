/**
 * 开放数据域入口（B0 · spec v1.3 content.platform wx-open-data-rank 条目落点）。
 *
 * 职责：sharedCanvas 上渲染好友排行；数据仅来自 wx.getFriendCloudStorage（开放数据域内），
 * 主包经 wx.postMessage 触发重渲（消息只带触发语义，不带好友数据——开放数据域隔离红线）。
 * token 引主包同一份变量文件：色板只从 ./tokens.js 取（构建期生成，禁手抄第二份）。
 */
const tokens = require('./tokens.js');
const rank = require('./rank.js');

const sharedCanvas = wx.getSharedCanvas();
const ctx = sharedCanvas.getContext('2d');

/** devtools / 合成数据渲染口径：无真实好友分时渲染占位结构（B0 判据 = 管线就绪，不卡真实好友分） */
const state = { friends: [], self: null };

function draw() {
  rank.renderRank(ctx, sharedCanvas.width, sharedCanvas.height, tokens, state);
}

draw();

// 主包触发（wx.postMessage）：只收指令，不收好友数据
wx.onMessage((msg) => {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'rank-render') draw();
  if (msg.type === 'self-score' && typeof msg.payload === 'object') {
    state.self = msg.payload;
    draw();
  }
});

// 好友数据：开放数据域内 API（真机 + 正式 AppID 下生效；devtools 走合成数据）
try {
  wx.getFriendCloudStorage({
    keyList: ['stack_tower_best'],
    success(res) {
      state.friends = (res.data || []).map((u) => ({
        nickname: u.nickname,
        avatarUrl: u.avatarUrl,
        score: extractBest(u),
      }));
      draw();
    },
    fail() {
      draw(); // 拉取失败保持占位渲染（不抛错、不阻塞）
    },
  });
} catch (e) {
  draw(); // API 不存在（低版本基础库）：占位渲染
}

function extractBest(user) {
  const row = (user.KVDataList || []).find((kv) => kv.key === 'stack_tower_best');
  return row ? Number(row.value) || 0 : 0;
}
