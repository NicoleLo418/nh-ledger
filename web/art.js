// 主畫面插圖：會隨進度升級的房子、N 與 H 兩位人物、細節版大頭照
// 純 SVG 字串，沒有任何個資
(function () {
  const SKIN = '#F2C9A5', SKIN_D = '#E4B48E';

  // ───────── 房子（0：小木屋 → 4：山頂豪宅） ─────────
  function mound(stage) {
    const left = stage >= 3 ? 226 : 236;
    return `<path d="M${left} 47 C${left + 5} 41.6 ${left + 10} 40.6 ${left + 16} 40.6 L292 40.6 C297 41 301 43.5 304 47 L${left} 47Z" fill="#7DBA74"/>`;
  }
  function cabin() {
    return `
      <rect x="250" y="27.5" width="27" height="13.5" fill="#8B5A3C"/>
      <g stroke="#6B4129" stroke-width=".55"><line x1="250" y1="31" x2="277" y2="31"/><line x1="250" y1="34.5" x2="277" y2="34.5"/><line x1="250" y1="38" x2="277" y2="38"/></g>
      <rect x="270" y="13" width="4.5" height="10" fill="#7A6F68"/><rect x="269.4" y="12" width="5.7" height="1.6" fill="#5F5650"/>
      <path d="M246 29 L263.5 15 L281 29Z" fill="#5A3E35"/><path d="M246 29 L263.5 15 L264.6 16.4 L248.2 29.6Z" fill="#7E5D4E"/>
      <rect x="253.5" y="31.2" width="7" height="6" fill="#3B2A22"/>
      <rect class="lit" x="253.5" y="31.2" width="7" height="6" fill="#FFCF6E" opacity="0"/>
      <g stroke="#D9C3A0" stroke-width=".6"><line x1="257" y1="31.2" x2="257" y2="37.2"/><line x1="253.5" y1="34.2" x2="260.5" y2="34.2"/></g>
      <rect x="264.5" y="31.5" width="6.2" height="9.5" fill="#5B3A24"/><circle cx="269.4" cy="36.4" r=".5" fill="#E2B866"/>
      <g class="smoke" fill="#F1F1EE"><circle cx="272" cy="11" r="2.2"/><circle cx="272" cy="11" r="2"/><circle cx="272" cy="11" r="2.4"/></g>`;
  }
  function porch() {
    return `
      <rect x="246" y="40" width="38" height="1.3" fill="#A0714E"/>
      <rect x="262" y="27.2" width="22" height="1.5" fill="#5A3E35"/>
      <rect x="282.4" y="28.6" width="1" height="11.6" fill="#E9D9BC"/>
      <g><circle cx="251" cy="39" r="1.3" fill="#E5636A"/><circle cx="253.2" cy="39.2" r="1.1" fill="#F2B84B"/><circle cx="249.2" cy="39.3" r="1" fill="#B07CE0"/></g>`;
  }
  function mailbox() {
    return `<rect x="240.6" y="34.6" width=".9" height="6.4" fill="#6B4A2F"/><rect x="238.6" y="32.4" width="5" height="2.8" rx="1.3" fill="#D9574A"/><rect x="243" y="31.4" width=".5" height="2" fill="#F0B23F"/>`;
  }
  function villa(stage) {
    const lux = stage >= 4;
    const glass = '#BFD9E6', frame = '#FFFFFF', wall = 'var(--house)', roof = 'var(--roof)', door = 'var(--door)';
    const win = (x, y, w, h) => `<rect x="${x - .5}" y="${y - .5}" width="${w + 1}" height="${h + 1}" fill="${frame}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${glass}"/><rect class="lit" x="${x}" y="${y}" width="${w}" height="${h}" fill="#FFCF6E" opacity="0"/><line x1="${x + w / 2}" y1="${y}" x2="${x + w / 2}" y2="${y + h}" stroke="${frame}" stroke-width=".45"/>`;
    const groundWins = lux
      ? win(247.6, 29, 10.4, 11) + win(272, 29, 10.4, 11)          // 豪宅：落地窗
      : win(249, 30.2, 8, 6) + win(273, 30.2, 8, 6);
    const rail = Array.from({ length: 11 }, (_, i) => `<line x1="${254.6 + i * 2.1}" y1="23.8" x2="${254.6 + i * 2.1}" y2="26.4" />`).join('');
    return `
      <rect x="276.5" y="4.5" width="3.8" height="9" fill="#7A6F68"/><rect x="275.9" y="3.6" width="5" height="1.4" fill="#5F5650"/>
      <g class="smoke" fill="#F1F1EE"><circle cx="278.4" cy="2.6" r="2.2"/><circle cx="278.4" cy="2.6" r="2"/><circle cx="278.4" cy="2.6" r="2.4"/></g>
      <rect x="245" y="27" width="40" height="14" fill="${wall}" stroke="#D8C3A0" stroke-width=".4"/>
      <rect x="247.5" y="16" width="35" height="11" fill="${wall}" stroke="#D8C3A0" stroke-width=".4"/>
      <path d="M243 16.8 L265 3.2 L287 16.8Z" fill="${roof}"/>
      <path d="M243 16.8 L265 3.2 L287 16.8" fill="none" stroke="${lux ? '#E3B341' : '#00000022'}" stroke-width="${lux ? .9 : .6}" stroke-linejoin="round"/>
      <circle cx="265" cy="10.6" r="2.1" fill="${frame}"/><circle cx="265" cy="10.6" r="1.6" fill="${glass}"/><circle class="lit" cx="265" cy="10.6" r="1.6" fill="#FFCF6E" opacity="0"/>
      ${groundWins}
      ${win(249.4, 18.4, 5, 5.2)}${win(276, 18.4, 5, 5.2)}
      <rect x="260.6" y="17.6" width="8.8" height="8.8" fill="${frame}"/><rect x="261.1" y="18.1" width="7.8" height="8.3" fill="${glass}"/><rect class="lit" x="261.1" y="18.1" width="7.8" height="8.3" fill="#FFCF6E" opacity="0"/><line x1="265" y1="18.1" x2="265" y2="26.4" stroke="${frame}" stroke-width=".45"/>
      <rect x="253.6" y="26.2" width="22.8" height="1.3" fill="#E9D9BC"/>
      <g stroke="#E9D9BC" stroke-width=".5">${rail}<line x1="253.8" y1="23.8" x2="276.2" y2="23.8" stroke-width=".7"/></g>
      ${lux ? '<g><circle cx="255.5" cy="23.2" r=".9" fill="#E5636A"/><circle cx="257.3" cy="23.3" r=".8" fill="#F7A8C0"/><circle cx="272.8" cy="23.2" r=".9" fill="#E5636A"/><circle cx="274.6" cy="23.3" r=".8" fill="#F7A8C0"/></g>' : ''}
      <path d="M261.4 41 L261.4 33.2 Q265 29.6 268.6 33.2 L268.6 41Z" fill="${door}"/><circle cx="267.2" cy="37.4" r=".5" fill="#E2B866"/>
      <rect x="259.6" y="29.6" width="10.8" height="1.2" rx=".4" fill="${roof}"/>
      <rect x="243.5" y="40.2" width="43" height="1.2" fill="#A0714E"/>
      ${lux ? `<g><rect x="258.4" y="36.5" width=".5" height="4" fill="#6B4A2F"/><circle cx="258.65" cy="35.6" r="1.9" fill="#4E9A5B"/><rect x="271.1" y="36.5" width=".5" height="4" fill="#6B4A2F"/><circle cx="271.35" cy="35.6" r="1.9" fill="#4E9A5B"/></g>` : ''}`;
  }
  function pool(stage) {
    const lux = stage >= 4;
    return `
      <path d="M284 41 L308 41 L311 55 C302 54 292 50 284 47Z" fill="#B9B2A6"/><rect x="284" y="40.4" width="24.4" height="1.4" fill="#7DBA74"/>
      <g stroke="#9E978B" stroke-width=".4"><line x1="288" y1="45" x2="308.8" y2="45"/><line x1="296" y1="49.5" x2="309.8" y2="49.5"/><line x1="294" y1="41.8" x2="294.4" y2="45"/><line x1="302" y1="45" x2="302.4" y2="49.5"/></g>
      <rect x="288.4" y="39.4" width="15.6" height="2.4" rx=".8" fill="#63C3E6"/>
      <path d="M289.6 40 q1.5 -.6 3 0 t3 0 t3 0 t3 0" stroke="#E6F7FF" stroke-width=".45" fill="none"/>
      <rect x="287.6" y="41.4" width="17.2" height=".9" fill="#FFFFFF"/>
      <g stroke="#C9CDD2" stroke-width=".4"><line x1="302.6" y1="37.6" x2="302.6" y2="41.3"/><line x1="303.8" y1="37.6" x2="303.8" y2="41.3"/></g>
      <line x1="306.4" y1="30" x2="306.4" y2="41" stroke="#6B4A2F" stroke-width=".5"/>
      <path d="M300.6 31.6 Q306.4 26.6 312.2 31.6Z" fill="${lux ? '#E3B341' : '#E5636A'}"/>
      <g><circle cx="231" cy="39" r="2.3" fill="#5AA864"/><circle cx="234.6" cy="38.6" r="2.6" fill="#4E9A5B"/><circle cx="231.8" cy="37.6" r=".6" fill="#F7A8C0"/><circle cx="235.2" cy="36.8" r=".6" fill="#FFFFFF"/></g>`;
  }
  function lights() {
    // 豪宅：燈串與庭園燈
    const string = (x1, y1, x2, y2, sag, n) => {
      let s = `<path d="M${x1} ${y1} Q${(x1 + x2) / 2} ${Math.max(y1, y2) + sag} ${x2} ${y2}" stroke="#5B5F63" stroke-width=".3" fill="none"/>`;
      for (let i = 1; i < n; i++) {
        const t = i / n, mx = (x1 + x2) / 2, my = Math.max(y1, y2) + sag;
        const x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2, y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2;
        s += `<circle class="twinkle" style="animation-delay:${(i * .37 % 2.8).toFixed(2)}s" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r=".55" fill="#FFE08A"/>`;
      }
      return s;
    };
    return string(286.6, 17.6, 306.2, 30.4, 4, 7) +
      `<line x1="236.6" y1="30" x2="236.6" y2="41" stroke="#3D3A36" stroke-width=".7"/><circle cx="236.6" cy="29.4" r="1.3" fill="#FFE08A"/>` +
      string(243.4, 17.6, 236.6, 29, 3.5, 5);
  }
  function house(stage) {
    stage = Math.max(0, Math.min(4, stage | 0));
    let s = mound(stage);
    if (stage >= 3) s += pool(stage);
    if (stage <= 1) s += cabin() + (stage >= 1 ? porch() : '');
    else s += villa(stage);
    if (stage >= 1) s += mailbox();
    if (stage >= 4) s += lights();
    return s;
  }
  const HOUSE_NOTE = ['', '小木屋多了門廊和信箱', '加蓋二樓和陽台！', '有花園和泳池了！', '山頂的家完成了！'];
  const GLOW = [[257, 34, 14], [257, 34, 15], [265, 27, 20], [265, 27, 22], [266, 27, 28]];

  // ───────── 山坡上的小人物（腳底在 0，面向右） ─────────
  const shoe = `<path d="M-1.3 -.95 L1.9 -.95 Q3.1 -.9 3.1 0 L-1.3 0Z" fill="#FFFFFF" stroke="#9AA3AA" stroke-width=".3"/>`;
  function hiker(id, who) {
    const N = who === 'N';
    const pack = N ? '#F2B84B' : '#6B8E4E', roll = N ? '#8EB6D9' : '#D9C08A';
    const leg = (cls, dx) => N
      ? `<g class="leg${cls}" transform="translate(${dx} 0)"><rect x="-1.1" y="-8.6" width="2.3" height="2.4" fill="#4C6A8F"/><rect x="-.85" y="-6.4" width="1.8" height="2.6" fill="${SKIN}"/><rect x="-.9" y="-3.9" width="1.9" height="3" fill="#F4F1EA"/>${shoe}</g>`
      : `<g class="leg${cls}" transform="translate(${dx} 0)"><rect x="-.9" y="-4.6" width="1.9" height="3.7" fill="#F4F1EA"/>${shoe}</g>`;
    const hairBack = N
      ? `<path d="M-2.6 -21.4 Q-3.1 -18.4 -1.4 -17.9 L.4 -18.6 Z" fill="#3A2A22"/>`
      : `<path d="M-2.4 -22 Q-4.6 -16 -3.4 -12.4 Q-1.6 -11.8 -.6 -13.6 L.2 -19.6Z" fill="#2B201C"/>`;
    const hairTop = N
      ? `<path d="M-2.8 -20.2 Q-2.4 -24.6 1.4 -24 Q4.4 -23.4 3.8 -20.6 Q2.2 -22.4 -.4 -21.6 Q-1.6 -20.8 -2.8 -20.2Z" fill="#3A2A22"/>`
      : `<path d="M-2.8 -20 Q-2.4 -24.8 1.4 -24.1 Q4.5 -23.4 3.9 -20.5 Q2 -22.6 -.6 -21.8 Q-1.8 -21 -2.8 -20Z" fill="#2B201C"/>`;
    const body = N
      ? `<path d="M-2.1 -17.2 Q.3 -18.7 2.7 -17.2 L2.6 -8.4 L-2.1 -8.4Z" fill="#D7E5F6"/>
         <g stroke="#5E8FCB" stroke-width=".38"><line x1="-1.3" y1="-17.4" x2="-1.3" y2="-8.4"/><line x1="-.2" y1="-17.8" x2="-.2" y2="-8.4"/><line x1="2" y1="-17.5" x2="2" y2="-8.4"/></g>
         <path d="M.35 -17.8 L1.6 -17.6 L1.6 -8.4 L.35 -8.4Z" fill="#FFFFFF"/>`
      : `<path d="M-2.1 -17.2 Q.3 -18.7 2.7 -17.2 L2.6 -13 L-2.1 -13Z" fill="#FFFFFF" stroke="#E2E2E2" stroke-width=".25"/>
         <rect x="-2" y="-13" width="4.5" height="1.1" fill="${SKIN}"/>
         <path d="M-2.3 -11.9 L2.8 -11.9 L3.7 -4.2 L-3.2 -4.2Z" fill="#8A8452"/>
         <rect x="-2.3" y="-11.95" width="5.1" height=".75" fill="#6F6A40"/>
         <rect x="1.4" y="-9.4" width="1.7" height="1.9" fill="#7A7447" stroke="#6F6A40" stroke-width=".25"/>`;
    const arm = N
      ? `<path d="M1.1 -16 L4.4 -11.8" stroke="#D7E5F6" stroke-width="1.8" stroke-linecap="round"/><circle cx="4.5" cy="-11.6" r=".75" fill="${SKIN}"/>`
      : `<path d="M1.1 -16 L2.3 -14.5" stroke="#FFFFFF" stroke-width="1.9" stroke-linecap="round"/><path d="M2.3 -14.5 L4.4 -11.8" stroke="${SKIN}" stroke-width="1.3" stroke-linecap="round"/>`;
    return `<g class="mover" id="${id}" role="button" tabindex="0" aria-label="看人物大圖"><g class="face"><g class="hk walk">
      <rect x="-6" y="-25.5" width="12" height="26" fill="transparent"/>
      ${leg(' b', -.5)}${leg('', .8)}
      <g class="torso">
        <rect x="-5.8" y="-17.6" width="4.8" height="8.2" rx="1.6" fill="${pack}"/>
        <rect x="-5.6" y="-19.3" width="4.2" height="2" rx="1" fill="${roll}"/>
        ${hairBack}${body}
        <circle cx=".6" cy="-20.6" r="3.1" fill="${SKIN}"/>${hairTop}
        <circle cx="2.3" cy="-20.6" r=".45" fill="#2A2A2A"/><circle cx="2.6" cy="-19.4" r=".55" fill="#F2A3A3" opacity=".7"/>
        <g class="arm">${arm}<line x1="4.4" y1="-12.2" x2="6.8" y2=".4" stroke="#5B5F63" stroke-width=".7"/></g>
      </g></g></g></g>`;
  }

  // ───────── 細節版大頭照（正面，viewBox 0 0 80 150） ─────────
  function sneaker(x, flip) {
    const s = flip ? -1 : 1;
    return `<g transform="translate(${x} 0) scale(${s} 1)">
      <path d="M-5.5 133 Q-6 127 -2 126.4 L2.4 126.4 Q4.4 128.6 7.6 129.6 Q9.4 130.4 9 133Z" fill="#FFFFFF" stroke="#A7AFB6" stroke-width=".6"/>
      <rect x="-5.8" y="132.4" width="15" height="2" rx="1" fill="#C9CED3"/>
      <g stroke="#A7AFB6" stroke-width=".5"><line x1="-.8" y1="127.6" x2="2.6" y2="128.4"/><line x1="-.4" y1="129.2" x2="3.6" y2="129.8"/></g></g>`;
  }
  function portrait(who) {
    const N = who === 'N';
    const hair = N ? '#3A2A22' : '#2B201C';
    const pack = N ? '#F2B84B' : '#6B8E4E';
    const back = N
      ? `<path d="M27 24 Q27 9 40 9 Q53 9 53 24 L53 33 Q50 35 47 33 L33 33 Q30 35 27 33Z" fill="${hair}"/>`
      : `<path d="M26.5 24 Q26.5 9 40 9 Q53.5 9 53.5 24 L55 66 Q48 70 40 68 Q32 70 25 66Z" fill="${hair}"/>`;
    const fringe = N
      ? `<path d="M28 23 Q29 11 40 11 Q51 11 52 23 Q47 17 41 18 Q36 19 33 16 Q31 20 28 23Z" fill="${hair}"/>`
      : `<path d="M28 24 Q28.5 11 40 11 Q51.5 11 52 24 Q49 18 44 17.4 Q38 17 34 19.4 Q30.6 21 28 24Z" fill="${hair}"/>`;
    const face = `<rect x="36.5" y="33" width="7" height="6" fill="${SKIN_D}"/>
      <circle cx="40" cy="24.5" r="11.5" fill="${SKIN}"/>${fringe}
      <ellipse cx="35.6" cy="26" rx="1.3" ry="1.7" fill="#2A2A2A"/><ellipse cx="44.4" cy="26" rx="1.3" ry="1.7" fill="#2A2A2A"/>
      <circle cx="36" cy="25.4" r=".45" fill="#FFF"/><circle cx="44.8" cy="25.4" r=".45" fill="#FFF"/>
      <ellipse cx="33" cy="29.6" rx="2.2" ry="1.3" fill="#F2A3A3" opacity=".6"/><ellipse cx="47" cy="29.6" rx="2.2" ry="1.3" fill="#F2A3A3" opacity=".6"/>
      <path d="M37.4 30.6 Q40 32.8 42.6 30.6" stroke="#9A5A4A" stroke-width=".9" fill="none" stroke-linecap="round"/>`;
    const packBehind = `<rect x="23" y="40" width="34" height="26" rx="6" fill="${pack}"/>`;
    const pole = (x) => `<line x1="${x}" y1="70" x2="${x + 6}" y2="135" stroke="#5B5F63" stroke-width="1.3" stroke-linecap="round"/><rect x="${x - 1.4}" y="63" width="2.8" height="8" rx="1.2" fill="#2F3337"/>`;
    let body;
    if (N) {
      const stripes = (x1, x2) => Array.from({ length: Math.floor((x2 - x1) / 2.2) }, (_, i) => `<line x1="${x1 + 1.1 + i * 2.2}" y1="38.5" x2="${x1 + 1.1 + i * 2.2}" y2="74"/>`).join('');
      body = `
        <path d="M23.5 42 Q22 56 23.4 66" stroke="#D7E5F6" stroke-width="6" stroke-linecap="round" fill="none"/>
        <path d="M56.5 42 Q58 56 56.6 66" stroke="#D7E5F6" stroke-width="6" stroke-linecap="round" fill="none"/>
        <g stroke="#5E8FCB" stroke-width=".7"><path d="M21.6 44 Q20.6 56 21.6 65" fill="none"/><path d="M25.4 44 Q24.4 56 25.4 65" fill="none"/><path d="M54.6 44 Q55.6 56 54.6 65" fill="none"/><path d="M58.4 44 Q59.4 56 58.4 65" fill="none"/></g>
        <circle cx="23.6" cy="68.6" r="2.8" fill="${SKIN}"/><circle cx="56.6" cy="68.6" r="2.8" fill="${SKIN}"/>
        <path d="M30 38 L50 38 L50.6 73 L29.4 73Z" fill="#FFFFFF"/>
        <path d="M37 38 Q40 41.6 43 38" stroke="#E2E2E2" stroke-width=".8" fill="none"/>
        <path d="M26 41 Q27 37.6 31 37.6 L36 37.6 L35.6 75 L27 75 Z" fill="#D7E5F6"/>
        <path d="M54 41 Q53 37.6 49 37.6 L44 37.6 L44.4 75 L53 75 Z" fill="#D7E5F6"/>
        <g stroke="#5E8FCB" stroke-width=".7">${stripes(26.4, 35.6)}${stripes(44.4, 53.6)}</g>
        <path d="M31 37.6 L36 37.6 L34.4 43.6Z" fill="#C7DAF0"/><path d="M49 37.6 L44 37.6 L45.6 43.6Z" fill="#C7DAF0"/>
        <rect x="31" y="38" width="2.6" height="22" rx="1" fill="#C98F2E" opacity=".9"/><rect x="46.4" y="38" width="2.6" height="22" rx="1" fill="#C98F2E" opacity=".9"/>
        <path d="M29 73 L51 73 L52 89 L41 89 L40 80 L39 89 L28 89Z" fill="#4C6A8F"/>
        <g stroke="#3A5576" stroke-width=".6"><line x1="40" y1="74" x2="40" y2="80"/><path d="M30 76 Q33 78 35 76" fill="none"/><path d="M45 76 Q47 78 50 76" fill="none"/></g>
        <rect x="30.6" y="89" width="7" height="17" fill="${SKIN}"/><rect x="42.4" y="89" width="7" height="17" fill="${SKIN}"/>
        <rect x="30.4" y="105" width="7.4" height="22" rx="1.2" fill="#F4F1EA" stroke="#B9C3CC" stroke-width=".7"/><rect x="42.2" y="105" width="7.4" height="22" rx="1.2" fill="#F4F1EA" stroke="#B9C3CC" stroke-width=".7"/>
        <g fill="#B9C3CC"><rect x="30.4" y="106.4" width="7.4" height="1"/><rect x="30.4" y="108.4" width="7.4" height="1"/><rect x="42.2" y="106.4" width="7.4" height="1"/><rect x="42.2" y="108.4" width="7.4" height="1"/></g>
        ${sneaker(33.4, true)}${sneaker(46.6, false)}`;
    } else {
      body = `
        <path d="M24.6 41 L23 46" stroke="#FFFFFF" stroke-width="6.4" stroke-linecap="round"/>
        <path d="M55.4 41 L57 46" stroke="#FFFFFF" stroke-width="6.4" stroke-linecap="round"/>
        <path d="M23 47 Q21.6 57 23.4 66" stroke="${SKIN}" stroke-width="4.6" stroke-linecap="round" fill="none"/>
        <path d="M57 47 Q58.4 57 56.6 66" stroke="${SKIN}" stroke-width="4.6" stroke-linecap="round" fill="none"/>
        <circle cx="23.6" cy="68.6" r="2.8" fill="${SKIN}"/><circle cx="56.6" cy="68.6" r="2.8" fill="${SKIN}"/>
        <path d="M27 41 Q28 37.4 33 37.4 L47 37.4 Q52 37.4 53 41 L51.6 57 L28.4 57Z" fill="#FFFFFF" stroke="#E2E2E2" stroke-width=".6"/>
        <path d="M37 37.6 Q40 40.8 43 37.6" stroke="#E2E2E2" stroke-width=".8" fill="none"/>
        <path d="M29 57 L51 57 L50.6 62 L29.4 62Z" fill="${SKIN}"/>
        <path d="M29 62 L51 62 L56 121 L24 121Z" fill="#8A8452"/>
        <rect x="28.6" y="61.4" width="22.8" height="3.2" fill="#6F6A40"/>
        <g fill="#6F6A40"><rect x="31.6" y="61.4" width="1.6" height="3.2"/><rect x="46.8" y="61.4" width="1.6" height="3.2"/></g>
        <line x1="40" y1="64.6" x2="40" y2="121" stroke="#6F6A40" stroke-width=".7"/>
        <g><rect x="24.6" y="80" width="9" height="11" rx="1" fill="#7E7849" stroke="#6F6A40" stroke-width=".6"/><path d="M24.4 80 L33.8 80 L33.8 83.6 L24.4 83.6Z" fill="#6F6A40"/><circle cx="29.1" cy="82.4" r=".7" fill="#C8B98A"/></g>
        <g><rect x="46.4" y="80" width="9" height="11" rx="1" fill="#7E7849" stroke="#6F6A40" stroke-width=".6"/><path d="M46.2 80 L55.6 80 L55.6 83.6 L46.2 83.6Z" fill="#6F6A40"/><circle cx="50.9" cy="82.4" r=".7" fill="#C8B98A"/></g>
        <g stroke="#6F6A40" stroke-width=".6" stroke-dasharray="1.2 1"><line x1="26" y1="118" x2="54" y2="118"/></g>
        <rect x="31" y="120" width="7" height="7.6" rx="1" fill="#F4F1EA" stroke="#B9C3CC" stroke-width=".7"/><rect x="42" y="120" width="7" height="7.6" rx="1" fill="#F4F1EA" stroke="#B9C3CC" stroke-width=".7"/>
        <g fill="#B9C3CC"><rect x="31" y="121" width="7" height=".9"/><rect x="42" y="121" width="7" height=".9"/></g>
        ${sneaker(33.6, true)}${sneaker(46.4, false)}
        <rect x="31.4" y="37.6" width="2.4" height="17" rx="1" fill="#4F6E3C"/><rect x="46.2" y="37.6" width="2.4" height="17" rx="1" fill="#4F6E3C"/>`;
    }
    return `<svg viewBox="0 0 80 150" class="portrait" aria-hidden="true">
      <ellipse cx="40" cy="136" rx="22" ry="3" fill="#00000018"/>
      ${packBehind}${back}${body}${face}${pole(58)}</svg>`;
  }

  window.NHArt = { house, hiker, portrait, HOUSE_NOTE, GLOW };
})();
