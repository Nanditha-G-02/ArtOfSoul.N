"""Skill prerequisite graph: dependency closure, ordering and medium filtering."""
from dataclasses import dataclass, field

from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models as m


@dataclass
class SkillNode:
    id: int
    slug: str
    name: str
    track: str
    domain: str
    tier: int
    media: list[str]
    prereqs: list[str] = field(default_factory=list)


class SkillGraph:
    def __init__(self, nodes: dict[str, SkillNode]):
        self.nodes = nodes

    @classmethod
    def load(cls, db: Session) -> "SkillGraph":
        skills = list(db.scalars(select(m.Skill)))
        by_id = {s.id: s for s in skills}
        nodes = {s.slug: SkillNode(s.id, s.slug, s.name, s.track, s.domain, s.tier, list(s.media or [])) for s in skills}
        for p in db.scalars(select(m.SkillPrerequisite)):
            nodes[by_id[p.skill_id].slug].prereqs.append(by_id[p.prerequisite_id].slug)
        return cls(nodes)

    # -- filters
    def applies(self, slug: str, track: str, medium: str | None) -> bool:
        n = self.nodes[slug]
        if n.track not in (track, "both"):
            # cross-track prerequisites are allowed when something in this track depends on them
            return False
        if n.media and medium and medium not in n.media:
            return False
        if n.media and not medium and track == "painting":
            return False  # medium-specific skill with no medium chosen
        return True

    def medium_ok(self, slug: str, medium: str | None) -> bool:
        media = self.nodes[slug].media
        return not media or medium is None or medium in media

    def track_skills(self, track: str, medium: str | None) -> list[str]:
        return [s for s in self.nodes if self.applies(s, track, medium)]

    # -- graph ops
    def ancestors(self, slug: str) -> set[str]:
        seen: set[str] = set()
        stack = list(self.nodes[slug].prereqs)
        while stack:
            s = stack.pop()
            if s not in seen:
                seen.add(s)
                stack.extend(self.nodes[s].prereqs)
        return seen

    def closure(self, targets: list[str]) -> set[str]:
        out: set[str] = set()
        for t in targets:
            if t in self.nodes:
                out.add(t)
                out |= self.ancestors(t)
        return out

    def order(self, slugs: set[str] | list[str]) -> list[str]:
        """Topological order (prerequisites first), ties broken by tier then name — deterministic."""
        slugs = set(slugs)
        indeg = {s: len([p for p in self.nodes[s].prereqs if p in slugs]) for s in slugs}
        ready = sorted([s for s, d in indeg.items() if d == 0], key=self._key)
        out: list[str] = []
        while ready:
            s = ready.pop(0)
            out.append(s)
            for t in slugs:
                if s in self.nodes[t].prereqs:
                    indeg[t] -= 1
                    if indeg[t] == 0:
                        ready.append(t)
                        ready.sort(key=self._key)
        if len(out) != len(slugs):
            raise ValueError("Cycle in skill graph")
        return out

    def _key(self, s: str):
        n = self.nodes[s]
        return (n.tier, n.name)

    def unmet_prerequisites(self, slug: str, statuses: dict[str, str]) -> list[str]:
        """Direct prerequisites with recorded evidence of a gap."""
        return [p for p in self.nodes[slug].prereqs if statuses.get(p) == "needs_practice"]
