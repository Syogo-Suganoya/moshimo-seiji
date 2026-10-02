"""X 投稿用のリアクション画像（2〜4枚目）の HTML を党ごとに作る。

    python3 docs/promo/build.py          → docs/promo/<党>.html
    ./docs/promo/shot.sh <党>            → docs/promo/images/<党名>/2.png 〜 4.png（1.png は画像生成の公約の文字）

属性と数値は、ゲームでその公約を表明したときの属性ごとの変化（data/policies.json の fx）。
1枚に2属性・1人ずつで、数値の大きい順に並べる（2枚目が一番喜ぶ側、4枚目が一番疑う側）。
fx が6つに満たないときは、変化なし（±0）の属性で補う。記者クラブなど、属性でない話者は入れない。
イラスト：いらすとや（https://www.irasutoya.com/）
"""

from html import escape
from pathlib import Path

IMG = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/"
# 属性ごとの名前と、いらすとやのイラスト
FAC = {
    "oF": ("高齢女性", IMG + "AVvXsEizq8z9NXOVhHLZvbyZDdhS89-6sLmnDgfktg6sb7fMJ-D6lYp1_YcsYIwonDgZDdBFeYvceh31c7pejqfwVWNQpgl007ZSqdVVOvbeJAqeLnXDVucqVHlyjdoTbq1gNkYbmbvxrEdMR5c/s400/obaasan.png"),
    "oM": ("高齢男性", IMG + "AVvXsEi6mquOnc-1QbT0kZNSkzNvJ03uUjwfxNz1qrKoSNoMveWK6ZiotTzdtVInaZizlaboVYwsZ2hXEovWmAJDipS68U5uEcujsW3pvbnIeIuB8XaKTaRxnM6IW0odN9cYbPl11dTmEsF4iWU/s400/ojiisan.png"),
    "mF": ("中年女性", IMG + "AVvXsEgKwLal-TM64ThHpc0A34Klf30tDQpWWwcjsC5cSjO5O22whmA0GP6oXnUT7kV47W_bMRrJRCAmcxPmgs2IUpbzUEXPdOKfEapEEQrGF6qNT_cxnRbOzsGKwsppJOKAWZIIZ6WJfGxv2GI/s400/hahako_girl.png"),
    "mM": ("中年男性", IMG + "AVvXsEjw8lmB2De4b3Z9a5ur2yAmOmvU0uA9WpTVDpgWNWHJmuZgh0Aha2hOjggSUGg8j5dU-qUilx0mUXFxYA4Be1EIccmysic6H91TsmfBc7cQgenfBEk33zaTZHVHWsaLeoH3Brq9HezEM3k/s400/job_businessman.png"),
    "yF": ("若年女性", IMG + "AVvXsEiLXmw0aPpqcn8xSfE_LJqXG_vgIlnL2Csk6Qknx3tDHK56GiXxC7OdSBcF0-IHYtLjdY0MiBOjKuWJvnC3_xwpH0CzV_Fdi9wcw3KdJku9ejGvpSOkUrnAVuhqp7hm3mOpfD-9SgHBk-Vw/s400/daigakusei_woman.png"),
    "yM": ("若年男性", IMG + "AVvXsEhpy4Fxva0fi5adGfcsTFDuEtqPpF6hRxpaukSs52ljpHl5TJt-oFpo_03FIaxNGTlYm7-bc5z2Y7DYRViI2gznr7iRLFNo8CcajM0Nf9kGgH5QTvSrsMrcGcc3ConDeQs4L4GoOlM6bhyphenhyphenp/s400/daigakusei_man.png"),
    "big": ("大企業", IMG + "AVvXsEjhmGlyd5fHDcjrCkLQsFIV0UXZwAxOS0q3b5qiipCUwtoVfOrKaCNTCVgd9a7MM-coMuNJXT75qeqMM8foskdDofL0qskRfPZ3Nl7ZktNeEKwEETuHe2a9MWfjTUDNRLMQgSZp4kPMl9w/s400/kaisya_desk1_syachou_man.png"),
    "sme": ("中小企業", IMG + "AVvXsEgmWjQV-plTzC325rya3U2ylDCnoqcXX9jg3gyeOcUnLrkTt4smxlNrcOhfRF2RvGmzwiUaXQhOSytVYloixa_JUVZ83f5CeAB3zgZoz9sus0YfsbgwME4CehRAP-ShModB0M4ASfblT6I/s400/job_yaoya.png"),
    "uni": ("労組", IMG + "AVvXsEglsC5K3wsdMrL_1nz-8U80fZpNAyB1NV8EknRL6H2Wi5Sy1iMpE0V4WeATyKUbunOU-Q4o-BWvCPJd99DpS9u1XvcXCRTufPILDfvtlhyVsD1Ne-Xg8fumsgb71x8cpdtfYDe59upknT1A/s400/company_roudou_kumiai.png"),
    "agr": ("農林水産", IMG + "AVvXsEjBDnTRnixdyhhDZ-_0Z3Or2F7mOMfGofTzLhwFyyuwW5PrXdyQz8x-5xP8xaeUIWUoMBdMTlahy6oOH_TQX5xGAX9kqwqD5GCvFaYzCI4Y8G7Im9Wr48aDmlzmRmTiJ2NhJWjwnOOQR4GO/s400/nouka_man_hatake.png"),
}

