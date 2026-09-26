// 各政党の直近の公約（ゲーム用に簡略化したモックデータ）  2026年9月26日時点で整理
//
// 出典：
//   第51回衆院選（2026/2/8投開票）各党公約
//     日本経済新聞「衆議院選挙2026 各政党の公約一覧」 https://www.nikkei.com/special/election/manifesto
//     政治データベース「政党公約比較 2026年衆院選」    https://seiji-db.jp/manifestos/
//     Pontaポイントコラム「2026年衆院選 各党の選挙公約を比較」 https://column.finance.ponta.jp/archives/680/
//   議席：第51回衆院選の結果 https://ja.wikipedia.org/wiki/第51回衆議院議員総選挙
//   政党の動き：中道改革連合 https://ja.wikipedia.org/wiki/中道改革連合
//
// 注意：
//   - title / summary は各党公約の要旨。fx（勢力ごとの支持率変化）・cost はゲーム用の仮定。
//   - 反応のセリフは fx から自動生成する（自民党は ldp_policies.js に個別のセリフあり）。
//   - 中道改革連合は2026年9月に分裂（公明党系は公明党へ復党、立憲系は「民主改革の会」を結成）。
//     公明党・民主改革の会には独自の新公約がまだないため、衆院選時の中道改革連合の公約を引き継ぐ扱い。

window.PARTIES = [
  { id: 'ldp',   name: '自由民主党',   short: '自民',     color: '#e0473f', seats: 316, bloc: 'ruling', source: '2026 衆院選公約・施政方針' },
  { id: 'ishin', name: '日本維新の会', short: '維新',     color: '#3fae5a', seats: 36,  bloc: 'ruling', source: '2026 衆院選公約' },
  { id: 'chudo', name: '中道（公明党・民主改革の会）', short: '中道', color: '#4a7fd9', seats: 49, bloc: 'opp',
    source: '2026 衆院選公約（中道改革連合）', note: '衆院選時は中道改革連合。2026年9月に分裂し、公明党と民主改革の会に。衆院では「中道」会派を結成' },
  { id: 'dpfp',  name: '国民民主党',   short: '国民',     color: '#f5b82e', seats: 28,  bloc: 'opp', source: '2026 衆院選公約' },
  { id: 'sansei',name: '参政党',       short: '参政',     color: '#ff8a3d', seats: 15,  bloc: 'opp', source: '2026 衆院選公約' },
  { id: 'mirai', name: 'チームみらい', short: 'みらい',   color: '#35c1c9', seats: 11,  bloc: 'opp', source: '2026 衆院選公約' },
  { id: 'jcp',   name: '日本共産党',   short: '共産',     color: '#c43a5a', seats: 4,   bloc: 'opp', source: '2026 衆院選公約' },
  { id: 'reiwa', name: 'れいわ新選組', short: 'れいわ',   color: '#e75fa8', seats: 1,   bloc: 'opp', source: '2026 衆院選公約' },
  { id: 'hoshu', name: '日本保守党',   short: '保守',     color: '#6b7bd6', seats: 0,   bloc: 'opp', source: '2026 衆院選公約' },
  { id: 'sdp',   name: '社会民主党',   short: '社民',     color: '#4db3e6', seats: 0,   bloc: 'opp', source: '2026 衆院選公約' },
  { id: 'genzei',name: '減税日本・ゆうこく連合', short: '減税', color: '#a08457', seats: 1, bloc: 'opp', source: '—', note: '公約データ未収録' },
];

