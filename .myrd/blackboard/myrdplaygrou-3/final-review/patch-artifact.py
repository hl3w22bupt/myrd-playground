# -*- coding: utf-8 -*-
"""终审产物回写：读最新 goal artifacts → 追加终审条目 → 生成 PATCH body。
前置断言：现 artifacts 恰 10 条且三项 ID 在场（防止并发漂移下误写）。"""
import json

d = json.load(open('/tmp/goal-fresh.json'))
arts = d['data']['goal']['artifacts']
assert len(arts) == 10, "expected 10 artifacts, got %d" % len(arts)
blob = json.dumps(arts, ensure_ascii=False)
assert 'cmwaqvrnc002jm9m2nqwfsoie' in blob
assert 'cmwax345r002km97avs9jgvxa' in blob

entry = {
    "artifactType": "review",
    "op": "final_review",
    "status": "completed",
    "title": "《实况足球》线上终审：liveUrl 公网可玩达成 + 触屏音频取证 + 三项回写核验补齐（试玩打分待用户）",
    "detail": "【试玩验收 · 线上终审】三项部署事实（单一产物显式齐备）：HostedApp id=cmwaqvrnc002jm9m2nqwfsoie；deployment id=cmwax345r002km97avs9jgvxa（status=running，mode=bundle，deployedBy=human，gitRef=myrd/game-3-goal-cmwaqvrng002lm9m2nftdd20h@88b7469）；liveUrl=https://leomac-studio.tail49399e.ts.net/apps/myrdplaygrou-3/。①公网可玩=达成：GET / 200（585,156B 单文件游戏本体，sha256=b04c437895013a36e96fb753f59c67b77ce517f4653226c00cb353ed7e48ce6d 与部署锚定值逐字节一致）、/health 200 ok(app=myrdplaygrou-3)、/gw 200；fresh 取证包（experience-harness mobile 视口，归档 .myrd/blackboard/myrdplaygrou-3/final-review/2026-11-10T18-03-14-final-review-live/）：15 步、6 次触屏输入全部到达且全部画面响应（开球/暂停/恢复 frameDiff=400）、金币 ×2/得分 10/时钟递减证明带球收集循环真实运转、console errors=0、network 3 项全 200、FPS mean 11.3（headless 读数）。②触屏音频=取证齐备、听感归人：线上 commit 代码契约 unlockAudio() 首触建 AudioContext+resume（六处手势入口，零音频文件，失败不致命）；线上探针 typeof __audioDebug=undefined（IP7 诊断钩子属打磨轮、未部署），console 零报错；音质听感留给用户打分卡 Q3。③版本警示：线上=打磨前基点 88b7469，打磨四轮（摇杆方向倒置修复 touch.js moveZ 取反/相机重取景/金币立体化/粒子/IP7+IP8 钩子）未部署——现线上版上推摇杆球员倒退为已知已修未部署项，请勿据现线上版对方向手感打最终分；新版部署归宿主 deploy_playable。④试玩打分：打分卡（template=mini_game_playtest，requestKey=playtest_cmwaqvrng002lm9m2nftdd20h）已发出待回填，未回填前 ac-human-playtest 记「待回填」；本终审自动化口径=达成，好不好玩待用户。终审报告：.myrd/blackboard/myrdplaygrou-3/final-review/final-review-20261111.md"
}

arts.append(entry)
json.dump({"artifacts": arts}, open('/tmp/patch-body.json', 'w'), ensure_ascii=False)
print("staged body with", len(arts), "artifacts; new entry title =", entry["title"][:40])