# 党 → 画像を置くディレクトリ名（docs/promo/images/<党名>/）
NAMES = {
    "ldp": "自由民主党", "chudo": "中道改革連合", "ishin": "日本維新の会", "dpfp": "国民民主党", "sansei": "参政党",
    "mirai": "チームみらい", "jcp": "日本共産党", "reiwa": "れいわ新選組", "hoshu": "日本保守党", "sdp": "社会民主党",
}

# 党 → [(属性, 支持率の変化, セリフ)]。セリフの「/」は改行。数値の大きい順
PARTIES = {
    "ldp": [  # 全国民に一人2万円を給付
        ("oF", 5, "2万円でもありがたいよ。/電気代の足しになる。"),
        ("oM", 4, "年金だけだと心細いからね。/助かるよ。"),
        ("mF", 4, "子どもの分が加算されるなら/助かります。"),
        ("yF", 2, "ちょっとした臨時収入！/ないよりは、うれしいかな。"),
        ("yM", -1, "一回きりの2万円より、/手取りを増やして/ほしいんだけど。"),
        ("big", -2, "一時の給付より、/賃上げにつながる施策を/望みます。"),
    ],
    "chudo": [  # 食料品の消費税を恒久ゼロに
        ("oF", 6, "食費は毎日のことだからね。/本当に助かるよ。"),
        ("oM", 5, "スーパーのレシートを見るのが/楽しみになったよ。"),
        ("mF", 5, "同じカゴなのに、/先月よりこんなに安い！"),
        ("yF", 2, "自炊する気に/なってきたかも！"),
        ("mM", 0, "財源はファンドの運用益か。/うまくいかない年は/どうするんだろう。"),
        ("big", -3, "税収の穴をどう埋めるのか、/説明がほしいですね。"),
    ],
    "ishin": [  # 現役世代の社会保険料を年6万円引き下げ
        ("yM", 5, "引かれる額が減ってる！/手取りが増えた！"),
        ("yF", 5, "年6万あったら、/ちょっとした旅行に行けるね。"),
        ("mM", 5, "現役世代の負担、/やっと見てくれたか。"),
        ("mF", 3, "家計にはうれしい。/習い事に回せるかな。"),
        ("oF", -6, "年寄りばかりが/削られるのは困るよ。"),
        ("oM", -6, "医療費を減らすって、/病院通いはどうなるのかね。"),
    ],
    "dpfp": [  # 消費税を5%に減税
        ("sme", 6, "インボイスの書類から/やっと解放される！"),
        ("oF", 5, "毎日の買い物が/少し軽くなるねえ。"),
        ("oM", 4, "物価高でも、/これなら一息つけるよ。"),
        ("mF", 4, "まとめ買いの日が/ちょっと楽しみです。"),
        ("yM", 0, "減税はいいけど、/そのツケは僕らの世代に/来ない？"),
        ("big", -4, "社会保障の財源は/どう確保するのでしょうか。"),
    ],
    "sansei": [  # 0〜15歳の子どもに月10万円の教育給付金
        ("mF", 9, "月10万円……習い事も、/行かせてあげられる。"),
        ("mM", 5, "二人目も、/考えられるかもしれない。"),
        ("yF", 5, "これなら、子どもを/持つことも考えられるかも。"),
        ("big", -3, "財源の規模が大きすぎます。/増税にならないか心配です。"),
        ("oF", -3, "若い人が楽になるのはいいけど、/こっちは年金だけでねえ。"),
        ("oM", -5, "わしらの暮らしは/後回しかね。"),
    ],
    "mirai": [  # 消費税は維持、代わりに子育て減税（mirai_keep と mirai_childTax の合計）
        ("mF", 6, "子どもの数で/所得税が下がるなんて！"),
        ("mM", 5, "子ども三人のうちには/大きいな。"),
        ("big", 4, "税率を維持するのは、/責任ある判断です。"),
        ("yF", 3, "将来、子どもを持つなら/心強いかも。"),
        ("sme", -3, "消費税が下がらないと、/お客さんの財布は固いまま。"),
        ("oM", -4, "下げないのかい。/年寄りには毎日の買い物が/こたえるんだがなあ。"),
    ],
    "jcp": [  # 最低賃金を全国一律1500〜1700円に
        ("uni", 8, "全国一律、/これこそ我々の要求だ！"),
        ("yF", 6, "地元に残っても、/やっていけるかも。"),
        ("yM", 5, "都会に出なくても、/時給が上がるんだ！"),
        ("agr", -2, "人を雇うのが/ますます難しくなるな。"),
        ("big", -3, "急な引き上げは、/雇用を減らしかねません。"),
        ("sme", -10, "人件費がこれだけ上がると、/店が続けられないよ……"),
    ],
    "reiwa": [  # 消費税の廃止と一律10万円給付
        ("oF", 7, "10万円！/みんなで温泉に行こうか。"),
        ("oM", 6, "消費税がなくなるなんて、/長生きはするもんだ。"),
        ("yM", 5, "10万円と消費税ゼロ、/生活がかなり楽になる！"),
        ("mF", 5, "毎日の買い物で/違いがはっきりわかる。"),
        ("mM", 0, "国の借金、大丈夫なのかな。/円の値打ちも心配だ。"),
        ("big", -8, "消費税の廃止は、/財政の根幹に関わります。"),
    ],
    "hoshu": [  # 食料品（酒類含む）の消費税を恒久0%
        ("oM", 6, "晩酌のビールまで/安くなるとはありがたい。"),
        ("oF", 5, "食べるものは毎日だから、/うれしいねえ。"),
        ("mM", 4, "仕事帰りの一杯が、/ささやかな幸せだなあ。"),
        ("sme", 3, "うちの店も、/お客さんが増えそうだ。"),
        ("yF", 0, "お酒まで0%って、必要？/ほかに使い道ありそう。"),
        ("big", -3, "税収の減少分を/どう補うのかが課題です。"),
    ],
    "sdp": [  # 最低保障年金制度の創設
        ("oF", 8, "誰でも最低限はもらえる。/それなら少し安心だねえ。"),
        ("oM", 7, "年金だけでは暮らせないと/思っていたけど、心強い。"),
        ("mF", 0, "親の老後は少し安心。/でも財源はどうするの？"),
        ("yF", -1, "支える側の負担、/増えるのかな。"),
        ("yM", -2, "僕らがもらう頃まで、/制度はもつのかな。"),
        ("big", -2, "保険料の負担が増えれば、/企業の体力が削られます。"),
    ],
}

