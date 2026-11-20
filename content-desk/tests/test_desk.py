import json
import re
from dataclasses import replace
from datetime import date
from html.parser import HTMLParser
from pathlib import Path

import pytest

from desk.draft import brief_from_notion, build_prompt, resolve_draft, validate_completion, validate_draft
from desk.stuck import Piece, business_days_between, late_reasons, owner_digests


ROOT = Path(__file__).resolve().parents[1]
FIXTURES = Path(__file__).with_name("fixtures")
MONDAY = date(2026, 11, 16)


@pytest.fixture(scope="module")
def pages():
    return json.loads((FIXTURES / "notion-pages.json").read_text(encoding="utf-8"))["results"]


@pytest.fixture(scope="module")
def pieces(pages):
    return [Piece.from_notion(page) for page in pages]


@pytest.fixture(scope="module")
def responses():
    return json.loads((FIXTURES / "llm-responses.json").read_text(encoding="utf-8"))


def test_stage_days_over_the_weekend(pieces):
    assert business_days_between(date(2026, 11, 13), MONDAY) == 1
    assert business_days_between(date(2026, 11, 12), MONDAY) == 2
    assert business_days_between(date(2026, 11, 14), date(2026, 11, 15)) == 0
    assert business_days_between(date(2026, 11, 6), MONDAY) == 6
    assert business_days_between(MONDAY, date(2026, 11, 13)) == 0
    assert late_reasons(pieces[0], date(2026, 11, 15)) == ()
    assert late_reasons(pieces[0], MONDAY) == ("in stage for 2 business days (limit 1)",)
    assert late_reasons(pieces[1], MONDAY) == ("overdue since 2026-11-13",)
    assert late_reasons(pieces[4], MONDAY) == ("in stage for 1 business day (limit 0)",)


def test_one_digest_per_owner_with_links(pieces):
    digests = owner_digests(pieces, MONDAY)
    assert [digest.owner_id for digest in digests] == [pieces[i].owner_id for i in (0, 3, 4)]
    assert [[late.piece.id for late in digest.pieces] for digest in digests] == [
        [pieces[0].id, pieces[1].id], [pieces[3].id], [pieces[4].id]
    ]
    for digest in digests:
        text = digest.slack_text(MONDAY)
        for late in digest.pieces:
            assert f"<{late.piece.url}|{late.piece.title}>" in text
            assert all(reason in text for reason in late.reasons)


def test_empty_digest_suppressed(pieces):
    assert owner_digests([], MONDAY) == ()
    assert owner_digests([pieces[i] for i in (2, 5, 6, 7)], MONDAY) == ()
    assert late_reasons(replace(pieces[0], due=None, stage_changed=None), MONDAY) == ()


def test_prompt_and_valid_json(pages, responses):
    brief = brief_from_notion(pages[-1])
    messages = build_prompt(brief)
    assert [message["role"] for message in messages] == ["system", "user"]
    assert json.loads(messages[1]["content"]) == brief
    assert brief["Dish or offer"] == "Ginger-lime spritz"
    result = resolve_draft(brief, [responses["valid"]], status="Brief", ai_draft=None)
    assert result.status == "ready"
    assert result.attempts == 1
    assert result.draft == validate_completion(responses["valid"])
    assert len(result.draft["captions"]) == 3
    assert len(result.draft["shot_list"]) == 4


@pytest.mark.parametrize(
    ("fixture", "error"),
    [("malformed", "not valid JSON"), ("missing_keys", "exactly captions and shot_list")],
)
def test_invalid_completion(responses, fixture, error):
    with pytest.raises(ValueError, match=error):
        validate_completion(responses[fixture])


@pytest.mark.parametrize(
    ("draft", "error"),
    [
        ({"captions": ["a", "b"], "shot_list": ["c"]}, "captions must contain 3"),
        ({"captions": ["a", "b", " "], "shot_list": ["c"]}, "non-empty strings"),
        ({"captions": ["a", "b", "c"], "shot_list": []}, "1 to 6"),
        ({"captions": ["a", "b", "c"], "shot_list": ["x" * 501]}, "500 characters"),
        ({"captions": ["a", "b", "c"], "shot_list": ["d"], "extra": True}, "exactly"),
    ],
)
def test_invalid_draft_shape(draft, error):
    with pytest.raises(ValueError, match=error):
        validate_draft(json.dumps(draft))


@pytest.mark.parametrize("first", ["malformed", "http_error", "timeout"])
def test_retry_can_recover(pages, responses, first):
    outcome = resolve_draft(
        brief_from_notion(pages[-1]), [responses[first], responses["valid"]],
        status="Brief", ai_draft=None,
    )
    assert outcome.status == "ready"
    assert outcome.attempts == 2


def test_one_retry_then_failed(pages, responses):
    def attempts():
        yield responses["malformed"]
        yield responses["http_error"]
        pytest.fail("A second retry was attempted")

    result = resolve_draft(brief_from_notion(pages[-1]), attempts(), status="Brief", ai_draft=None)
    assert result.status == "failed"
    assert result.attempts == 2
    assert result.draft is None
    assert result.reason == "LLM returned HTTP 503"


