"""Build the three NAN 2026 submission PDFs in docs/submission.

Run on Windows with the bundled Codex Python runtime or any Python with
reportlab + Pillow + pypdf. The generated PDFs embed Malgun Gothic.
"""

from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "submission"
BACKDROP = ROOT / "public" / "assets" / "generated" / "ui" / "gyeonghwasuwol-logo-backdrop.png"

PAGE_W, PAGE_H = A4
INK = colors.HexColor("#17130f")
PAPER = colors.HexColor("#f7f1e5")
CREAM = colors.HexColor("#fff9ee")
RED = colors.HexColor("#b9372f")
GOLD = colors.HexColor("#b98527")
NAVY = colors.HexColor("#27445a")
GREEN = colors.HexColor("#315f50")
MUTED = colors.HexColor("#6f675d")
RULE = colors.HexColor("#d8c9ae")


# ReportLab cannot read the repository's WOFF2 files directly. The PDFs embed
# Windows' Korean UI font so recipients do not need the font installed.
pdfmetrics.registerFont(TTFont("Galmuri", r"C:\Windows\Fonts\malgun.ttf"))
pdfmetrics.registerFont(TTFont("GalmuriBold", r"C:\Windows\Fonts\malgunbd.ttf"))

styles = getSampleStyleSheet()
BODY = ParagraphStyle(
    "BodyKo",
    parent=styles["BodyText"],
    fontName="Galmuri",
    fontSize=9.1,
    leading=14.2,
    textColor=INK,
    wordWrap="CJK",
    spaceAfter=5,
)
SMALL = ParagraphStyle(
    "SmallKo",
    parent=BODY,
    fontSize=7.6,
    leading=11.2,
    textColor=MUTED,
)
H1 = ParagraphStyle(
    "H1Ko",
    parent=BODY,
    fontName="GalmuriBold",
    fontSize=19,
    leading=24,
    textColor=INK,
    spaceAfter=9,
)
H2 = ParagraphStyle(
    "H2Ko",
    parent=BODY,
    fontName="GalmuriBold",
    fontSize=12,
    leading=17,
    textColor=NAVY,
    spaceBefore=6,
    spaceAfter=5,
)
LEAD = ParagraphStyle(
    "LeadKo",
    parent=BODY,
    fontName="GalmuriBold",
    fontSize=11,
    leading=17,
    textColor=GREEN,
    spaceAfter=9,
)
CALLOUT = ParagraphStyle(
    "CalloutKo",
    parent=BODY,
    fontName="GalmuriBold",
    fontSize=10,
    leading=15,
    textColor=CREAM,
    backColor=NAVY,
    borderPadding=9,
    spaceBefore=4,
    spaceAfter=8,
)
CODE = ParagraphStyle(
    "CodeKo",
    parent=BODY,
    fontName="Galmuri",
    fontSize=8.3,
    leading=13,
    textColor=CREAM,
    backColor=INK,
    borderPadding=9,
    leftIndent=0,
    spaceAfter=8,
)


def p(text: str, style=BODY) -> Paragraph:
    return Paragraph(text, style)


def bullet(text: str) -> Paragraph:
    style = ParagraphStyle(
        "BulletKo", parent=BODY, leftIndent=11, firstLineIndent=-8, bulletIndent=0, spaceAfter=3
    )
    return Paragraph(f"<font color='#b9372f'>●</font> {text}", style)


def section(number: str, title: str) -> list:
    return [p(f"<font color='#b9372f'>{number}</font>", SMALL), p(title, H1)]