CSS = """
:root{--navy:#1f2244; --cream:#fff5e1; --coral:#ff6b57; --mint:#35cfa1; --mute:#8c8aa6}
*{box-sizing:border-box}
html,body{margin:0;background:var(--navy)}
body{font-family:"M PLUS Rounded 1c",sans-serif;font-weight:800;color:var(--navy)}
/* 1コマ = 1280×720（16:9）。#k2 などを付けると、そのコマだけを出す */
.koma{position:relative;width:1280px;height:720px;padding:22px;background:var(--navy)}
body:has(.koma:target) .koma:not(:target){display:none}
.koma > .in{position:relative;height:100%;display:grid;grid-template-columns:1fr 1fr;border:6px solid var(--navy);outline:5px solid var(--cream);border-radius:26px;overflow:hidden}
.p{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:0 24px 22px}
.p + .p{border-left:5px dashed #1f224433}
.p.up{background:radial-gradient(circle at 50% 115%,#ffffffd9,transparent 60%),#ffe7a6}
.p.dn{background:radial-gradient(circle at 50% 115%,#ffffffd9,transparent 60%),#cfe6ff}
.p.zero{background:radial-gradient(circle at 50% 115%,#ffffffd9,transparent 60%),#ece6da}
.p img{display:block;height:290px;width:auto;object-fit:contain}
/* 吹き出し */
.bub{position:relative;margin-bottom:30px;padding:20px 30px;white-space:nowrap;background:#fff;border:5px solid var(--navy);border-radius:30px;box-shadow:0 7px 0 var(--navy);font-size:36px;line-height:1.45}
.bub::after{content:"";position:absolute;left:50%;bottom:-31px;width:36px;height:36px;background:#fff;border-right:5px solid var(--navy);border-bottom:5px solid var(--navy);transform:translateX(-50%) rotate(45deg) skew(12deg,12deg);border-bottom-right-radius:6px}
/* 属性名と、ゲームでの支持率の変化 */
.tag{display:flex;align-items:center;gap:12px;margin-top:10px;padding:5px 8px 5px 22px;border:5px solid var(--navy);border-radius:999px;background:#fff;font-size:30px}
.tag b{font-family:"Rubik",sans-serif;font-size:28px;padding:0 14px;border-radius:999px;color:#fff;line-height:42px}
.up .tag b{background:var(--mint)}.dn .tag b{background:var(--coral)}.zero .tag b{background:var(--mute)}
"""


