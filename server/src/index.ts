import { Hono } from "hono";
import { ctx } from "#apphost";
import { getAsset } from "./lib/asset-store";
import { isOverSized, latest, parseAnswers, record, totalReceived } from "./lib/feedback-store";
import { GAME_PAGE_HTML } from "./game-page";

const app = new Hono();

// 平台契约：健康检查（编排健康探针依据，部署后 30s 内必须 200）。
// 资产走懒加载（首请求才拉取），/health 不等待资产就绪。
// 身份常量按分支归属：本分支（myrd/video-yiroukegang-goal-*）只承载视频工坊应用
// myrdplaygrou-2 的部署（manifestPath=videos/myrdplaygrou-2/apphost.toml）；
// PvZ 应用（myrdplaygrou）部署自 main，其壳身份在 main 上不受本分支改动影响。
app.get("/health", (c) =>
  c.json({
    ok: true,
    app: "myrdplaygrou-2",
    title: "以柔克刚",
    kind: "video-screening",
    env: ctx.environment,
    assets: "lazy/object-storage",
  }),
);

// 游戏落地页（/ 是唯一豁免 /api 前缀护栏的业务路径）。
// W-3 串线收口：落地页按部署清单解析 —— 清单带 landing.html 的游戏（各自构建产出，
// 引用一律走 api/public/assets/* 相对路径）伺服自己的页面；无 landing.html 的部署
// （game-9 Godot 壳等历史形态）回落内置 GAME_PAGE_HTML，行为不变。
app.get("/", async (c) => {
  const landing = await getAsset("landing.html");
  if (landing) {
    return c.body(landing.body, 200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    });
  }
  return c.html(GAME_PAGE_HTML);
});

/**
 * 游戏静态资产（底座 A：资产出 bundle，运行时从对象存储懒加载 + 内存缓存）。
 * - 壳页面请求的 `.gz.b64` 后缀是形态约定：gzip+base64 文本 → 映射回清单里的真实文件名；
 * - `:name{.+}` 必须匹配嵌套资产名（wheat-squad 等纯 Web 游戏的 src/**.mjs 镜像），单段 `:name` 会 404；
 * - encoding=raw：文本资产（Godot 引导 js / audio worklet），按源 contentType 伺服；
 * - encoding=gzip+b64：二进制资产（wasm / pck）的 base64 文本。
 *   M1 网关只透传文本：octet-stream / gzip 会被 502 UNSUPPORTED_BINARY 拒绝，
 *   二进制走文本通道又会被 UTF-8 转码破坏 —— 所以二进制必须 base64 化，
 *   由浏览器端 base64 → Uint8Array → DecompressionStream('gzip') 还原后喂给引擎。
 */
app.get("/api/public/assets/:name{.+}", async (c) => {
  const name = c.req.param("name");
  const asset = await getAsset(name.replace(/\.gz\.b64$/, ""));
  if (!asset) {
    return c.text(`asset not found: ${name}`, 404);
  }
  // `.b64` = 视频通道：mp4 预编码的 base64 文本资产（videos/myrdplaygrou-2/apphost/*.mp4.b64）。
  // 平台按扩展名给它的 contentType 是 application/octet-stream，会撞 M1 网关二进制拦截
  // （502 UNSUPPORTED_BINARY）——必须以 text/plain 出站；浏览器端 atob → Blob(video/mp4)
  // 还原后喂 <video> 与下载链接（landing.html 同口径）。
  const isB64TextAsset = name.endsWith(".b64") && !name.endsWith(".gz.b64");
  const contentType =
    asset.encoding === "raw" && !isB64TextAsset ? asset.contentType : "text/plain; charset=utf-8";
  return c.body(asset.body, 200, {
    "Content-Type": contentType,
    "Cache-Control": "public, max-age=300",
  });
});

/**
 * 试玩反馈四问中继（?tuning=1 面板一键提交的落点；客户端常量在
 * games/myrdplaygrou/scripts/tuning_feedback.gd RELAY_PATH —— 两端路径必须同改）。
 *
 * 职责边界（docs/tuning-feedback-four-questions.md §数据流）：
 *   - POST 收下「用户亲手点选的四问答案 + 面板生成的修订建议载荷」，服务端校验答案形态后留痕；
 *   - GET latest 供 goal agent 取回提交（owner 拍板 tuning_applied 后由 agent 走平台
 *     POST /api/v1/game-design-specs/:id/revisions 正式入链）；
 *   - 本中继不连平台、不持任何凭证、不代做修订 —— revisions 会产生新 approved 版本，
 *     拍板权在目标 owner；数值权威在 GDScript 映射层（冒烟第 21 项机判）。
 */
app.post("/api/public/feedback/spec-revision", async (c) => {
  const bodyText = await c.req.text();
  if (isOverSized(bodyText)) {
    return c.json({ success: false, error: { code: "PAYLOAD_TOO_LARGE", message: "反馈载荷超限（>32KB）" } }, 413);
  }
  let body: unknown;
  try {
    body = JSON.parse(bodyText) as unknown;
  } catch {
    return c.json({ success: false, error: { code: "BAD_JSON", message: "反馈载荷不是合法 JSON" } }, 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return c.json({ success: false, error: { code: "BAD_SHAPE", message: "反馈载荷必须是对象" } }, 400);
  }
  const payload = body as Record<string, unknown>;
  const answers = parseAnswers(payload.answers);
  if (answers === null) {
    return c.json({
      success: false,
      error: { code: "INVALID_ANSWERS", message: "四问答案缺一或形态非法（q1/q2 三选一枚举、q3/q4 星值 1-5）" },
    }, 422);
  }
  // 建议载荷只透传不校验数值（形态上必须带 kind 标记，防止把别的数据当建议留痕）
  const suggestionRaw = payload.suggestion;
  const suggestion =
    typeof suggestionRaw === "object" && suggestionRaw !== null && !Array.isArray(suggestionRaw)
    && (suggestionRaw as Record<string, unknown>).kind === "playtest-four-questions"
      ? suggestionRaw as Record<string, unknown>
      : null;
  const submission = record(answers, suggestion);
  return c.json({
    received: true,
    receivedAt: submission.receivedAt,
    submissions: totalReceived,
    forwarded: false,
    next: "goal agent 从 GET /api/public/feedback/spec-revision/latest 取回；目标 owner 拍板 tuning_applied 后由 agent 走平台 revisions API 入链",
  });
});

// goal agent 取回最新提交（不鉴权：内容为玩法反馈，无个人敏感信息）
app.get("/api/public/feedback/spec-revision/latest", (c) => {
  const submission = latest();
  if (submission === null) {
    return c.json({ received: false, reason: "no-submission-yet" }, 404);
  }
  return c.json({
    received: true,
    receivedAt: submission.receivedAt,
    answers: submission.answers,
    suggestion: submission.suggestion,
    remindder: "入链前以平台最新 approved spec 重算差异；tuning_applied 待目标 owner 拍板",
  });
});

export default app;
