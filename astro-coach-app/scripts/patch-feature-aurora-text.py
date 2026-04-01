#!/usr/bin/env python3
"""One-off: align feature/[id].tsx Text with useThemeColors (system scheme)."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "app/(main)/feature/[id].tsx"


def pick_color(line: str) -> str | None:
    if "text-indigo-200" in line or "text-indigo-300" in line:
        return "tc.isDark ? '#a5b4fc' : '#4338ca'"
    if "text-white/30" in line or "text-white/40" in line:
        return "tc.textTertiary"
    if "text-white/50" in line or "text-white/60" in line:
        return "tc.textSecondary"
    if "text-white/70" in line or "text-white/80" in line or "text-white" in line:
        return "tc.textPrimary"
    if "text-slate-400" in line or "text-slate-300" in line:
        return "tc.textSecondary"
    if "text-slate-200" in line:
        return "tc.textPrimary"
    return None


def main() -> None:
    s = PATH.read_text(encoding="utf-8")
    if 'from "@/lib/themeColors"' not in s:
        s = s.replace(
            'import { useTheme } from "@/providers/ThemeProvider";',
            'import { useThemeColors } from "@/lib/themeColors";\nimport { useTheme } from "@/providers/ThemeProvider";',
        )
    s = re.sub(r"\s*colorSchemeOverride=\"dark\"", "", s)

    def add_tc(m: re.Match[str]) -> str:
        line = m.group(0)
        if "const tc = useThemeColors()" in line:
            return line
        indent = re.match(r"^(\s*)", line).group(1)
        return line + f"\n{indent}const tc = useThemeColors();"

    s = re.sub(r"^(\s*)const \{ theme \} = useTheme\(\);\s*$", add_tc, s, flags=re.M)

    tokens = [
        "text-white/80",
        "text-white/70",
        "text-white/60",
        "text-white/50",
        "text-white/40",
        "text-white/30",
        "text-white",
        "text-slate-200",
        "text-slate-300",
        "text-slate-400",
        "text-indigo-200",
        "text-indigo-300",
    ]

    def patch_text_line(line: str) -> str:
        if "<TextInput" in line or "<Text " not in line or "className=" not in line:
            return line
        if "tc.text" in line or "tc.isDark" in line:
            return line
        color = pick_color(line)
        if not color:
            return line
        if "style={{" in line:
            return line

        q = line
        for t in tokens:
            q = q.replace(t, "")
        q = re.sub(r"\s+", " ", q)
        q = re.sub(r'className="\s*"', "", q)
        q = q.replace('className=" ', 'className="').strip()

        q = q.replace("<Text ", f"<Text style={{{{ color: {color} }}}} ", 1)
        return q

    out_lines = [patch_text_line(L) for L in s.splitlines()]
    PATH.write_text("\n".join(out_lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