def table(rows, widths=None, header=True, font_size=7.6, aligns=None):
    cooked = []
    for r, row in enumerate(rows):
        cooked.append(
            [
                p(
                    str(value),
                    ParagraphStyle(
                        f"cell-{r}-{c}",
                        parent=SMALL,
                        fontName="GalmuriBold" if header and r == 0 else "Galmuri",
                        fontSize=font_size,
                        leading=font_size + 3.5,
                        textColor=CREAM if header and r == 0 else INK,
                        alignment=(aligns[c] if aligns else TA_LEFT),
                    ),
                )
                for c, value in enumerate(row)
            ]
        )
    t = Table(cooked, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    commands = [
        ("BACKGROUND", (0, 0), (-1, 0), INK if header else PAPER),
        ("BACKGROUND", (0, 1 if header else 0), (-1, -1), colors.white),
        ("ROWBACKGROUNDS", (0, 1 if header else 0), (-1, -1), [colors.white, PAPER]),
        ("GRID", (0, 0), (-1, -1), 0.45, RULE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]
    t.setStyle(TableStyle(commands))
    return t


class SubmissionDoc(BaseDocTemplate):
    def __init__(self, filename: Path, short_title: str, total_pages: int):
        self.short_title = short_title
        self.total_pages = total_pages
        super().__init__(
            str(filename),
            pagesize=A4,
            leftMargin=18 * mm,
            rightMargin=18 * mm,
            topMargin=22 * mm,
            bottomMargin=18 * mm,
            title=short_title,
            author="NAN 2026 경화수월 팀",
            subject="NAN 2026 submission document",
        )
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="normal")
        self.addPageTemplates(PageTemplate(id="all", frames=[frame], onPage=self._page))

    def _page(self, canvas, doc):
        if doc.page == 1:
            self._cover(canvas)
            return
        canvas.saveState()
        canvas.setFillColor(PAPER)
        canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        canvas.setStrokeColor(RULE)
        canvas.setLineWidth(0.6)
        canvas.line(18 * mm, PAGE_H - 15 * mm, PAGE_W - 18 * mm, PAGE_H - 15 * mm)
        canvas.setFillColor(MUTED)
        canvas.setFont("Galmuri", 7.2)
        canvas.drawString(18 * mm, PAGE_H - 11.5 * mm, "NAN 2026 · 경화수월")
        canvas.drawRightString(PAGE_W - 18 * mm, PAGE_H - 11.5 * mm, self.short_title)
        canvas.drawString(18 * mm, 9 * mm, f"NAN 2026 · {self.short_title}")
        canvas.drawRightString(PAGE_W - 18 * mm, 9 * mm, f"{doc.page} / {self.total_pages}")
        canvas.restoreState()

    def _cover(self, canvas):
        canvas.saveState()
        canvas.setFillColor(colors.HexColor("#0b0a08"))
        canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        canvas.drawImage(str(BACKDROP), 0, 0, width=PAGE_W, height=PAGE_H, preserveAspectRatio=False, mask="auto")
        canvas.setFillColor(colors.Color(0, 0, 0, alpha=0.68))
        canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        canvas.setFillColor(colors.Color(0, 0, 0, alpha=0.46))
        canvas.roundRect(42 * mm, 48 * mm, PAGE_W - 84 * mm, PAGE_H - 88 * mm, 5 * mm, fill=1, stroke=0)
        canvas.restoreState()


def cover_story(doc_title: str, subtitle: str, meta: list[tuple[str, str]]):
    title = ParagraphStyle(
        "CoverTitle",
        parent=BODY,
        fontName="GalmuriBold",
        fontSize=31,
        leading=38,
        textColor=CREAM,
        alignment=TA_CENTER,
    )
    sub = ParagraphStyle(
        "CoverSub",
        parent=BODY,
        fontName="GalmuriBold",
        fontSize=15,
        leading=21,
        textColor=colors.HexColor("#e3bd67"),
        alignment=TA_CENTER,
    )
    tagline = ParagraphStyle(
        "CoverTag",
        parent=BODY,
        fontSize=9.5,
        leading=15,
        textColor=CREAM,
        alignment=TA_CENTER,
    )
    items = [Spacer(1, 30 * mm), p("N A N  2 0 2 6  ·  N H N  G A M E  ×  A I", tagline)]
    items += [Spacer(1, 17 * mm), p("경화수월", title), p("鏡 花 水 月", sub)]
    items += [Spacer(1, 8 * mm), p(doc_title, sub), Spacer(1, 5 * mm), p(subtitle, tagline)]
    items += [Spacer(1, 62 * mm)]
    meta_key = ParagraphStyle(
        "CoverMetaKey", parent=SMALL, fontName="GalmuriBold", fontSize=8.2, leading=11.7, textColor=colors.HexColor("#e3bd67")
    )
    meta_value = ParagraphStyle(
        "CoverMetaValue", parent=SMALL, fontName="Galmuri", fontSize=8.2, leading=11.7, textColor=CREAM
    )
    meta_rows = [[p(k, meta_key), p(v, meta_value)] for k, v in meta]
    meta_table = Table(meta_rows, colWidths=[34 * mm, 98 * mm], hAlign="LEFT")
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.Color(0.02, 0.02, 0.02, alpha=0.78)),
                ("TEXTCOLOR", (0, 0), (-1, -1), CREAM),
                ("BOX", (0, 0), (-1, -1), 0.8, GOLD),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#66502e")),
            ]
        )
    )
    items += [meta_table, PageBreak()]
    return items