@pytest.mark.parametrize(
    ("status", "ai_draft"), [("Brief", "ready"), ("Brief", "edited"), ("Brief", "failed"), ("Edit", None)]
)
def test_no_overwrite(pages, status, ai_draft):
    def unexpected_call():
        pytest.fail("An ineligible brief attempted to use the LLM")
        yield

    outcome = resolve_draft(
        brief_from_notion(pages[-1]), unexpected_call(), status=status, ai_draft=ai_draft
    )
    assert outcome.status == "skipped"
    assert outcome.attempts == 0


def test_missing_brief_fields_fail_before_call():
    outcome = resolve_draft({"Restaurant": "Pepper Dock"}, [], status="Brief", ai_draft=None)
    assert outcome.status == "failed"
    assert outcome.attempts == 0
    assert outcome.reason == "Missing brief fields: Dish or offer, Platform"


def test_n8n_connections_match_readme():
    workflow = json.loads((ROOT / "n8n/content-desk.json").read_text(encoding="utf-8"))
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    documented_paths = readme.split("### Workflow paths\n", 1)[1].split("```text\n", 1)[1].split("```", 1)[0]
    expected_edges = set()
    for line in documented_paths.strip().splitlines():
        path = line.split(" -> ")
        for start, end in zip(path, path[1:]):
            name, separator, label = start.partition(" [")
            output_index = 1 if separator and label == "false]" else 0
            expected_edges.add((name, end, output_index))

    nodes = {node["name"]: node for node in workflow["nodes"]}
    actual_edges = {
        (start, entry["node"], output)
        for start, route in workflow["connections"].items()
        for output, children in enumerate(route["main"])
        for entry in children
    }
    assert actual_edges == expected_edges
    assert set(nodes) == {node for start, end, _ in expected_edges for node in (start, end)}
    assert len({node["id"] for node in nodes.values()}) == len(nodes) == len(workflow["nodes"])
    assert workflow["active"] is False
    assert workflow["settings"]["timezone"] == "America/Toronto"
    triggers = {name for name, node in nodes.items() if node["type"].endswith("scheduleTrigger")}
    assert triggers == {"Weekday 09:00 Toronto", "Poll for New Briefs"}
    assert nodes["Weekday 09:00 Toronto"]["parameters"]["rule"]["interval"] == [
        {"field": "cronExpression", "expression": "0 9 * * 1-5"}
    ]
    assert nodes["Poll for New Briefs"]["parameters"]["rule"]["interval"] == [
        {"field": "minutes", "minutesInterval": 5}
    ]
    for node in nodes.values():
        for credential in node.get("credentials", {}).values():
            assert set(credential) == {"name"}
    assert nodes["Update Notion Draft"]["parameters"]["method"] == "PATCH"
    assert nodes["Call LLM"]["onError"] == nodes["Retry LLM Once"]["onError"] == "continueRegularOutput"


class DemoParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = {}
        self.lists = {}
        self.current_row = None
        self.current_list = None
        self.current_item = None

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        assert tag not in {"script", "link", "iframe"}
        assert "src" not in attributes
        assert "href" not in attributes or attributes["href"].startswith("#")
        if tag == "tr" and "data-piece" in attributes:
            self.current_row = attributes["data-piece"]
            self.rows[self.current_row] = ("data-late" in attributes, [])
        if tag == "ol" and attributes.get("id"):
            self.current_list = attributes["id"]
            self.lists[self.current_list] = []
        if tag == "li" and (self.current_row or self.current_list):
            self.current_item = []

    def handle_data(self, data):
        if self.current_item is not None:
            self.current_item.append(data)

    def handle_endtag(self, tag):
        if tag == "li" and self.current_item is not None:
            values = self.rows[self.current_row][1] if self.current_row else self.lists[self.current_list]
            values.append("".join(self.current_item).strip())
            self.current_item = None
        elif tag == "tr":
            self.current_row = None
        elif tag == "ol":
            self.current_list = None


def test_demo_matches_digest_and_canned_draft(pieces, responses):
    html = (ROOT / "demo/index.html").read_text(encoding="utf-8")
    assert re.search(r'<meta name="viewport"[^>]+>', html)
    assert not re.search(r"(?:@import|url\s*\()", html)
    parser = DemoParser()
    parser.feed(html)
    parser.close()
    expected = {
        late.piece.id: (True, list(late.reasons))
        for digest in owner_digests(pieces, MONDAY)
        for late in digest.pieces
    }
    assert len(parser.rows) == 8
    assert parser.rows == {piece.id: expected.get(piece.id, (False, [])) for piece in pieces}
    draft = validate_completion(responses["valid"])
    assert parser.lists["sample-captions"] == draft["captions"]
    assert parser.lists["sample-shots"] == draft["shot_list"]