def person(fac: str, d: int, line: str) -> str:
    name, img = FAC[fac]
    cls = "up" if d > 0 else "dn" if d < 0 else "zero"
    num = f"+{d}" if d > 0 else "±0" if d == 0 else str(d)
    bub = "<br>".join(escape(x) for x in line.split("/"))
    return (f'    <div class="p {cls}">\n'
            f'      <div class="bub">{bub}</div>\n'
            f'      <img src="{img}" alt="{name}">\n'
            f'      <span class="tag">{name}<b>{num}</b></span>\n'
            f'    </div>\n')


def page(party: str, rows: list) -> str:
    assert len(rows) == 6, party
    komas = ""
    for i in range(3):
        a, b = rows[i * 2], rows[i * 2 + 1]
        komas += f'<section class="koma" id="k{i + 2}">\n  <div class="in">\n{person(*a)}{person(*b)}  </div>\n</section>\n\n'
    return f"""<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1280">
<title>もしも政治 プロモ {party}</title>
<!-- docs/promo/build.py で作る。手で直さない。イラスト：いらすとや（https://www.irasutoya.com/） -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@800&family=Rubik:wght@800&display=swap">
<style>{CSS}</style>
</head>
<body>

{komas}</body>
</html>
"""


if __name__ == "__main__":
    here = Path(__file__).parent
    if len(__import__("sys").argv) > 1:  # shot.sh から党名を引く
        print(NAMES[__import__("sys").argv[1]])
        raise SystemExit
    for party, rows in PARTIES.items():
        (here / f"{party}.html").write_text(page(party, rows), encoding="utf-8")
        (here / "images" / NAMES[party]).mkdir(parents=True, exist_ok=True)
        print(here / f"{party}.html")
