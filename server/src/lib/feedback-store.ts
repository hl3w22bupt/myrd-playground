/**
 * 试玩反馈四问中继存储（内存留痕，进程生命周期内有效）。
 *
 * 定位（games/myrdplaygrou/docs/tuning-feedback-four-questions.md §数据流）：
 *   游戏内 ?tuning=1 面板一键提交 → 本中继收下并留痕 → goal agent 用 GET latest 取回
 *   用户亲手提交的答案 → 目标 owner 在 goal 会话拍板 tuning_applied →
 *   agent 走平台 POST /api/v1/game-design-specs/:id/revisions 正式入链。
 *
 * 本模块刻意不连平台、不持任何凭证：
 *   - 修订入链必须经 owner 拍板（revisions 会产生新 approved 版本），中继不代做；
 *   - 数值权威在 GDScript 映射层（tuning_feedback.gd，冒烟第 21 项机判），中继只透传留痕。
 *
 * 容量：只保留最近 KEEP_SIZE 条（最新提交语义已够 agent 取回；防内存涨），单条 >32KB 拒收。
 */

export interface FeedbackSubmission {
  /** 服务器收妥时刻（ISO 8601，UTC） */
  receivedAt: string;
  /** 四问答案（服务器校验过形态后的原样透传；用户亲手输入） */
  answers: Answers;
  /** 面板生成的 spec.numeric 修订建议载荷（只透传，不做数值权威） */
  suggestion: Record<string, unknown> | null;
}

const KEEP_SIZE = 10;
const MAX_BODY_CHARS = 32 * 1024;

const history: FeedbackSubmission[] = [];

/** 已收妥的提交总笔数（含被滚动挤出的旧提交） */
export let totalReceived = 0;

/** 与 games/myrdplaygrou/scripts/tuning_feedback.gd 的选项常量同源（两端任一改名必须同改） */
const DURATION_OPTIONS = ['too_short', 'just_right', 'too_long'] as const;
const DIFFICULTY_OPTIONS = ['too_easy', 'just_right', 'too_hard'] as const;

/** 服务端校验后的四问答案形态（可选字段仅在用户提供时存在） */
export interface Answers {
  q1_duration: string;
  q2_difficulty: string;
  q2_difficulty_level?: number;
  q3_tension_stars: number;
  q4_fun_stars: number;
  q4_suggestion?: string;
}

export function isOverSized(bodyText: string): boolean {
  return bodyText.length > MAX_BODY_CHARS;
}

/**
 * 服务器侧答案形态校验（不信任客户端；只认四问键，多余键丢弃）。
 * 返回 null = 形态非法（四问缺一 / 枚举越界 / 星值不在 1-5）。
 * 注意：本函数只做「形态」，不做「数值权威」—— 修订建议的生成逻辑在 GDScript 映射层。
 */
export function parseAnswers(raw: unknown): Answers | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const q1 = input.q1_duration;
  const q2 = input.q2_difficulty;
  if (typeof q1 !== 'string' || !DURATION_OPTIONS.includes(q1 as never)) return null;
  if (typeof q2 !== 'string' || !DIFFICULTY_OPTIONS.includes(q2 as never)) return null;
  const q3 = input.q3_tension_stars;
  const q4 = input.q4_fun_stars;
  if (typeof q3 !== 'number' || !Number.isInteger(q3) || q3 < 1 || q3 > 5) return null;
  if (typeof q4 !== 'number' || !Number.isInteger(q4) || q4 < 1 || q4 > 5) return null;
  const parsed: Answers = {
    q1_duration: q1,
    q2_difficulty: q2,
    q3_tension_stars: q3,
    q4_fun_stars: q4,
  };
  if (input.q2_difficulty_level !== undefined) {
    const level = input.q2_difficulty_level;
    if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 8) return null;
    parsed.q2_difficulty_level = level;
  }
  if (input.q4_suggestion !== undefined) {
    const note = input.q4_suggestion;
    if (typeof note !== 'string' || note.length > 200) return null;
    const trimmed = note.trim();
    if (trimmed.length > 0) parsed.q4_suggestion = trimmed;
  }
  return parsed;
}

export function record(answers: Answers, suggestion: Record<string, unknown> | null): FeedbackSubmission {
  const submission: FeedbackSubmission = {
    receivedAt: new Date().toISOString(),
    answers,
    suggestion,
  };
  history.push(submission);
  totalReceived += 1;
  while (history.length > KEEP_SIZE) history.shift();
  return submission;
}

export function latest(): FeedbackSubmission | null {
  return history.length > 0 ? history[history.length - 1] : null;
}
