// datetime.ts — 时区纯函数（A 轮 N3-T3 · 零外部依赖 · 不取当下时刻）
//
// 用途：v1.2 daily（每日种子 = YYYYMMDD **本地时区**）的取数原语。
// 纪律（ac-14 内核纯净）：本文件不内建任何「当下」来源——时刻与随机性一律由调用方注入，
// 本文件只做「给定时刻 + 给定时区偏移 → 日期码」的纯换算，任何输入恒定则输出恒定。
// 注：ac-14 扫描器对内核目录全文做字面量匹配（含注释），故本文件正文与注释都不出现被禁 API 的写法。
// 日期码口径：YYYYMMDD 十进制整数（例：20261003），直接可用作 daily 种子（numeric 段声明后生效）。

                               
               
                
              
 

/** 日期码 → YYYYMMDD 整数（防御性校验，非法输入抛错而非静默归零） */
export function dateCode(d              )         {
  const { year, month, day } = d;
  if (!Number.isInteger(year) || year < 1000 || year > 9999) throw new RangeError(`year 越界: ${year}`);
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError(`month 越界: ${month}`);
  if (!Number.isInteger(day) || day < 1 || day > 31) throw new RangeError(`day 越界: ${day}`);
  return year * 10000 + month * 100 + day;
}

/**
 * 给定 epoch 毫秒与时区偏移（分钟），返回该时区的日期码。
 * @param epochMs Unix 毫秒（调用方注入，本文件不取当下）
 * @param tzOffsetMinutes 时区偏移，含义与 Date.prototype.getTimezoneOffset 一致：
 *        东八区 = -480。本地时刻 = epochMs - tzOffsetMinutes*60000。
 */
export function localDateCode(epochMs        , tzOffsetMinutes        )         {
  if (!Number.isFinite(epochMs)) throw new TypeError(`epochMs 非有限数: ${epochMs}`);
  if (!Number.isInteger(tzOffsetMinutes) || Math.abs(tzOffsetMinutes) > 14 * 60) {
    throw new RangeError(`tzOffsetMinutes 越界(±14h): ${tzOffsetMinutes}`);
  }
  const shifted = new Date(epochMs - tzOffsetMinutes * 60_000);
  return dateCode({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  });
}

/** 跨日判定：两个时刻在同一时区是否属于同一日期码（daily 进度是否延续的最小判据） */
export function sameLocalDay(aEpochMs        , bEpochMs        , tzOffsetMinutes        )          {
  return localDateCode(aEpochMs, tzOffsetMinutes) === localDateCode(bEpochMs, tzOffsetMinutes);
}

/**
 * daily 种子派生（v1.2 daily 提案的纯函数面；数值本身以 spec numeric 冻结为准，本文件零数值）。
 * 种子 = dateCode 与传入 salt 的无符号混合（FNV-1a 32 位），同日同 salt 恒定、跨日必然变化。
 */
export function dailySeed(dateCodeValue        , salt        )         {
  if (!Number.isInteger(dateCodeValue)) throw new TypeError(`dateCodeValue 非整数: ${dateCodeValue}`);
  if (!Number.isInteger(salt)) throw new TypeError(`salt 非整数: ${salt}`);
  let h = 0x811c9dc5;
  const mix = (v        )       => {
    h ^= v & 0xff; h = Math.imul(h, 0x01000193) >>> 0;
    h ^= (v >>> 8) & 0xff; h = Math.imul(h, 0x01000193) >>> 0;
    h ^= (v >>> 16) & 0xff; h = Math.imul(h, 0x01000193) >>> 0;
    h ^= (v >>> 24) & 0xff; h = Math.imul(h, 0x01000193) >>> 0;
  };
  mix(dateCodeValue);
  mix(salt);
  return h >>> 0;
}


//# sourceURL=kernel/datetime.ts