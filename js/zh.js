/* 中文 for TT Fence Builder: the words on the page, the toasts, the level banner, the ? panel, and the canvas text in the
   3D scene (BOING!, ACHOO!, BRRR!, wrapped in Kit.lang.t in js/view.js). The 中文 logo is FB.TITLE_ZH (围栏大作战).
   Kid-friendly words from the brief: 围栏, 占地, 皮球, 百分比, 图画.
   Stays in English on purpose: the kids' names (TEDDY, TOMMY), the game's name in the tab and the ? panel, and key labels. */
(function () {
  const L = Kit.lang;
  L.keep(['TEDDY', 'TOMMY', 'Teddy', 'Tommy', FB.TITLE, 'Esc', 'Shift', '❚❚']);
  const PIC = { PANDA: '熊猫', ROCKET: '火箭', 'DRAGON BOAT': '龙舟', WHALE: '鲸鱼', 'BIRTHDAY CAKE': '生日蛋糕' };
  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', JUICE: '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };

  L.add({
    // title screen
    'Teddy & Tommy fence the field and find the picture!': 'Teddy 和 Tommy 建围栏占地，找出藏起来的图画！',
    'Teddy + Tommy together': 'Teddy 和 Tommy 一起玩',
    '1 PLAYER': '单人', '2 PLAYERS': '双人',
    '🐣 EASY': '🐣 简单', '🔥 NORMAL': '🔥 普通', 'START AT PICTURE': '从这幅图画开始',
    // HUD and touch
    PICTURE: '图画', 'HI-SCORE': '最高分', 'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)',
    'press T': '按 T', 'tap for another freeze': '再点一下，再冻一次', 'HIGH FIVE! ✋': '击掌！✋', 'HIGH FIVE': '击掌',
    BUILD: '建围栏', SLOW: '慢慢建',
    // the banner and toasts
    "What's hiding under the field?": '空地下面藏着什么图画？',
    'BOING! THE FENCE SNAPPED BACK!': '嘣！围栏弹回去啦！',
    'OUT OF LIVES! 💔': '没有生命了！💔', 'KEEP GOING! ❤️': '继续加油！❤️',
    '✋ HIGH FIVE! THE BALL FREEZES!': '✋ 击掌！皮球冻住啦！',
    // screens
    PAUSED: '暂停', '▶ PLAY': '▶ 继续', '↻ START THIS PICTURE AGAIN': '↻ 这幅图画重新开始', '🏠 MENU': '🏠 菜单',
    'OH NO!': '哎呀！', 'KEEP GOING!': '继续加油！', 'YOU DID IT!': '你做到了！', 'PLAY AGAIN': '再玩一次',
    // in the 3D scene (canvas text)
    'BOING!': '嘣！', 'ACHOO!': '阿嚏！', 'BRRR!': '冻住！',
    // the ? panel
    'walk along the garden edge': '沿着花园边走', 'build a fence (hold, and step into the field)': '建围栏（按住，走进空地）',
    'build slowly: double points (hold)': '慢慢建：分数加倍（按住）', 'call your brother · high five': '叫兄弟来帮忙 · 击掌',
    'pause · sound': '暂停 · 声音', 'P or Esc · M': 'P 或 Esc · M', 'L-Shift': '左 Shift', 'R-Shift': '右 Shift',
    '1 player: either set of keys works. Walk back along your fence to roll it up again.': '单人时两套按键都能用。沿着围栏往回走，就能把围栏收回来。',
    'The pad moves you. Hold BUILD (or 🐢 SLOW) and step off the garden to build a fence. 2 players: Teddy has the pad on the left, Tommy the one on the right. The round face button (top right) calls your brother.':
      '用方向盘走路。按住“建围栏”（或 🐢 慢慢建）走出花园，就能建围栏。双人时 Teddy 用左边的方向盘，Tommy 用右边的。右上角的圆形头像按钮可以叫兄弟来帮忙。',
  });

  const N = '(TEDDY|TOMMY)';
  L.rule(new RegExp(`^CALL ${N}$`), '叫 $1');
  L.rule(new RegExp(`^${N} IS HERE!$`), '$1 来啦！');
  L.rule(new RegExp(`^${N} IS COMING TO HELP!$`), '$1 来帮忙啦！');
  L.rule(new RegExp(`^${N} SAYS: FREEZE, BALL! ❄️$`), '$1 说：皮球，冻住！❄️');
  L.rule(new RegExp(`^BYE BYE, ${N}! 👋$`), '$1 拜拜！👋');
  L.rule(new RegExp(`^BOING! THE BALL HIT ${N}'S FENCE! 💔$`), '嘣！皮球撞到了 $1 的围栏！💔');
  L.rule(new RegExp(`^ACHOO! A BUG SNEEZED ON ${N}! 💔$`), '阿嚏！小虫子对着 $1 打了个喷嚏！💔');
  L.rule(new RegExp(`^(\\S+) (ICE CREAM|WATER|JUICE|COOKIE|WATERMELON|BANANA) FROM ${N}!( \\+❤️)?$`), (m, e, item, who, heal) => `${e} ${who} 送来的${TREAT[item]}！${heal || ''}`);
  L.rule(/^IT'S A (PANDA|ROCKET|DRAGON BOAT|WHALE|BIRTHDAY CAKE)! (\S+)$/, (m, name, e) => `是${PIC[name]}！${e}`);
  L.rule(/^PICTURE (\d+) DONE! \+([\d,]+) 🎉$/, '第 $1 幅图画完成！+$2 🎉');
  L.rule(/^PICTURE (\d+) OF (\d+)$/, '第 $1 幅图画（共 $2 幅）');
  L.rule(/^Fence off (\d+)% of the field to find out!$/, '用围栏占地 $1%，就能看到啦！');
  L.rule(/^🐢 SLOW BUILD! DOUBLE POINTS: \+([\d,]+)$/, '🐢 慢慢建！分数加倍：+$1');
  L.rule(/^WOW! A BIG GARDEN! (\d+)%$/, '哇！好大的花园！$1%');
  L.rule(/^ready in (\d+)$/, '$1 秒后可以');
  L.rule(/^HIGH FIVE IN (\d+)…$/, '$1 秒后可以击掌…');
  L.rule(/^SCORE ([\d,]+)$/, '得分 $1');
  L.rule(/^HI-SCORE ([\d,]+)$/, '最高分 $1');
  L.rule(/^NEW HI-SCORE! ([\d,]+)$/, '新的最高分！$1');
  L.rule(/^Out of lives on picture (\d+)\. Keep going: your garden stays!$/, '第 $1 幅图画没有生命了。继续加油：你的花园会留着！');
  L.rule(/^(Teddy and Tommy|Teddy|Tommy) found all (\d+) hidden pictures!$/, (m, who, n) => `${who === 'Teddy and Tommy' ? 'Teddy 和 Tommy' : who} 找到了全部 ${n} 幅藏起来的图画！`);
})();
