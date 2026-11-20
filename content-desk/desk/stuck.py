"""Date-only calendar rules. Supply the current date in Toronto."""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Iterable, Mapping


STAGE_LIMITS = {"Brief": 1, "Shoot": 3, "Edit": 2, "Client review": 2, "Scheduled": 0}


@dataclass(frozen=True)
class Piece:
    id: str
    title: str
    url: str
    status: str
    owner_id: str
    due: date | None
    stage_changed: date | None

    @classmethod
    def from_notion(cls, page: Mapping) -> "Piece":
        properties = page["properties"]
        owners = properties["Owner"]["people"]
        title = "".join(part["plain_text"] for part in properties["Name"]["title"])

        def date_property(name: str) -> date | None:
            value = properties[name]["date"]
            if value is None:
                return None
            start = value["start"]
            parsed = date.fromisoformat(start)
            if parsed.isoformat() != start:
                raise ValueError(f"{name} must use YYYY-MM-DD")
            return parsed

        return cls(
            id=page["id"],
            title=title or "Untitled piece",
            url=page["url"],
            status=(properties["Status"]["status"] or {}).get("name", ""),
            owner_id=owners[0]["id"] if len(owners) == 1 else "",
            due=date_property("Due"),
            stage_changed=date_property("Stage changed"),
        )


@dataclass(frozen=True)
class LatePiece:
    piece: Piece
    reasons: tuple[str, ...]


@dataclass(frozen=True)
class Digest:
    owner_id: str
    pieces: tuple[LatePiece, ...]

    def slack_text(self, today: date) -> str:
        lines = [f"*Late content pieces for {today.isoformat()}*"]
        for late in self.pieces:
            piece = late.piece
            label = piece.title.replace("|", "/").replace("\n", " ").replace("\r", " ")
            label = label.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            lines.append(f"• <{piece.url}|{label}> ({piece.status}) · {' · '.join(late.reasons)}")
        return "\n".join(lines)


def business_days_between(start: date, end: date) -> int:
    """Count Mondays through Fridays after start and through end."""
    weeks, remainder = divmod(max(0, (end - start).days), 7)
    if remainder == 0:
        return weeks * 5
    return weeks * 5 + sum(
        (start + timedelta(days=offset)).weekday() < 5
        for offset in range(1, remainder + 1)
    )


def late_reasons(piece: Piece, today: date) -> tuple[str, ...]:
    limit = STAGE_LIMITS.get(piece.status)
    if limit is None:
        return ()

    reasons = []
    if piece.due is not None and piece.due < today:
        reasons.append(f"overdue since {piece.due.isoformat()}")
    if piece.stage_changed is not None:
        days = business_days_between(piece.stage_changed, today)
        if days > limit:
            reasons.append(f"in stage for {days} business {'day' if days == 1 else 'days'} (limit {limit})")
    return tuple(reasons)


def owner_digests(pieces: Iterable[Piece], today: date) -> tuple[Digest, ...]:
    grouped: dict[str, list[LatePiece]] = {}
    for piece in pieces:
        reasons = late_reasons(piece, today)
        if reasons:
            if not piece.owner_id:
                raise ValueError(f"Assign exactly one owner to {piece.id}")
            grouped.setdefault(piece.owner_id, []).append(LatePiece(piece, reasons))
    return tuple(Digest(owner_id, tuple(late)) for owner_id, late in grouped.items())
