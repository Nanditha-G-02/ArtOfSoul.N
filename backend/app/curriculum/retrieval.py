"""Curriculum retrieval.

A dependency-free BM25 index over course records, skills, objectives and exercise templates. Every
hit keeps its provenance and (for course records) the institution, URL and verification status, so
the curriculum LLM can cite only what was actually retrieved.

BM25 is chosen deliberately for the default build: the corpus is small (tens–hundreds of records),
lexical art vocabulary ("glazing", "fat-over-lean", "halftone") matches well, and it needs no
embedding provider. A pgvector/embedding backend can be added behind the same `search()` interface.
"""
import math
import re
from collections import Counter
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m

_TOKEN = re.compile(r"[a-z]+")
_STOP = set("a an and the of to in for on with by as at or is are be from into its it this that their than not".split())
_SYN = {"colour": "color", "colours": "color", "watercolour": "watercolor", "grey": "gray", "pencil": "graphite",
        "tonal": "value", "tone": "value", "tones": "value", "values": "value", "realistic": "realism"}


def tokenize(text: str) -> list[str]:
    out = []
    for t in _TOKEN.findall(text.lower()):
        t = _SYN.get(t, t)
        if t in _STOP or len(t) < 2:
            continue
        if len(t) > 4 and t.endswith("s") and not t.endswith("ss"):
            t = t[:-1]
        out.append(t)
    return out


@dataclass
class Doc:
    kind: str  # course|skill|exercise_template
    ref_id: int
    title: str
    text: str
    track: str
    meta: dict = field(default_factory=dict)


@dataclass
class Hit:
    doc: Doc
    score: float

    def as_dict(self) -> dict:
        return {"kind": self.doc.kind, "id": self.doc.ref_id, "title": self.doc.title, "text": self.doc.text,
                "track": self.doc.track, "score": round(self.score, 3), **self.doc.meta}


class CurriculumIndex:
    k1, b = 1.4, 0.75

    def __init__(self, docs: list[Doc]):
        self.docs = docs
        self.toks = [tokenize(d.title + " " + d.text) for d in docs]
        self.avgdl = sum(map(len, self.toks)) / max(len(self.toks), 1)
        df: Counter = Counter()
        for t in self.toks:
            df.update(set(t))
        n = len(docs)
        self.idf = {w: math.log(1 + (n - c + 0.5) / (c + 0.5)) for w, c in df.items()}
        self.tf = [Counter(t) for t in self.toks]

    @classmethod
    def build(cls, db: Session) -> "CurriculumIndex":
        docs: list[Doc] = []
        for c in db.scalars(select(m.Course)):
            docs.append(Doc("course", c.id, f"{c.institution.name} — {c.course_code} {c.title}",
                            c.summary + " " + " ".join(c.objectives or []), c.track,
                            {"institution": c.institution.name, "course_code": c.course_code, "url": c.source_url,
                             "verification": c.verification, "provenance": "verified" if c.verification == "verified" else "partial",
                             "media": c.media}))
        objectives = {o.skill_id: o.text for o in db.scalars(select(m.LearningObjective))}
        for s in db.scalars(select(m.Skill)):
            docs.append(Doc("skill", s.id, s.name, f"{s.description} {objectives.get(s.id, '')} {s.domain}", s.track,
                            {"slug": s.slug, "provenance": "synthesized", "media": s.media}))
        for e in db.scalars(select(m.ExerciseTemplate)):
            docs.append(Doc("exercise_template", e.id, e.title, e.brief, "both",
                            {"skill_id": e.skill_id, "provenance": "synthesized", "media": e.media}))
        return cls(docs)

    def search(self, query: str, track: str | None = None, kinds: tuple[str, ...] | None = None, k: int = 8) -> list[Hit]:
        q = tokenize(query)
        hits = []
        for i, d in enumerate(self.docs):
            if kinds and d.kind not in kinds:
                continue
            if track and d.track not in (track, "both"):
                continue
            tf, dl = self.tf[i], len(self.toks[i])
            s = 0.0
            for w in q:
                f = tf.get(w)
                if f:
                    s += self.idf[w] * f * (self.k1 + 1) / (f + self.k1 * (1 - self.b + self.b * dl / self.avgdl))
            if s > 0:
                hits.append(Hit(d, s))
        hits.sort(key=lambda h: -h.score)
        return hits[:k]


_cache: dict[str, CurriculumIndex] = {}


def get_index(db: Session) -> CurriculumIndex:
    if "idx" not in _cache:
        _cache["idx"] = CurriculumIndex.build(db)
    return _cache["idx"]


def reset_index() -> None:
    _cache.clear()