def build_game_overview():
    path = OUT / "03_게임소개및설명문서.pdf"
    doc = SubmissionDoc(path, "게임 소개 및 설명 문서", 6)
    s = cover_story(
        "게임 소개 및 설명 문서",
        "화투 48장으로 짓고땡을 만들고, 고와 스톱 사이에서 위험을 거는 싱글 플레이 로그라이크 덱빌더",
        [("장르", "로그라이크 덱빌더"), ("플랫폼", "웹 브라우저"), ("인원", "싱글 플레이"), ("최종 검증", "29개 파일 · 214개 테스트 통과")],
    )
    s += section("01", "게임 개요")
    s += [p("전통 화투의 익숙함을 현대 로그라이크의 선택 구조로 다시 엮었다.", LEAD)]
    s += [
        table(
            [
                ["항목", "내용"],
                ["핵심 목표", "1월부터 12월까지 각 판의 목표 점수를 제출 4회 안에 넘기고, 두목을 돌파한다."],
                ["핵심 선택", "목표를 넘긴 순간 스톱으로 판돈을 확정하거나, 고를 선언해 더 높은 문턱과 보상에 도전한다."],
                ["플레이 시간", "열두 달 완주 기준 약 25~40분"],
                ["진행 저장", "브라우저 localStorage 자동 저장. 같은 시드로 카드 순서와 장터를 재현"],
                ["실행 조건", "설치·계정·결제·API 키·백엔드 없음"],
            ],
            [34 * mm, 136 * mm],
        ),
        Spacer(1, 5 * mm),
        p("왜 짓고땡인가", H2),
        p("포커 족보를 화투 그림으로 바꾼 게임이 아니다. 실제 화투 놀이인 짓고땡에서 제출 규칙을 가져왔다. 먼저 고른 두 장은 끗패가 되어 배수를 만들고, 나머지는 짓이 되어 월 합을 만든다. 같은 카드라도 고르는 순서가 달라지면 점수가 달라진다."),
        p("원래 5장 고정 규칙을 2~5장 자유 제출로 일반화했다. 두 장 제출은 항상 열어 두어 처음 접한 사람도 막히지 않으며, 숙련자는 장수를 늘려 더 큰 월 합과 조합을 노린다."),
        p("현재 규모", H2),
        table(
            [
                ["화투", "끗패", "수집 족보", "부적", "비결서", "덱 개조", "두목"],
                ["48장", "14종", "8종", "58종", "22종", "25종", "12종"],
            ],
            [22 * mm, 22 * mm, 25 * mm, 22 * mm, 22 * mm, 25 * mm, 22 * mm],
            font_size=7.2,
            aligns=[TA_CENTER] * 7,
        ),
        Spacer(1, 4 * mm),
        p("최신 빌드는 《경화수월》 브랜드, 전통 문양 테이블, 계절 두목 등장 연출, 카드 제출 극장, 금단패 전용 연출, 재즈 테이블 BGM과 상황별 효과음을 포함한다.", CALLOUT),
        PageBreak(),
    ]

    s += section("02", "플레이 방법")
    s += [p("손패 8장 · 제출 4회 · 버리기 3회로 한 판을 시작한다.", LEAD)]
    s += [
        table(
            [
                ["순서", "플레이어 행동", "게임이 처리하는 것"],
                ["1. 선택", "손패에서 2~5장을 클릭한다. 먼저 고른 두 장이 끗패, 나머지가 짓이 된다.", "카드가 들어 올려지고 역할 표식과 예상 점수가 표시된다."],
                ["2. 제출", "성립한 조합을 제출한다.", "월 합과 족보 배수를 순서대로 계산해 라운드 점수에 누적한다."],
                ["3. 수집", "사용한 카드는 수집판에 남는다.", "광·열끗·띠·피와 고도리·단 점수를 별도로 더한다."],
                ["4. 판단", "목표를 넘기면 고 또는 스톱을 고른다.", "스톱은 판돈 확정, 고는 새 문턱과 보상 배율을 올린다."],
                ["5. 장터", "판 승리 후 부적·비결서·덱 개조를 산다.", "다음 달 날씨와 두목에 맞게 덱을 성장시킨다."],
            ],
            [17 * mm, 76 * mm, 77 * mm],
            font_size=7.25,
        ),
        Spacer(1, 5 * mm),
        p("막혔을 때", H2),
        bullet("두 장 제출은 언제나 성립한다. 낮은 점수라도 다음 손으로 진행할 수 있다."),
        bullet("안 풀리는 카드는 선택 후 버린다. 버리기는 제출 횟수를 소모하지 않는다."),
        bullet("카드 호버 패널에서 월·종류·각인·판본·효과를 확인한다."),
        bullet("첫 실행의 22단계 스포트라이트 튜토리얼이 제출, 점수, 수집판, 고·스톱, 장터를 실제 UI 위에서 안내한다."),
        Spacer(1, 4 * mm),
        p("승리와 패배", H2),
        table(
            [
                ["결과", "조건"],
                ["판 승리", "목표 또는 고 문턱을 넘긴 뒤 스톱"],
                ["런 완주", "1~12월의 열두 판과 3·6·9·12월 계절 두목 돌파"],
                ["제출 소진", "제출 4회를 모두 쓰고도 문턱 미달"],
                ["고박", "고 선언 뒤 남은 제출로 새 문턱을 넘기지 못함"],
            ],
            [35 * mm, 135 * mm],
        ),
        PageBreak(),
    ]

    s += section("03", "점수와 고·스톱")
    s += [p("점수 = floor(월 합 × 배수)", CALLOUT)]
    s += [
        table(
            [
                ["구성", "역할", "핵심 규칙"],
                ["짓", "월 합", "끗패 두 장을 제외한 카드의 월 합이 10·20·30이면 성립. 두 장 제출은 월 합 1에서 시작"],
                ["끗패", "배수", "먼저 고른 두 장으로 광땡 → 땡 → 특수패 → 갑오 → 끗 → 망통 순서 판정"],
                ["수집판", "가산점", "한 판 동안 모은 고스톱 점수 × 20을 제출 점수 합계에 별도 가산"],
            ],
            [27 * mm, 25 * mm, 118 * mm],
        ),
        Spacer(1, 5 * mm),
        p("끗패의 예", H2),
        table(
            [
                ["족보", "조건", "기본 배수"],
                ["망통 / 끗 / 갑오", "월 합 끝자리 0 / 1~8 / 9", "×1 / ×1~3.4 / ×4"],
                ["세륙·장사·장삥·구삥·독사·알리", "이름 붙은 두 장 조합", "×4.5~7"],
                ["땡 / 장땡", "같은 월 두 장 / 10월 두 장", "×8 이상 / ×14"],
                ["13·18·38 광땡", "광 카드의 비밀 조합", "×16 / ×18 / ×20"],
            ],
            [34 * mm, 90 * mm, 46 * mm],
        ),
        Spacer(1, 5 * mm),
        p("고는 공짜 재시도가 아니다", H2),
        p("고를 선언하면 새 문턱은 목표 배율과 현재 점수의 1.5배를 함께 고려해 고정된다. 이미 크게 넘긴 판에서도 추가 성장이 필요하다. 고는 한 판 최대 3회이며, 성공 후 판돈 배율은 최대 ×4.2까지 오른다."),
        table(
            [["선택", "문턱 배율", "판돈 배율"], ["스톱", "×1.0", "×1.0"], ["1고", "×1.8", "×1.7"], ["2고", "×2.8", "×2.7"], ["3고", "×4.2", "×4.2"]],
            [56 * mm, 56 * mm, 58 * mm],
            aligns=[TA_CENTER] * 3,
        ),
        PageBreak(),
    ]

    s += section("04", "런 성장과 최신 연출")
    s += [p("모든 런은 같은 화투 덱으로 시작하지만 장터에서 서로 다른 엔진이 된다.", LEAD)]
    s += [
        table(
            [
                ["장터", "수량", "역할"],
                ["부적", "58종", "최대 5칸의 상시 효과. 왼쪽부터 발동해 배치 순서도 전략"],
                ["비결서", "22종", "특정 끗패·수집 족보를 영구 단련"],
                ["화공패", "15종", "카드에 각인·판본·낙관을 새겨 월 합과 배수를 성장"],
                ["금단패", "10종", "소각·복제 등 대가를 치르는 강한 덱 개조"],
                ["카드 묶음·계절 계약", "2종·8쌍", "후보 선택과 이득/대가 선택으로 런 방향 전환"],
            ],
            [38 * mm, 25 * mm, 107 * mm],
        ),
        Spacer(1, 5 * mm),
        p("계절 두목", H2),
        table(
            [
                ["달", "두목", "대표 규칙"],
                ["3월", "고집쟁이", "성공한 고를 최소 1회 포함해야 스톱 가능"],
                ["6월", "장마", "비 태그가 아닌 광 카드의 월값을 약화"],
                ["9월", "역달력", "덱의 월 순서를 뒤틀어 손패 계획을 교란"],
                ["12월", "나가리 왕", "고 없이 스톱하면 확정 점수가 감소"],
            ],
            [20 * mm, 38 * mm, 112 * mm],
        ),
        Spacer(1, 5 * mm),
        p("최종 빌드 반영 사항", H2),
        bullet("게임명과 메타데이터를 《경화수월》로 통일하고 전용 배경·전통 문양·오방색 계열 UI를 적용"),
        bullet("카드 제출을 중앙 극장 연출로 재구성하고 땡·광땡·상위 족보의 빛·진동·북소리를 단계화"),
        bullet("금단패, 카드 효과, 계절 두목 등장에 전용 전체 화면 연출과 대형 초상 적용"),
        bullet("타이틀·장터·일반 판·보스 판을 구분하는 BGM과 화투 타격·칩·구매 효과음 적용"),
        bullet("GitHub Pages 자동 배포 워크플로와 정적 빌드 검증 추가"),
        PageBreak(),
    ]

    s += section("05", "실행 방법")
    s += [p("권장: 웹 링크를 열면 설치 없이 바로 플레이할 수 있다.", LEAD)]
    s += [
        table(
            [
                ["항목", "주소 / 명령"],
                ["플레이", "https://lshane1028.github.io/nhh-2026-hackathon/"],
                ["소스", "https://github.com/lshane1028/nhh-2026-hackathon"],
            ],
            [35 * mm, 135 * mm],
        ),
        Spacer(1, 6 * mm),
        p("소스 코드로 실행", H2),
        p("$ git clone https://github.com/lshane1028/nhh-2026-hackathon.git<br/>$ cd nhh-2026-hackathon<br/>$ npm install<br/>$ npm run dev&nbsp;&nbsp;&nbsp;# http://localhost:3000", CODE),
        table(
            [
                ["요구 사항", "내용"],
                ["Node.js", "22.13.0 이상"],
                ["패키지", "npm · package-lock.json 포함"],
                ["추가 준비물", "없음. 환경 변수·API 키·데이터베이스·계정 불필요"],
                ["프로덕션 빌드", "npm run build"],
                ["전체 검증", "npm run verify"],
            ],
            [40 * mm, 130 * mm],
        ),
        Spacer(1, 6 * mm),
        p("조작 환경", H2),
        bullet("Chrome·Edge·Safari 최신 버전, 화면 너비 1280px 이상 권장"),
        bullet("마우스 클릭과 호버만 사용. 드래그·키보드 단축키 없음"),
        bullet("모바일에서도 실행 가능하나 한 화면 테이블 구조 때문에 가로 화면 권장"),
        Spacer(1, 4 * mm),
        p("검증 기준일 2026-08-10: Vitest 29개 파일의 214개 테스트가 모두 통과했다. 오디오 자산, 브랜드, 보스 연출, 카드 연출, 상태 전이, 점수 엔진, 저장 복원까지 포함한다.", CALLOUT),
    ]
    doc.build(s)