// fx: 勢力ごとの支持率変化（仮定）  yM yF mM mF oM oF big sme agr uni us cn as(諸外国)
window.PARTY_POLICIES = [
  // ---- 日本維新の会 ----
  { id: 'ishin_food', party: 'ishin', cat: '物価高対策', icon: 'fa-basket-shopping', title: '飲食料品の消費税を2年間ゼロ、その後8%へ',
    summary: '飲食料品の消費税を2年間非課税にし、中長期的には8%へ引き下げる。スケジュールは国民会議で検討。',
    keywords: '消費税.*8%|飲食料品.*2年', cost: 2, fx: { oM: 4, oF: 5, mF: 4, sme: -2, big: -2 } },
  { id: 'ishin_hoken', party: 'ishin', cat: '社会保障', icon: 'fa-hospital', title: '社会保険料を年6万円引き下げ',
    summary: '医療費を年4兆円以上削減し、現役世代の社会保険料を年6万円引き下げる。',
    keywords: '社会保険料|医療費.*削減|現役世代', cost: 2, fx: { yM: 5, yF: 5, mM: 5, mF: 3, oM: -6, oF: -6, big: 3 } },
  { id: 'ishin_3go', party: 'ishin', cat: '社会保障', icon: 'fa-people-roof', title: '第三号被保険者制度の廃止',
    summary: '会社員の配偶者が保険料を払わずに年金を受け取れる第三号被保険者制度を廃止する。',
    keywords: '第三号|3号被保険者|専業主婦', cost: 1, fx: { mF: -7, oF: -3, yF: 3, big: 2 } },
  { id: 'ishin_koshen', party: 'ishin', cat: '統治機構', icon: 'fa-check-to-slot', title: '首相公選制・一院制の導入',
    summary: '首相を国民が直接選ぶ首相公選制と、国会の一院制を導入する。',
    keywords: '首相公選|一院制|統治機構', cost: 2, fx: { yM: 4, yF: 2, mM: 2, oM: -3, oF: -2 } },
  { id: 'ishin_gaikoku', party: 'ishin', cat: '外国人政策', icon: 'fa-passport', title: '在留外国人の量的マネジメント',
    summary: '在留外国人の数を管理する「量的マネジメント」を明記する。',
    keywords: '量的マネジメント|在留外国人', cost: 1, fx: { oM: 5, oF: 3, mM: 2, big: -5, as: -5 } },
  { id: 'ishin_spy', party: 'ishin', cat: '安全保障', icon: 'fa-user-secret', title: 'スパイ防止法の早期成立',
    summary: 'スパイ防止関連法案を速やかに成立させ、防衛装備移転の「5類型」を撤廃する。',
    keywords: 'スパイ防止|5類型|防衛装備', cost: 1, fx: { oM: 4, mM: 3, us: 4, cn: -8, yF: -2 } },

  // ---- 中道（公明党・民主改革の会） ----
  { id: 'chudo_food', party: 'chudo', cat: '物価高対策', icon: 'fa-basket-shopping', title: '食料品の消費税を恒久ゼロに',
    summary: '今秋から食料品の消費税を恒久的にゼロにする。財源は政府系ファンド「ジャパン・ファンド」、基金の見直し、剰余金。',
    keywords: '恒久.*ゼロ|ジャパン・?ファンド|政府系ファンド', cost: 2, fx: { oM: 5, oF: 6, mF: 5, yF: 2, big: -3 } },
  { id: 'chudo_credit', party: 'chudo', cat: '社会保障', icon: 'fa-scale-balanced', title: '給付付き税額控除で中低所得者を支援',
    summary: '中低所得者向けに、減税と給付を組み合わせる給付付き税額控除を創設する。',
    keywords: '中低所得', cost: 1, fx: { yM: 3, yF: 4, mF: 3, uni: 3 } },
  { id: 'chudo_130', party: 'chudo', cat: '手取り', icon: 'fa-wallet', title: '「130万円の壁」の解消',
    summary: '社会保険料の負担が生じる年収130万円の壁を解消する。',
    keywords: '130万', cost: 1, fx: { mF: 6, yF: 3, sme: 2 } },
  { id: 'chudo_edu', party: 'chudo', cat: '子育て・教育', icon: 'fa-flask', title: '教育・科学技術予算を倍増',
    summary: '教育と科学技術の予算を倍にする。',
    keywords: '科学技術|教育予算|予算.*倍増', cost: 2, fx: { yM: 4, yF: 4, mF: 3, mM: 2, big: 2 } },
  { id: 'chudo_work', party: 'chudo', cat: '働き方', icon: 'fa-business-time', title: '定年制廃止と週休3日制',
    summary: '定年制を廃止し、週休3日制を導入。女性正社員比率の公表を義務付ける。',
    keywords: '週休3日|定年制|定年.*廃止', cost: 1, fx: { yM: 4, yF: 5, oM: 3, big: -5, sme: -5, uni: 3 } },
  { id: 'chudo_house', party: 'chudo', cat: '暮らし', icon: 'fa-house', title: '家賃補助と安価な住宅の提供',
    summary: '生活者を守るため、家賃補助や安い住宅の提供を進める。',
    keywords: '家賃|住宅|住まい', cost: 1, fx: { yM: 6, yF: 6, mF: 2 } },
  { id: 'komei_lunch', party: 'chudo', cat: '子育て・教育', icon: 'fa-utensils', title: '小学校給食費の無償化（公明党）',
    summary: '小学校の給食費を2026年度から無償化する。※公明党の従来公約',
    keywords: '給食', cost: 1, fx: { mF: 6, mM: 3 } },

  // ---- 国民民主党 ----
  { id: 'dpfp_tax5', party: 'dpfp', cat: '物価高対策', icon: 'fa-percent', title: '消費税を5%に減税',
    summary: '実質賃金が持続的にプラスになるまで、消費税を一律5%に下げる。インボイス制度は廃止。',
    keywords: '消費税を?5%|消費税率を?5%|5%に減税|インボイス', cost: 2, fx: { oM: 4, oF: 5, mF: 4, mM: 3, sme: 6, big: -4 } },
  { id: 'dpfp_care', party: 'dpfp', cat: '社会保障', icon: 'fa-user-nurse', title: '介護・看護・保育士の給与を倍増',
    summary: '介護職員、看護師、保育士の給与を倍にする。',
    keywords: '介護|看護|保育士', cost: 2, fx: { mF: 6, oF: 4, oM: 3, uni: 4 } },
  { id: 'dpfp_eduBond', party: 'dpfp', cat: '子育て・教育', icon: 'fa-graduation-cap', title: '教育国債で高校まで完全無償化',
    summary: '年5兆円の教育国債を発行し、高校までの教育を完全無償化する。',
    keywords: '教育国債|完全無償', cost: 2, fx: { mF: 6, mM: 3, yF: 3, oM: -2 } },
  { id: 'dpfp_child', party: 'dpfp', cat: '子育て・教育', icon: 'fa-children', title: '年少扶養控除の復活・支援金廃止',
    summary: '「子ども・子育て支援金」を廃止し、児童手当の拡充と年少扶養控除の復活を行う。',
    keywords: '扶養控除|支援金.*廃止', cost: 1, fx: { mF: 5, mM: 4, yF: 2 } },
  { id: 'dpfp_sme', party: 'dpfp', cat: '賃上げ', icon: 'fa-handshake', title: '賃上げ中小企業の社会保険料を半減',
    summary: '賃上げした中小企業について、社会保険料の事業主負担を半分にする。',
    keywords: '事業主負担|中小企業.*半減', cost: 1, fx: { sme: 8, uni: 3, yM: 2 } },
  { id: 'dpfp_nuke', party: 'dpfp', cat: 'エネルギー', icon: 'fa-atom', title: '原発の再稼働・建て替え・新増設',
    summary: '原子力発電所の再稼働に加え、リプレース（建て替え）や新増設を進める。',
    keywords: 'リプレース|新増設', cost: 1, fx: { big: 7, sme: 4, mF: -6, yF: -3, cn: -1 } },

  // ---- 参政党 ----
  { id: 'sansei_tax0', party: 'sansei', cat: '物価高対策', icon: 'fa-ban', title: '消費税とインボイスの廃止',
    summary: '消費税を廃止し、インボイス制度もなくす。',
    keywords: '消費税.*廃止|消費税.*なくす', cost: 3, fx: { oM: 6, oF: 6, sme: 8, mM: 4, mF: 4, big: -6, us: -2 } },
  { id: 'sansei_10man', party: 'sansei', cat: '子育て・教育', icon: 'fa-sack-dollar', title: '0〜15歳に月10万円の教育給付金',
    summary: '15歳までの子ども1人あたり月10万円の教育給付金を支給する。',
    keywords: '月10万|教育給付金', cost: 3, fx: { mF: 9, mM: 5, yF: 5, oM: -5, oF: -3, big: -3 } },
  { id: 'sansei_agency', party: 'sansei', cat: '外国人政策', icon: 'fa-building-shield', title: '外国人総合政策庁の新設',
    summary: '外国人政策をまとめる「外国人総合政策庁」を新設し、不法滞在の取り締まりを強化する。',
    keywords: '外国人総合政策庁|取り締まり', cost: 1, fx: { oM: 6, oF: 4, mM: 3, big: -6, as: -8, cn: -4 } },
  { id: 'sansei_food', party: 'sansei', cat: '農業', icon: 'fa-seedling', title: '食料自給率を10年で倍増',
    summary: '食料自給率を10年で倍にし、2050年に100%を目指す。',
    keywords: '自給率.*(倍|100)', cost: 2, fx: { agr: 10, oM: 2, us: -4 } },
  { id: 'sansei_solar', party: 'sansei', cat: 'エネルギー', icon: 'fa-solar-panel', title: 'メガソーラー推進の見直し',
    summary: 'メガソーラーなどの再生可能エネルギー推進策を見直す。',
    keywords: 'メガソーラー|再エネ.*見直|再生可能', cost: 1, fx: { agr: 4, oM: 3, yF: -3, big: -2 } },

  // ---- チームみらい ----
  { id: 'mirai_keep', party: 'mirai', cat: '財政', icon: 'fa-shield', title: '消費税率は維持',
    summary: '主要政党で唯一、消費税の減税を掲げず税率を維持する。',
    keywords: '消費税.*維持|消費税.*据え置', cost: 1, fx: { big: 4, oM: -4, oF: -4, sme: -3 } },
  { id: 'mirai_childTax', party: 'mirai', cat: '子育て・教育', icon: 'fa-baby', title: '子育て減税',
    summary: '子どもの数に応じて親の所得税率を下げる「子育て減税」をつくる。',
    keywords: '子育て減税|子どもの数', cost: 1, fx: { mF: 6, mM: 5, yF: 3 } },
  { id: 'mirai_ai', party: 'mirai', cat: '経済成長', icon: 'fa-robot', title: 'AI・ロボット・自動運転の社会実装',
    summary: 'AI、ロボティクス、自動運転を社会で実際に使えるようにする。',
    keywords: '自動運転|ロボ|AI.*(社会|実装)', cost: 2, fx: { big: 6, yM: 5, yF: 2, uni: -4, sme: -2 } },
  { id: 'mirai_learn', party: 'mirai', cat: '子育て・教育', icon: 'fa-laptop-code', title: 'AIでオーダーメイド学習',
    summary: 'AIを活用して一人ひとりに合わせた学習を提供する。大学の運営費交付金も拡充。',
    keywords: 'オーダーメイド|個別最適|運営費交付金', cost: 1, fx: { mF: 4, yM: 3, yF: 3 } },

  // ---- 日本共産党 ----
  { id: 'jcp_tax', party: 'jcp', cat: '物価高対策', icon: 'fa-percent', title: '消費税を5%に減税、将来は廃止',
    summary: '消費税を5%に下げ、将来は廃止する。インボイス制度は撤廃。',
    keywords: '将来.*廃止', cost: 2, fx: { oM: 4, oF: 5, sme: 6, mF: 3, big: -6 } },
  { id: 'jcp_wage', party: 'jcp', cat: '賃上げ', icon: 'fa-arrow-trend-up', title: '最低賃金を全国一律1500〜1700円に',
    summary: '最低賃金を全国一律で1500〜1700円に引き上げる。',
    keywords: '1700円|全国一律', cost: 1, fx: { uni: 8, yM: 5, yF: 6, sme: -10, big: -3, agr: -2 } },
  { id: 'jcp_anpo', party: 'jcp', cat: '安全保障', icon: 'fa-dove', title: '安保法の廃止、軍事費増額に反対',
    summary: '安全保障関連法を廃止し、安保関連3文書を撤回。軍事費の増額に反対する。',
    keywords: '安保法.*廃止|3文書.*撤回|軍事費', cost: 1, fx: { us: -12, cn: 6, mF: 3, oM: -5, mM: -4 } },
  { id: 'jcp_bessei', party: 'jcp', cat: '暮らし', icon: 'fa-ring', title: '選択的夫婦別姓の導入',
    summary: '結婚後も夫婦がそれぞれの姓を名乗れる選択的夫婦別姓を実現する。',
    keywords: '夫婦別姓|別姓', cost: 1, fx: { yF: 6, yM: 2, mF: 3, oM: -5, oF: -2 } },
  { id: 'jcp_gap', party: 'jcp', cat: '働き方', icon: 'fa-venus-mars', title: '男女の賃金格差の是正',
    summary: '男性と女性の賃金格差をなくす。',
    keywords: '賃金格差|男女', cost: 1, fx: { yF: 5, mF: 5, big: -2 } },

  // ---- れいわ新選組 ----
  { id: 'reiwa_tax0', party: 'reiwa', cat: '物価高対策', icon: 'fa-ban', title: '消費税の廃止と一律10万円給付',
    summary: '消費税を廃止し、全国民に一律10万円を給付する。プライマリーバランス目標は破棄。',
    keywords: '10万円.*給付|一律10万|プライマリー', cost: 3, fx: { oM: 6, oF: 7, yM: 5, yF: 5, mF: 5, sme: 5, big: -8, us: -3 } },
  { id: 'reiwa_care', party: 'reiwa', cat: '社会保障', icon: 'fa-hand-holding-heart', title: '介護・保育従事者の給与を月10万円アップ',
    summary: '介護や保育で働く人の給与を月10万円引き上げる。',
    keywords: '月10万円.*(上げ|アップ)|介護.*保育', cost: 2, fx: { mF: 6, oF: 3, uni: 5 } },
  { id: 'reiwa_nuke', party: 'reiwa', cat: 'エネルギー', icon: 'fa-radiation', title: '原発の即時廃止',
    summary: '原発の使用を直ちにやめ、国が買い取って廃炉にする。',
    keywords: '原発.*(廃止|ゼロ|廃炉|禁止)|脱原発', cost: 2, fx: { mF: 6, yF: 4, big: -9, sme: -4, us: -2 } },
  { id: 'reiwa_green', party: 'reiwa', cat: '経済成長', icon: 'fa-leaf', title: 'グリーン産業に10年で200兆円',
    summary: 'グリーン産業に10年間で200兆円を投資し、年250万人の雇用をつくる。',
    keywords: 'グリーン|200兆', cost: 3, fx: { yM: 5, yF: 5, uni: 4, big: 2, oM: -3 } },

  // ---- 日本保守党 ----
  { id: 'hoshu_food', party: 'hoshu', cat: '物価高対策', icon: 'fa-wine-bottle', title: '食料品（酒類含む）の消費税を恒久0%',
    summary: '酒類を含む食料品の消費税を恒久的に0%にする。',
    keywords: '酒を含む食料品|酒類|酒.*消費税.*0%', cost: 2, fx: { oM: 6, oF: 5, mM: 4, sme: 3, big: -3 } },
  { id: 'hoshu_9jo', party: 'hoshu', cat: '憲法', icon: 'fa-book-open', title: '憲法9条2項の削除',
    summary: '憲法9条2項を削除し、自衛隊法を改正する。',
    keywords: '9条2項|2項.*削除', cost: 2, fx: { oM: 5, mM: 2, yF: -6, mF: -5, uni: -6, cn: -8, us: 2 } },
  { id: 'hoshu_imin', party: 'hoshu', cat: '外国人政策', icon: 'fa-hand', title: '移民政策の是正',
    summary: 'これまでの移民政策を見直し、是正する。',
    keywords: '移民.*(是正|反対|見直|抑制)', cost: 1, fx: { oM: 7, oF: 4, mM: 3, big: -7, sme: -4, as: -8 } },
  { id: 'hoshu_intel', party: 'hoshu', cat: '安全保障', icon: 'fa-satellite-dish', title: 'スパイ防止法と諜報機関の設置',
    summary: 'スパイ防止法を制定し、諜報機関を設置する。',
    keywords: '諜報|インテリジェンス', cost: 1, fx: { oM: 4, mM: 3, us: 5, cn: -8 } },

  // ---- 社会民主党 ----
  { id: 'sdp_tax0', party: 'sdp', cat: '物価高対策', icon: 'fa-ban', title: '消費税率をゼロに',
    summary: '消費税率をゼロに引き下げる。',
    keywords: '消費税率.*ゼロ|消費税.*0%', cost: 3, fx: { oM: 5, oF: 6, sme: 6, mF: 4, big: -7 } },
  { id: 'sdp_pension', party: 'sdp', cat: '社会保障', icon: 'fa-piggy-bank', title: '最低保障年金制度の創設',
    summary: '誰もが一定額を受け取れる最低保障年金制度をつくる。',
    keywords: '最低保障年金', cost: 2, fx: { oM: 7, oF: 8, yM: -2, yF: -1, big: -2 } },
  { id: 'sdp_edu', party: 'sdp', cat: '子育て・教育', icon: 'fa-school', title: '大学までの教育無償化',
    summary: '大学までの教育をすべて無償にする。',
    keywords: '大学.*無償|大学まで', cost: 2, fx: { yM: 6, yF: 6, mF: 5, oM: -3 } },
  { id: 'sdp_sofa', party: 'sdp', cat: '外交', icon: 'fa-flag-usa', title: '日米地位協定の抜本改正',
    summary: '日米地位協定を抜本的に改める。非核三原則を守る。',
    keywords: '地位協定|非核三原則', cost: 1, fx: { us: -10, oM: 2, mF: 2 } },
];
