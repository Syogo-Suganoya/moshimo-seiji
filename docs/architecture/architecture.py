"""もしも政治のアーキテクチャ図（技術スタックが分かる程度のシンプルなもの）

作り直すとき（リポジトリのルートで）：
    docker compose run --rm diagrams
docs/architecture/architecture.png が書き出される。
"""

from diagrams import Cluster, Diagram, Edge
from diagrams.gcp.ml import InferenceAPI
from diagrams.onprem.client import User
from diagrams.onprem.container import Docker
from diagrams.programming.flowchart import MultipleDocuments
from diagrams.programming.framework import NextJs
from diagrams.programming.language import NodeJS, TypeScript

FONT = "Noto Sans CJK JP"


def cluster(label: str, color: str) -> Cluster:
    return Cluster(
        label,
        graph_attr={"fontname": FONT, "fontsize": "15", "bgcolor": color, "pencolor": "#1f2244", "style": "rounded", "margin": "18"},
    )


with Diagram(
    "もしも政治 アーキテクチャ",
    filename="docs/architecture/architecture",
    outformat="png",
    show=False,
    direction="LR",
    graph_attr={"fontname": FONT, "fontsize": "22", "labelloc": "t", "pad": "0.5", "nodesep": "0.8", "ranksep": "1.2", "splines": "spline", "bgcolor": "white"},
    node_attr={"fontname": FONT, "fontsize": "13"},
    edge_attr={"fontname": FONT, "fontsize": "11", "color": "#1f2244"},
):
    web_user = User("プレイヤー\n（ブラウザ）")
    claude_user = User("プレイヤー\n（Claude）")

    with cluster("Web版", "#e8f4ff"):
        web = NextJs("Next.js 16\nReact 19・TypeScript")

    with cluster("Claude スキル版", "#eefaf4"):
        skill = NodeJS("SKILL.md\n＋ Node.js のコマンド")

    with cluster("共通", "#fff5e1"):
        engine = TypeScript("エンジン\nTypeScript")
        data = MultipleDocuments("公約データ\nJSON")

    gemini = InferenceAPI("Gemini API\ngemini-3.5-flash-lite")

    with cluster("開発環境", "#f3f0ff"):
        Docker("Docker Compose（Node 24）\nテスト：Vitest\nビルド：esbuild")

    web_user >> web >> Edge(label="自由な表明への反応") >> gemini
    claude_user >> skill
    web >> engine
    skill >> engine
    engine >> Edge(style="dashed") >> data