def build_ai_report():
    path = OUT / "04_AI활용기술문서.pdf"
    doc = SubmissionDoc(path, "AI 활용 기술 문서", 6)
    s = cover_story(
        "AI 활용 기술 문서",
        "기획·규칙·구현·아트·테스트·문서화 전 과정의 AI 도구, 프롬프트, 후처리와 검증 기록",
        [("개발 도구", "OpenAI Codex · Anthropic Claude"), ("이미지", "OpenAI 이미지 생성"), ("런타임 AI", "사용하지 않음"), ("자동 검증", "29개 파일 · 214개 테스트 통과")],
    )
    s += section("01", "활용 개요")
    s += [p("AI는 제작 도구이며 게임의 실행 부품은 아니다.", LEAD)]
    s += [
        table(
            [
                ["단계", "AI 활용", "사람의 결정과 검토"],
                ["기획·규칙", "모순 탐색, 짓고땡 규칙 후보, 목표 곡선 분석", "화투 테마, 2~5장 자유 제출, 고·스톱 위험 구조 확정"],
                ["구현", "순수 함수 엔진, 상태 전이, 콘텐츠 카탈로그, UI 모듈 작성", "모듈 경계, 점수 연산 순서, 화면 조작 원칙 확정"],
                ["아트", "화투·부적·비결서·두목·장식 이미지 생성", "원본 모티프 유지 여부와 최종 채택, 수동 배치·크롭 검수"],
                ["사운드·연출", "장면별 BGM 연결, 카드·보스·금단 연출 코드 보완", "분위기, 타이밍, 과도한 화면 흔들림 방지 기준 확정"],
                ["테스트", "경계값, 상태 전이, 자산 존재, 표현 불변식 테스트 작성", "무엇을 회귀 방지 불변식으로 잠글지 결정"],
                ["문서", "프롬프트·활용 로그·제출 PDF 구조화", "사실 관계, 역할, 라이선스와 최종 문구 검수"],
            ],
            [25 * mm, 71 * mm, 74 * mm],
            font_size=7.1,
        ),
        Spacer(1, 5 * mm),
        p("런타임 AI를 사용하지 않은 이유", H2),
        bullet("재현성: 문자열 시드와 RNG 커서만으로 같은 카드 순서와 장터를 재현한다."),
        bullet("심사 접근성: 계정·API 키·과금·네트워크 의존 없이 링크만으로 실행한다."),
        bullet("검증 가능성: 규칙 엔진을 결정론적 순수 함수로 두어 자동 테스트로 결과를 고정한다."),
        p("AI 산출물은 테스트·타입 검사·린트·빌드 검증과 사람의 플레이 검수를 통과한 뒤에만 저장소에 반영했다.", CALLOUT),
        PageBreak(),
    ]

    s += section("02", "도구와 프롬프트")
    s += [
        table(
            [
                ["도구", "담당 영역", "대표 활용"],
                ["OpenAI Codex", "구현·리팩터링·테스트·최종 통합", "기획서를 engine/content/state/UI로 분해, 카드 효과·연출·저장·툴팁·브랜드 정리, 회귀 테스트 작성"],
                ["Anthropic Claude (Cowork)", "규칙 재설계·밸런스·문서", "포커식 규칙을 짓고땡으로 전환, 완전 탐색 프로브 기반 목표 곡선 조정, 튜토리얼과 문서 재작성"],
                ["OpenAI 이미지 생성", "시각 자산", "화투 아틀라스, 부적, 비결서, 화공패, 금단패, 두목, 계절 인물, 시작 덱, UI 배경"],
            ],
            [43 * mm, 43 * mm, 84 * mm],
        ),
        Spacer(1, 5 * mm),
        p("대표 프롬프트 1 - 구현 구조", H2),
        p("기획서의 시스템을 구현하되 규칙 엔진·콘텐츠·런 상태·UI를 분리하고, 화투 48장과 점수식·수집 족보·고·스톱을 실제 플레이 가능하게 만들며, 자산마다 교체 가능한 식별자를 제공하라.", CODE),
        p("대표 프롬프트 2 - 짓고땡 전환", H2),
        p("제출 패를 짓과 끗패로 나누고 2~5장 자유 제출로 일반화한다. 판정 우선순위는 광땡 → 땡 → 이름 붙은 특수패 → 갑오 → 끗 → 망통으로 고정하며, 의미를 잃은 상태·액션·콘텐츠는 제거하고 검증 테스트를 함께 작성한다.", CODE),
        p("대표 프롬프트 3 - 최종 규칙·자산 정리", H2),
        p("현재 코드와 화면을 함께 감사해 내부 식별자 노출, 이름과 그림의 불일치, 오래된 규칙 문구, 카드 제출 연출, 보스 등장 정보, 툴팁 겹침을 고치고 각 변경을 테스트로 잠근다. 자산은 현재 규칙의 이름·기능과 바로 연결되어야 한다.", CODE),
        PageBreak(),
    ]

    s += section("03", "사람-AI 협업 절차")
    s += [p("사람이 결정 → AI가 생성 → 자동 검증 → 사람이 채택", CALLOUT)]
    s += [
        table(
            [
                ["단계", "실제 절차", "반려 조건"],
                ["1. 제약 정의", "바꿀 것·지킬 것·삭제할 것·합격 기준을 프롬프트 앞부분에 명시", "요구가 판정 가능하지 않거나 기존 규칙과 충돌"],
                ["2. 생성", "코드와 테스트, 이미지와 후처리 절차를 함께 생성", "코드만 있고 검증이 없거나 자산의 역할이 불명확"],
                ["3. 자동 검증", "Vitest → TypeScript → ESLint → 프로덕션 빌드", "하나라도 실패"],
                ["4. 화면 검수", "실제 한 화면에서 카드·툴팁·연출·보스·장터를 플레이", "겹침, 내부 이름 노출, 잘못된 모티프, 과도한 연출"],
                ["5. 기록", "프롬프트 원문·활용 로그·자산 장부·커밋으로 추적", "출처·도구·사람의 결정이 기록되지 않음"],
            ],
            [25 * mm, 87 * mm, 58 * mm],
            font_size=7.25,
        ),
        Spacer(1, 6 * mm),
        p("프롬프트 설계 원칙", H2),
        bullet("제약을 먼저 쓴다. 모듈 경계, 판정 순서, 화면 크기처럼 바뀌면 안 되는 것을 선명하게 고정한다."),
        bullet("합격 기준을 관찰 가능하게 쓴다. '예쁘게' 대신 '48장이 정확한 순서와 2:3 비율이며 숙련자가 즉시 식별'처럼 적는다."),
        bullet("지울 것을 명시한다. 규칙 교체 뒤 죽은 코드가 남으면 다음 AI 작업이 오래된 구조를 근거로 오추론한다."),
        bullet("테스트도 산출물로 요구한다. 특히 화면과 채점기, 선언 수량과 실제 콘텐츠, 저장 전후 상태 같은 두 지점의 동일 규칙을 잠근다."),
        Spacer(1, 4 * mm),
        p("기록 위치", H2),
        table(
            [["기록", "경로"], ["프롬프트 원문", "docs/PROMPTS/"], ["날짜별 활용 로그", "docs/AI_USAGE_LOG.md"], ["자산 장부", "docs/ASSET_LICENSES.md · assets/manifest.json"], ["오픈소스 고지", "docs/THIRD_PARTY_NOTICES.md · public/assets/audio/THIRD_PARTY_NOTICES.md"]],
            [48 * mm, 122 * mm],
        ),
        PageBreak(),
    ]

    s += section("04", "이미지 후처리와 권리")
    s += [p("생성 결과를 그대로 사용하지 않고 결정론적 후처리와 사람 검수를 거쳤다.", LEAD)]
    s += [
        table(
            [
                ["단계", "화투 아틀라스 처리"],
                ["경계 검출", "생성된 48개 카드 영역의 실제 경계를 자동 검출"],
                ["정렬 보정", "최근접 이웃 샘플링으로 각 카드를 160×240 픽셀에 맞춤"],
                ["재조립", "8열×6행, 1280×1440 아틀라스로 결합하고 여백을 측정"],
                ["게임 파생본", "개별 WebP로 크롭해 사용하고 무손실 원본을 함께 보존"],
                ["검증", "카드 경계·비율·월·모티프·파일 존재를 테스트와 화면으로 확인"],
            ],
            [36 * mm, 134 * mm],
        ),
        Spacer(1, 5 * mm),
        p("자산 범주", H2),
        table(
            [
                ["범주", "제작 방식", "검수"],
                ["화투 48장", "사용자 제공 원본의 구조를 기준으로 OpenAI 이미지 생성 후 정렬 보정", "월·모티프·장수·비율 확인"],
                ["부적·비결서·덱 개조", "OpenAI 이미지 생성", "콘텐츠 이름·기능과 그림 연결 확인"],
                ["두목·계절 인물·시작 덱", "OpenAI 이미지 생성", "등장 규칙·계절·문구와 일치 확인"],
                ["UI·카드 표식", "자체 HTML/CSS/SVG와 생성 배경", "한 화면 가독성·겹침·색 대비 확인"],
            ],
            [42 * mm, 77 * mm, 51 * mm],
        ),
        Spacer(1, 5 * mm),
        p("권리와 라이선스", H2),
        bullet("생성 자산은 프로젝트용으로 제작했으며 원본 화투 이미지 이용 권리는 참가자가 확인했다."),
        bullet("Galmuri 글꼴은 SIL Open Font License 1.1에 따라 포함했다."),
        bullet("React, Next.js, Vite, vinext, TypeScript, Vitest 등 오픈소스 버전과 고지는 저장소 문서와 package-lock.json에 기록했다."),
        bullet("오디오별 출처와 라이선스는 public/assets/audio/THIRD_PARTY_NOTICES.md에 별도 기록했다."),
        PageBreak(),
    ]

    s += section("05", "검증 결과와 최신 활용 내역")
    s += [p("2026-08-10 최종 실행: 29개 테스트 파일, 214개 테스트 전부 통과", CALLOUT)]
    s += [
        table(
            [
                ["검증 영역", "대표 확인 내용"],
                ["규칙·상태", "짓/끗패 판정, 점수 연산 순서, 고 문턱·고박 롤백, 저장 복원"],
                ["콘텐츠", "카드·부적·비결서·금단패·두목의 ID, 수량, 태그, 장터 연결"],
                ["화면", "수집판=채점기, 툴팁 레이어, 제출 극장, 금단 연출, 제목 브랜드"],
                ["자산", "화투·생성 이미지·시작 덱·오디오 파일 존재와 경로"],
                ["보스·사운드", "계절 두목 초상·문구·BGM 연결, 재즈 테이블 BGM"],
                ["배포", "GitHub Pages 정적 빌드와 자동 배포 워크플로"],
            ],
            [43 * mm, 127 * mm],
        ),
        Spacer(1, 6 * mm),
        p("2026-08-10 추가 AI 활용", H2),
        bullet("현재 규칙과 화면을 함께 감사해 오래된 명칭·내부 식별자·설명 불일치를 제거"),
        bullet("《경화수월》 브랜드, 전통 문양, 시작 덱·계절 인물·두목·금단패 자산을 최신 기능과 연결"),
        bullet("카드 제출 극장, 상위 족보 강조, 금단패 전용 연출, 계절 두목 등장 패널과 툴팁 레이어 개선"),
        bullet("오디오 자산과 장면별 BGM 연결을 검증하는 테스트 추가"),
        bullet("본 제출 PDF 3·4·5번을 저장소·커밋·최종 테스트 결과에 맞춰 재작성하고 렌더링 검수"),
        Spacer(1, 5 * mm),
        p("재현성 고지", H2),
        table(
            [["항목", "내용"], ["런타임 AI", "0회. 어떤 생성형 AI·유료 API도 호출하지 않음"], ["실행 요건", "API 키·계정·유료 라이선스 불필요"], ["게임 재현", "표시된 문자열 시드와 RNG 커서로 재현"], ["개발 재현", "프롬프트·활용 로그·자산 장부·커밋 이력 유지"]],
            [42 * mm, 128 * mm],
        ),
    ]
    doc.build(s)


def build_team_report():
    path = OUT / "05_팀소개문서.pdf"
    doc = SubmissionDoc(path, "팀 소개 문서", 3)
    s = cover_story(
        "팀 소개 문서",
        "두 명의 역할·담당 영역과 커밋 이력을 기준으로 정리한 협업 구조",
        [("팀 규모", "2인"), ("프로젝트", "경화수월"), ("근거", "Git 커밋·변경 파일·최종 구현"), ("기준일", "2026-08-10")],
    )
    s += section("01", "팀원별 역할")
    s += [
        p("역할은 커밋 저자, 변경 파일, 최종 구현을 기준으로 정리했다. 두 팀원 모두 기획·구현·검수에 참여했고, 아래는 각자가 중심적으로 담당한 영역이다.", LEAD),
        table(
            [
                ["팀원", "주요 역할", "담당 영역"],
                ["이녕환<br/>lshane1028", "게임 시스템·UI·배포 총괄", "현행 React/TypeScript 프로토타입 기반 구축, 짓고땡 규칙 전환, 상태·경제·콘텐츠 엔진, 장터·수집판·튜토리얼 UI, 버그 수정, 오디오·계절 보스 연출, GitHub Pages 자동 배포, 제출 문서 초안"],
                ["안태우<br/>itsfrankocean", "비주얼·게임 흐름·최종 통합", "초기 웹 플레이 수직 슬라이스와 로그라이크 진행 실험, 화투 카드 이미지 정렬·연결, 픽셀 UI와 생성 자산 통합, 카드 효과·점수·라운드 흐름 개선, 《경화수월》 브랜드·전통 문양·금단/제출 연출 정리, 최신 main 병합과 최종 회귀 수정"],
            ],
            [44 * mm, 42 * mm, 84 * mm],
            font_size=7.25,
        ),
        Spacer(1, 6 * mm),
        p("공동 담당", H2),
        bullet("화투 테마와 짓고땡 기반 핵심 재미 확정, 고·스톱 위험 구조와 밸런스 반복 검토"),
        bullet("AI 생성 코드·자산의 사람 검수, 플레이테스트, 회귀 테스트 통과 여부 확인"),
        bullet("브랜치 병합 과정에서 규칙·화면·오디오 충돌을 함께 조정하고 main 빌드를 안정화"),
        bullet("NAN 2026 제출 요구에 맞춘 실행 링크, AI 활용 내역, 팀 역할과 PDF 문서 최종 확인"),
        PageBreak(),
    ]

    s += section("02", "협업 방식과 커밋 근거")
    s += [
        p("기능 축과 표현 축을 나누되, 병합 전에 테스트로 같은 규칙을 확인하는 방식으로 협업했다.", LEAD),
        table(
            [
                ["작업 흐름", "lshane1028 중심", "itsfrankocean 중심", "공동 확인"],
                ["기반 구현", "현행 엔진·상태·UI 골격", "초기 수직 슬라이스·로그라이크 실험", "플레이 가능한 웹 구조"],
                ["규칙·콘텐츠", "짓고땡 전환, 콘텐츠·장터·튜토리얼", "카드 효과·점수·라운드 흐름 보완", "규칙 문구와 실제 동작 일치"],
                ["표현·자산", "UI 반복 개선, 보스·오디오 연결", "화투 이미지, 픽셀 UI, 브랜드·전통 문양·극장 연출", "가독성·타이밍·자산 정합성"],
                ["배포·마감", "Pages 워크플로, 제출 문서 초안", "최신 변경 통합, 회귀 수정, 최종 PDF", "214개 테스트와 제출 파일 확인"],
            ],
            [29 * mm, 45 * mm, 52 * mm, 44 * mm],
            font_size=6.9,
        ),
        Spacer(1, 6 * mm),
        p("대표 커밋", H2),
        table(
            [
                ["팀원", "대표 커밋과 확인되는 기여"],
                ["이녕환 (lshane1028)", "create prototype · feature: game rule change · fix: game ui · add automatic GitHub Pages deployment · Boost seasonal boss presentation · Use smooth jazz table theme"],
                ["안태우 (itsfrankocean)", "build playable Flower Card web vertical slice · unify pixel UI and game assets · improve card effects scoring and round flow · refine rules, card feedback, and run flow · polish game flow and brand 경화수월 · restore submission theater layout"],
            ],
            [42 * mm, 128 * mm],
            font_size=7.1,
        ),
        Spacer(1, 6 * mm),
        p("최종 책임 영역", H2),
        table(
            [
                ["검수 항목", "주 담당", "교차 확인"],
                ["게임 규칙·콘텐츠 수량·튜토리얼", "이녕환", "안태우"],
                ["브랜드·카드 자산·화면 연출·최종 통합", "안태우", "이녕환"],
                ["오디오·보스·배포·제출 문서", "공동", "자동 테스트 + 실제 플레이"],
            ],
            [65 * mm, 50 * mm, 55 * mm],
        ),
        Spacer(1, 5 * mm),
        p("커밋 수 자체를 기여 비율로 환산하지 않았다. 병합 커밋과 대규모 자산 변경이 섞여 있기 때문에, 실제 변경 영역과 최종 책임을 역할 정리의 기준으로 삼았다.", CALLOUT),
    ]
    doc.build(s)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    build_game_overview()
    build_ai_report()
    build_team_report()
    expected = {"03_게임소개및설명문서.pdf": 6, "04_AI활용기술문서.pdf": 6, "05_팀소개문서.pdf": 3}
    for name, page_count in expected.items():
        pdf = OUT / name
        reader = PdfReader(pdf)
        assert len(reader.pages) == page_count, (name, len(reader.pages), page_count)
        assert all((page.extract_text() or "").strip() for page in reader.pages), f"empty page in {name}"
        print(f"built {pdf.relative_to(ROOT)} ({pdf.stat().st_size:,} bytes, {page_count} pages)")


if __name__ == "__main__":
    main()
