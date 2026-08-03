import os
import re
import subprocess
from pathlib import Path

# Output directories
SVG_DIR = os.path.abspath("art/svg-items")
PREVIEW_DIR = os.path.abspath("art/svg-items/preview")
os.makedirs(SVG_DIR, exist_ok=True)
os.makedirs(PREVIEW_DIR, exist_ok=True)

# Browser used to render the PNG previews.
#
# Was a hard-coded Windows Edge path, which meant the generator could only be
# run on one machine -- and it `check=True`d the subprocess, so on any other
# machine it wrote all 34 SVGs correctly and then died on the first preview.
# The SVGs are the artefact; previews are a convenience. Any Chromium will do,
# and if none is found the previews are skipped with a note rather than taking
# the whole run down.
PREVIEW_BROWSERS = [
    os.environ.get("CHROME_PATH", ""),
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome",
]


def find_browser():
    for path in PREVIEW_BROWSERS:
        if path and os.path.exists(path):
            return path
    # Whatever Playwright downloaded for this repo's tests.
    base = "/opt/pw-browsers"
    if os.path.isdir(base):
        for name in sorted(os.listdir(base)):
            if name.startswith("chromium-"):
                exe = os.path.join(base, name, "chrome-linux", "chrome")
                if os.path.exists(exe):
                    return exe
    return None

# Reusable SVG Defs (Gradients & Filters)
COMMON_DEFS = """  <defs>
    <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#120c1f" flood-opacity="0.5"/>
    </filter>

    <filter id="glow-purple" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>

    <linearGradient id="blade-light" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="65%" stop-color="#d1dbe5"/>
      <stop offset="100%" stop-color="#99aec4"/>
    </linearGradient>

    <linearGradient id="blade-dark" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#8ba0b8"/>
      <stop offset="100%" stop-color="#4e6278"/>
    </linearGradient>

    <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff176"/>
      <stop offset="50%" stop-color="#f5b324"/>
      <stop offset="100%" stop-color="#945f21"/>
    </linearGradient>

    <linearGradient id="brass-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffe875"/>
      <stop offset="100%" stop-color="#b8780e"/>
    </linearGradient>

    <linearGradient id="wood-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#a06037"/>
      <stop offset="50%" stop-color="#734020"/>
      <stop offset="100%" stop-color="#42220f"/>
    </linearGradient>

    <linearGradient id="leather-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#5c3422"/>
      <stop offset="50%" stop-color="#3d2013"/>
      <stop offset="100%" stop-color="#241108"/>
    </linearGradient>

    <linearGradient id="leather-light" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8a5238"/>
      <stop offset="100%" stop-color="#5c3422"/>
    </linearGradient>

    <linearGradient id="leather-dark" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b2014"/>
      <stop offset="100%" stop-color="#1c0d06"/>
    </linearGradient>

    <linearGradient id="cloth-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#d9b88f"/>
      <stop offset="50%" stop-color="#ab875a"/>
      <stop offset="100%" stop-color="#6e502c"/>
    </linearGradient>

    <linearGradient id="fur-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e0d7cd"/>
      <stop offset="60%" stop-color="#998777"/>
      <stop offset="100%" stop-color="#4d4136"/>
    </linearGradient>

    <linearGradient id="poison-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#76ff03"/>
      <stop offset="100%" stop-color="#33691e"/>
    </linearGradient>

    <linearGradient id="ribbon-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff4d4d"/>
      <stop offset="70%" stop-color="#cc1133"/>
      <stop offset="100%" stop-color="#7a001e"/>
    </linearGradient>

    <!-- Liquid Gradients -->
    <radialGradient id="liquid-red" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="#ff6b8b"/>
      <stop offset="50%" stop-color="#ff1a40"/>
      <stop offset="90%" stop-color="#b30024"/>
      <stop offset="100%" stop-color="#660012"/>
    </radialGradient>

    <radialGradient id="liquid-ruby" cx="45%" cy="40%" r="55%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="25%" stop-color="#ff758c"/>
      <stop offset="60%" stop-color="#ff1244"/>
      <stop offset="90%" stop-color="#990022"/>
      <stop offset="100%" stop-color="#4a000f"/>
    </radialGradient>

    <radialGradient id="fire-liquid" cx="50%" cy="60%" r="55%">
      <stop offset="0%" stop-color="#fff59d"/>
      <stop offset="35%" stop-color="#ffb74d"/>
      <stop offset="70%" stop-color="#ff5722"/>
      <stop offset="100%" stop-color="#b71c1c"/>
    </radialGradient>

    <linearGradient id="glass-shine" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.8"/>
      <stop offset="30%" stop-color="#ffffff" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.0"/>
    </linearGradient>

    <linearGradient id="cork-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#c9915c"/>
      <stop offset="100%" stop-color="#7a4e28"/>
    </linearGradient>

    <linearGradient id="parchment" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff9d9"/>
      <stop offset="60%" stop-color="#ebd89b"/>
      <stop offset="100%" stop-color="#c4af6e"/>
    </linearGradient>

    <linearGradient id="parchment-dark" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#b8a15c"/>
      <stop offset="100%" stop-color="#786328"/>
    </linearGradient>

    <linearGradient id="steel-rim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#eaeff5"/>
      <stop offset="50%" stop-color="#b0c2d4"/>
      <stop offset="100%" stop-color="#5a6e85"/>
    </linearGradient>

    <linearGradient id="shield-field-left" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2a52be"/>
      <stop offset="100%" stop-color="#142866"/>
    </linearGradient>

    <linearGradient id="shield-field-right" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#d93838"/>
      <stop offset="100%" stop-color="#731414"/>
    </linearGradient>

    <linearGradient id="horn-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f5e6d3"/>
      <stop offset="100%" stop-color="#8a735c"/>
    </linearGradient>

    <linearGradient id="feather-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff5252"/>
      <stop offset="100%" stop-color="#880e4f"/>
    </linearGradient>
  </defs>"""

def tighten(svg: str, item_id: str) -> str:
    """Drop the defs this icon does not use, and namespace the ones it does.

    TWO PROBLEMS, ONE PASS.

    Every icon was emitted with the whole shared `COMMON_DEFS` block, so each
    file defined 26 gradients and filters and referenced four to six of them:
    across the set, 732 of 884 definitions -- 83% -- were dead weight in a file
    whose entire job is to be small.

    Worse, all 34 files therefore declared the SAME ids. SVG ids are document
    scoped, so as separate `<img>` files that is harmless, but the moment two of
    them are inlined into one page (a sprite sheet, a React component, a docs
    build) the last `blade-light` wins and every icon before it silently repaints
    in another icon's colours. Prefixing with the item id makes that impossible
    rather than merely unlikely.
    """
    used = set(re.findall(r'url\(#([^)]+)\)', svg))
    used |= set(re.findall(r'href="#([^"]+)"', svg))

    # Keep a definition only if something points at it. Matched as whole
    # elements so a gradient's <stop> children go with it.
    def keep(m: "re.Match[str]") -> str:
        return m.group(0) if m.group(2) in used else ''
    body = re.sub(r'<(linearGradient|radialGradient|filter|clipPath|pattern)\b[^>]*id="([^"]+)"[\s\S]*?</\1>',
                  keep, svg)

    # Namespace what survived. Both halves in one substitution so a definition
    # and its references cannot fall out of step.
    for name in sorted(used, key=len, reverse=True):
        body = body.replace(f'id="{name}"', f'id="{item_id}-{name}"')
        body = body.replace(f'url(#{name})', f'url(#{item_id}-{name})')
        body = body.replace(f'href="#{name}"', f'href="#{item_id}-{name}"')

    # An empty <defs> left behind by the filtering is just noise.
    body = re.sub(r'<defs>\s*</defs>\n?', '', body)
    # ...and so are the blank lines the removals leave.
    return re.sub(r'\n\s*\n(\s*\n)+', '\n\n', body)


def wrap_svg(content):
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
{COMMON_DEFS}
{content}
</svg>"""

# ==============================================================================
# SWORDS (100% Transparent Background)
# ==============================================================================
def generate_sword(id_name, blade_top, blade_bot, blade_w, hilt_h, guard_type="swept", has_ricasso=False, gem_color="#e60039"):
    blade_left = f"256,{blade_top} {256 - blade_w // 2},{blade_bot} 256,{blade_bot}"
    blade_right = f"256,{blade_top} {256 + blade_w // 2},{blade_bot} 256,{blade_bot}"
    blade_outline = f"256,{blade_top} {256 - blade_w // 2},{blade_bot} {256 + blade_w // 2},{blade_bot}"
    
    glint_top = blade_top - 10
    glint = f"{256},{glint_top} {259},{glint_top+7} {266},{glint_top+10} {259},{glint_top+13} {256},{glint_top+20} {253},{glint_top+13} {246},{glint_top+10} {253},{glint_top+7}"

    ricasso_markup = ""
    if has_ricasso:
        ricasso_y = blade_bot - 45
        ricasso_markup = f"""
    <!-- Ricasso Lugs -->
    <polygon points="{256 - blade_w // 2},{ricasso_y} {256 - blade_w // 2 - 24},{ricasso_y+10} {256 - blade_w // 2},{ricasso_y+25}" fill="url(#blade-light)" stroke="#2a2333" stroke-width="4" stroke-linejoin="round"/>
    <polygon points="{256 + blade_w // 2},{ricasso_y} {256 + blade_w // 2 + 24},{ricasso_y+10} {256 + blade_w // 2},{ricasso_y+25}" fill="url(#blade-dark)" stroke="#2a2333" stroke-width="4" stroke-linejoin="round"/>"""

    guard_y = blade_bot
    if guard_type == "straight":
        guard_markup = f"""
    <!-- Straight Crossguard -->
    <rect x="186" y="{guard_y - 4}" width="140" height="14" rx="4" fill="url(#brass-grad)" stroke="#2a2333" stroke-width="4.5"/>
    <circle cx="256" cy="{guard_y + 3}" r="6" fill="#f5b324" stroke="#2a2333" stroke-width="2"/>"""
        hilt_y = guard_y + 10
    elif guard_type == "winged":
        guard_markup = f"""
    <!-- Winged Crossguard -->
    <path d="M 256,{guard_y - 5} L 345,{guard_y - 35} L 360,{guard_y - 20} L 320,{guard_y + 10} L 256,{guard_y + 15} L 192,{guard_y + 10} L 152,{guard_y - 20} L 167,{guard_y - 35} Z" fill="url(#gold-grad)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <polygon points="256,{guard_y - 12} 268,{guard_y + 5} 256,{guard_y + 22} 244,{guard_y + 5}" fill="url(#gold-grad)" stroke="#2a2333" stroke-width="4"/>
    <circle cx="256" cy="{guard_y + 5}" r="5" fill="{gem_color}" stroke="#2a2333" stroke-width="2"/>"""
        hilt_y = guard_y + 15
    else: # swept
        guard_markup = f"""
    <!-- Swept Crossguard -->
    <path d="M 256,{guard_y - 5} C 220,{guard_y - 10} 180,{guard_y - 30} 160,{guard_y - 45} C 155,{guard_y - 30} 170,{guard_y - 10} 192,{guard_y + 2} C 222,{guard_y + 12} 242,{guard_y + 15} 256,{guard_y + 15} C 270,{guard_y + 15} 290,{guard_y + 12} 320,{guard_y + 2} C 342,{guard_y - 10} 357,{guard_y - 30} 352,{guard_y - 45} C 332,{guard_y - 30} 292,{guard_y - 10} 256,{guard_y - 5} Z" fill="url(#gold-grad)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <polygon points="256,{guard_y - 12} 268,{guard_y + 2} 256,{guard_y + 16} 244,{guard_y + 2}" fill="url(#gold-grad)" stroke="#2a2333" stroke-width="4"/>
    <circle cx="256" cy="{guard_y + 2}" r="5" fill="{gem_color}" stroke="#2a2333" stroke-width="2"/>"""
        hilt_y = guard_y + 15

    pommel_y = hilt_y + hilt_h + 16
    
    ribs = ""
    for r_offset in range(12, hilt_h - 5, 16):
        ribs += f'\n    <line x1="247" y1="{hilt_y + r_offset}" x2="265" y2="{hilt_y + r_offset}" stroke="#f5b324" stroke-width="2.5"/>'

    poison_markup = ""
    if id_name == "dagger":
        poison_markup = """
    <!-- Poison Drip -->
    <path d="M 268,210 Q 271,230 267,250 L 268,280 L 256,280 Z" fill="url(#poison-grad)"/>
    <circle cx="273" cy="245" r="4" fill="#76ff03" stroke="#2a2333" stroke-width="2"/>
    <circle cx="277" cy="263" r="2.5" fill="#76ff03"/>"""

    content = f"""  <!-- {id_name.upper()} (100% Transparent Background) -->
  <g filter="url(#drop-shadow)" transform="rotate(-45 256 256)">
    <polygon points="{blade_left}" fill="url(#blade-light)"/>
    <polygon points="{blade_right}" fill="url(#blade-dark)"/>
    {poison_markup}
    {ricasso_markup}
    <line x1="256" y1="{blade_top + 30}" x2="256" y2="{blade_bot - 20}" stroke="#2a2333" stroke-width="5" stroke-linecap="round"/>
    <line x1="255" y1="{blade_top + 30}" x2="255" y2="{blade_bot - 25}" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity="0.9"/>
    {guard_markup}
    <rect x="247" y="{hilt_y}" width="18" height="{hilt_h}" rx="3" fill="url(#leather-grad)" stroke="#2a2333" stroke-width="5"/>
    {ribs}
    <circle cx="256" cy="{pommel_y}" r="18" fill="url(#gold-grad)" stroke="#2a2333" stroke-width="5"/>
    <circle cx="256" cy="{pommel_y}" r="8" fill="#d9910d" stroke="#2a2333" stroke-width="2"/>
    <circle cx="253" cy="{pommel_y - 3}" r="2.5" fill="#ffffff"/>
    <polygon points="{blade_outline}" fill="none" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <polygon points="{glint}" fill="#ffffff"/>
  </g>"""
    
    return wrap_svg(content)

# SCIMITAR
def generate_scimitar():
    content = """  <!-- SCIMITAR (100% Transparent Background) -->
  <g filter="url(#drop-shadow)" transform="rotate(-45 256 256)">
    <!-- Curved Single-Edged Blade -->
    <path d="M 256,50 C 230,120 200,200 240,300 L 256,300 C 265,220 280,140 256,50 Z" fill="url(#blade-light)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <path d="M 256,50 C 245,120 225,200 248,300 Z" fill="#ffffff" opacity="0.4"/>
    
    <!-- Brass Knuckle Guard & Quillon -->
    <path d="M 240,298 C 180,290 170,350 240,360 Z" fill="url(#brass-grad)" stroke="#2a2333" stroke-width="4.5"/>
    <rect x="220" y="295" width="50" height="12" rx="3" fill="url(#brass-grad)" stroke="#2a2333" stroke-width="4.5"/>
    
    <!-- Curved Single-Hand Grip -->
    <rect x="247" y="307" width="16" height="48" rx="3" fill="url(#wood-grad)" stroke="#2a2333" stroke-width="4.5"/>
    
    <!-- Brass Pommel Ring -->
    <circle cx="255" cy="370" r="14" fill="url(#brass-grad)" stroke="#2a2333" stroke-width="4.5"/>
  </g>"""
    return wrap_svg(content)

# RAPIER
def generate_rapier():
    content = """  <!-- RAPIER (100% Transparent Background) -->
  <g filter="url(#drop-shadow)" transform="rotate(-45 256 256)">
    <!-- Slender Needle Blade -->
    <polygon points="256,30 250,300 262,300" fill="url(#blade-light)" stroke="#2a2333" stroke-width="4" stroke-linejoin="round"/>
    <line x1="256" y1="40" x2="256" y2="295" stroke="#ffffff" stroke-width="2"/>

    <!-- Sweeping Wire Cup Basket Guard -->
    <path d="M 256,290 C 200,270 170,310 240,335 C 290,350 320,300 256,290 Z" fill="url(#brass-grad)" stroke="#2a2333" stroke-width="5" opacity="0.95"/>
    <circle cx="256" cy="300" r="6" fill="#ffffff" stroke="#2a2333" stroke-width="2"/>

    <!-- Slender Grip -->
    <rect x="249" y="302" width="14" height="45" rx="3" fill="url(#leather-grad)" stroke="#2a2333" stroke-width="4"/>

    <!-- Urn-Shaped Gold Pommel -->
    <polygon points="256,350 266,358 260,372 252,372 246,358" fill="url(#gold-grad)" stroke="#2a2333" stroke-width="4"/>
  </g>"""
    return wrap_svg(content)

# SPEAR
def generate_spear():
    content = """  <!-- SPEAR (100% Transparent Background) -->
  <g filter="url(#drop-shadow)" transform="rotate(-45 256 256)">
    <rect x="249" y="160" width="14" height="280" rx="2" fill="url(#wood-grad)" stroke="#2a2333" stroke-width="4.5"/>
    <polygon points="249,440 263,440 260,460 252,460" fill="#4e6278" stroke="#2a2333" stroke-width="3"/>
    <g fill="#4a2818" stroke="#2a2333" stroke-width="3">
      <rect x="248" y="280" width="16" height="60" rx="1"/>
      <line x1="248" y1="295" x2="264" y2="295" stroke="#f0b869" stroke-width="2"/>
      <line x1="248" y1="310" x2="264" y2="310" stroke="#f0b869" stroke-width="2"/>
      <line x1="248" y1="325" x2="264" y2="325" stroke="#f0b869" stroke-width="2"/>
    </g>
    <polygon points="245,150 267,150 262,170 250,170" fill="url(#brass-grad)" stroke="#2a2333" stroke-width="4"/>
    <path d="M 256,40 Q 230,100 245,150 L 256,150 Z" fill="url(#blade-light)"/>
    <path d="M 256,40 Q 282,100 267,150 L 256,150 Z" fill="url(#blade-dark)"/>
    <line x1="256" y1="45" x2="256" y2="150" stroke="#2a2333" stroke-width="4"/>
    <path d="M 256,40 Q 230,100 245,150 L 267,150 Q 282,100 256,40 Z" fill="none" stroke="#2a2333" stroke-width="4.5" stroke-linejoin="round"/>
  </g>"""
    return wrap_svg(content)

# QUARTERSTAFF
def generate_quarterstaff():
    content = """  <!-- QUARTERSTAFF (100% Transparent Background) -->
  <g filter="url(#drop-shadow)" transform="rotate(-45 256 256)">
    <rect x="247" y="50" width="18" height="410" rx="4" fill="url(#wood-grad)" stroke="#2a2333" stroke-width="5"/>
    <rect x="245" y="50" width="22" height="35" rx="3" fill="url(#blade-dark)" stroke="#2a2333" stroke-width="4"/>
    <rect x="245" y="425" width="22" height="35" rx="3" fill="url(#blade-dark)" stroke="#2a2333" stroke-width="4"/>
    <g fill="#37474f" stroke="#2a2333" stroke-width="3">
      <rect x="246" y="210" width="20" height="92" rx="2"/>
      <line x1="246" y1="233" x2="266" y2="233" stroke="#ffe875" stroke-width="2.5"/>
      <line x1="246" y1="256" x2="266" y2="256" stroke="#ffe875" stroke-width="2.5"/>
      <line x1="246" y1="279" x2="266" y2="279" stroke="#ffe875" stroke-width="2.5"/>
    </g>
  </g>"""
    return wrap_svg(content)

# LONGBOW
def generate_longbow():
    content = """  <!-- LONGBOW (100% Transparent Background) -->
  <g filter="url(#drop-shadow)">
    <path d="M 80,40 C 230,70 380,140 420,280 C 445,360 460,420 450,470 C 430,460 395,380 365,280 C 315,160 180,100 80,40 Z" fill="url(#wood-grad)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <ellipse cx="80" cy="40" rx="10" ry="14" transform="rotate(-30 80 40)" fill="url(#horn-grad)" stroke="#2a2333" stroke-width="3"/>
    <ellipse cx="450" cy="470" rx="10" ry="14" transform="rotate(30 450 470)" fill="url(#horn-grad)" stroke="#2a2333" stroke-width="3"/>
    <path d="M 80,40 L 220,290 L 450,470" fill="none" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M 345,235 C 360,255 370,270 380,280 L 360,290 C 350,280 340,265 325,245 Z" fill="#3e2723" stroke="#2a2333" stroke-width="4"/>
  </g>"""
    return wrap_svg(content)

# BATTLEAXE
def generate_battleaxe():
    content = """  <!-- BATTLEAXE (100% Transparent Background) -->
  <g filter="url(#drop-shadow)" transform="rotate(-45 256 256)">
    <rect x="247" y="120" width="18" height="290" rx="3" fill="url(#wood-grad)" stroke="#2a2333" stroke-width="5"/>
    <polygon points="247,400 265,400 262,418 250,418" fill="url(#gold-grad)" stroke="#2a2333" stroke-width="4"/>
    <polygon points="256,60 264,120 248,120" fill="url(#blade-light)" stroke="#2a2333" stroke-width="4" stroke-linejoin="round"/>
    <path d="M 247,125 Q 140,80 135,175 Q 140,270 247,225 Z" fill="url(#blade-light)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <rect x="265" y="145" width="35" height="60" rx="2" fill="url(#blade-dark)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <rect x="242" y="135" width="28" height="80" rx="4" fill="#354457" stroke="#2a2333" stroke-width="5"/>
  </g>"""
    return wrap_svg(content)

# ==============================================================================
# OTHER ITEMS (100% Transparent Background)
# ==============================================================================
def generate_potion_healing():
    content = """  <!-- POTION OF HEALING (100% Transparent Background) -->
  <g filter="url(#drop-shadow)">
    <path d="M 226,90 L 286,90 L 280,130 L 232,130 Z" fill="url(#cork-grad)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <ellipse cx="256" cy="90" rx="30" ry="8" fill="#dfaa73" stroke="#2a2333" stroke-width="4"/>
    <path d="M 220,126 C 220,126 215,165 195,190 C 175,215 130,240 130,300 C 130,380 185,420 256,420 C 327,420 382,380 382,300 C 382,240 337,215 317,190 C 297,165 292,126 292,126 Z" fill="#1e2936" stroke="#2a2333" stroke-width="6" stroke-linejoin="round"/>
    <path d="M 142,310 C 142,375 190,408 256,408 C 322,408 370,375 370,310 C 370,265 330,245 310,225 C 295,210 290,190 290,190 L 222,190 C 222,190 217,210 202,225 C 182,245 142,265 142,310 Z" fill="url(#liquid-red)"/>
    <ellipse cx="256" cy="235" rx="52" ry="14" fill="#ff809b" opacity="0.8"/>
    <circle cx="230" cy="330" r="14" fill="#ffb3c1" opacity="0.7"/>
    <g transform="translate(256, 320)" stroke="#2a2333" stroke-width="3.5">
      <path d="M -10,-24 L 10,-24 L 10,-10 L 24,-10 L 24,10 L 10,10 L 10,24 L -10,24 L -10,10 L -24,10 L -24,-10 L -10,-10 Z" fill="url(#gold-grad)"/>
    </g>
    <path d="M 160,265 Q 148,300 155,340 C 160,365 175,388 200,400" fill="none" stroke="url(#glass-shine)" stroke-width="12" stroke-linecap="round"/>
  </g>"""
    return wrap_svg(content)

def generate_potion_greater_healing():
    content = """  <!-- POTION OF GREATER HEALING (100% Transparent Background) -->
  <g filter="url(#drop-shadow)">
    <path d="M 226,70 L 286,70 L 280,110 L 232,110 Z" fill="url(#gold-grad)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <polygon points="230,110 282,110 300,160 385,250 355,420 157,420 127,250 212,160" fill="#1a1224" stroke="#2a2333" stroke-width="6" stroke-linejoin="round"/>
    <polygon points="236,125 276,125 290,165 370,250 340,405 172,405 142,250 222,165" fill="url(#liquid-ruby)"/>
    <g fill="none" stroke="url(#gold-grad)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
      <path d="M 256,110 L 256,420" stroke-width="8"/>
      <path d="M 127,250 Q 200,280 256,250 Q 312,280 385,250"/>
    </g>
    <g transform="translate(256, 310)" stroke="#2a2333" stroke-width="3">
      <path d="M -12,-30 L 12,-30 L 12,-12 L 30,-12 L 30,12 L 12,12 L 12,30 L -12,30 L -12,12 L -30,12 L -30,-12 L -12,-12 Z" fill="url(#gold-grad)"/>
    </g>
  </g>"""
    return wrap_svg(content)

def generate_alchemists_fire():
    content = """  <!-- ALCHEMIST'S FIRE (100% Transparent Background) -->
  <g filter="url(#drop-shadow)">
    <polygon points="236,100 276,100 270,135 242,135" fill="url(#blade-dark)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <polygon points="256,130 330,175 375,275 335,410 177,410 137,275 182,175" fill="#1f1828" stroke="#2a2333" stroke-width="6" stroke-linejoin="round"/>
    <polygon points="256,145 320,185 362,275 328,398 184,398 148,275 192,185" fill="url(#fire-liquid)"/>
    <g stroke="#2a2333" stroke-width="4.5" stroke-linejoin="round">
      <line x1="256" y1="130" x2="256" y2="410" stroke="url(#brass-grad)" stroke-width="7"/>
      <path d="M 137,275 Q 256,300 375,275" fill="none" stroke="url(#brass-grad)" stroke-width="7"/>
    </g>
  </g>"""
    return wrap_svg(content)

def generate_scroll():
    content = """  <!-- SCROLL (100% Transparent Background) -->
  <g filter="url(#drop-shadow)">
    <path d="M 100,360 L 220,445" stroke="url(#brass-grad)" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 120,340 C 180,390 320,430 380,390 L 410,150 C 350,190 210,150 150,100 Z" fill="url(#parchment)" stroke="#2a2333" stroke-width="6" stroke-linejoin="round"/>
    <path d="M 150,100 C 210,150 350,190 410,150 C 430,135 420,100 390,90 C 330,70 190,70 130,110 C 110,125 125,145 150,100 Z" fill="url(#parchment-dark)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <g fill="none" stroke="#d8b4fe" stroke-width="3" opacity="0.95" filter="url(#glow-purple)">
      <circle cx="270" cy="265" r="50" stroke-dasharray="8 4"/>
      <circle cx="270" cy="265" r="35"/>
      <polygon points="270,225 305,285 235,285"/>
      <polygon points="270,305 305,245 235,245"/>
    </g>
    <path d="M 125,320 C 145,355 170,380 185,410" fill="none" stroke="url(#ribbon-grad)" stroke-width="12" stroke-linecap="round"/>
    <circle cx="165" cy="375" r="22" fill="url(#ribbon-grad)" stroke="#2a2333" stroke-width="4"/>
  </g>"""
    return wrap_svg(content)

def generate_shortbow():
    content = """  <!-- SHORTBOW (100% Transparent Background) -->
  <g filter="url(#drop-shadow)">
    <path d="M 120,80 C 240,110 370,160 400,280 C 420,350 440,380 430,410 C 410,400 380,340 350,270 C 310,180 200,140 120,80 Z" fill="url(#wood-grad)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <path d="M 120,80 L 220,270 L 430,410" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
    <line x1="165" y1="325" x2="390" y2="100" stroke="#8d6e63" stroke-width="5" stroke-linecap="round"/>
    <polygon points="390,100 425,65 405,115" fill="#cfd8dc" stroke="#2a2333" stroke-width="4" stroke-linejoin="round"/>
  </g>"""
    return wrap_svg(content)

def generate_light_crossbow():
    content = """  <!-- LIGHT CROSSBOW (100% Transparent Background) -->
  <g filter="url(#drop-shadow)" transform="rotate(-45 256 256)">
    <rect x="245" y="110" width="22" height="300" rx="3" fill="url(#wood-grad)" stroke="#2a2333" stroke-width="5"/>
    <path d="M 130,130 L 256,260 L 382,130" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
    <path d="M 245,115 C 200,115 150,115 130,130 C 120,135 125,145 135,140 C 160,130 205,128 245,125 Z" fill="url(#blade-light)" stroke="#2a2333" stroke-width="4" stroke-linejoin="round"/>
    <path d="M 267,115 C 312,115 362,115 382,130 C 392,135 387,145 377,140 C 352,130 307,128 267,125 Z" fill="url(#blade-light)" stroke="#2a2333" stroke-width="4" stroke-linejoin="round"/>
    <line x1="256" y1="260" x2="256" y2="70" stroke="#8d6e63" stroke-width="5" stroke-linecap="round"/>
    <polygon points="256,50 268,75 256,85 244,75" fill="#ffffff" stroke="#2a2333" stroke-width="4" stroke-linejoin="round"/>
  </g>"""
    return wrap_svg(content)

def generate_shield():
    content = """  <!-- SHIELD (100% Transparent Background) -->
  <g filter="url(#drop-shadow)">
    <path d="M 256,60 L 390,95 C 390,260 360,370 256,450 C 152,370 122,260 122,95 Z" fill="url(#steel-rim)" stroke="#2a2333" stroke-width="6" stroke-linejoin="round"/>
    <path d="M 256,80 L 142,110 C 142,245 165,345 256,424 Z" fill="url(#shield-field-left)"/>
    <path d="M 256,80 L 370,110 C 370,245 347,345 256,424 Z" fill="url(#shield-field-right)"/>
    <g transform="translate(256, 220)">
      <path d="M 0,-55 L 8,-35 L 25,-45 L 18,-25 L 40,-25 L 25,-8 L 45,0 L 25,8 L 40,25 L 18,25 L 25,45 L 8,35 L 0,55 L -8,35 L -25,45 L -18,25 L -40,25 L -25,8 L -45,0 L -25,-8 L -40,-25 L -18,-25 L -25,-45 L -8,-35 Z" fill="url(#gold-grad)" stroke="#2a2333" stroke-width="4" stroke-linejoin="round"/>
    </g>
  </g>"""
    return wrap_svg(content)

def generate_javelin():
    content = """  <!-- JAVELIN (100% Transparent Background) -->
  <g filter="url(#drop-shadow)" transform="rotate(-45 256 256)">
    <rect x="249" y="170" width="14" height="260" rx="2" fill="url(#wood-grad)" stroke="#2a2333" stroke-width="4"/>
    <path d="M 256,175 C 230,185 205,170 185,190 C 175,200 185,215 200,205 C 220,195 240,200 256,185 Z" fill="url(#ribbon-grad)" stroke="#2a2333" stroke-width="3.5" stroke-linejoin="round"/>
    <polygon points="246,165 266,165 262,185 250,185" fill="url(#brass-grad)" stroke="#2a2333" stroke-width="4"/>
    <path d="M 256,60 Q 235,115 246,165 L 256,165 Z" fill="url(#blade-light)"/>
    <path d="M 256,60 Q 277,115 266,165 L 256,165 Z" fill="url(#blade-dark)"/>
  </g>"""
    return wrap_svg(content)

def generate_greataxe():
    content = """  <!-- GREATAXE (100% Transparent Background) -->
  <g filter="url(#drop-shadow)" transform="rotate(-45 256 256)">
    <rect x="247" y="110" width="18" height="320" rx="3" fill="url(#wood-grad)" stroke="#2a2333" stroke-width="5"/>
    <polygon points="256,45 264,110 248,110" fill="url(#blade-light)" stroke="#2a2333" stroke-width="4" stroke-linejoin="round"/>
    <path d="M 247,115 Q 120,70 120,165 Q 120,260 247,215 Z" fill="url(#blade-light)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <path d="M 265,115 Q 392,70 392,165 Q 392,260 265,215 Z" fill="url(#blade-dark)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <rect x="242" y="125" width="28" height="80" rx="4" fill="#354457" stroke="#2a2333" stroke-width="5"/>
  </g>"""
    return wrap_svg(content)

def generate_handaxe():
    content = """  <!-- HANDAXE (100% Transparent Background) -->
  <g filter="url(#drop-shadow)" transform="rotate(-45 256 256)">
    <rect x="248" y="120" width="16" height="260" rx="3" fill="url(#wood-grad)" stroke="#2a2333" stroke-width="4.5"/>
    <path d="M 248,125 Q 160,85 150,165 Q 160,245 248,205 Z" fill="url(#blade-light)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <rect x="264" y="140" width="30" height="50" rx="2" fill="url(#blade-dark)" stroke="#2a2333" stroke-width="4.5" stroke-linejoin="round"/>
    <rect x="242" y="130" width="28" height="70" rx="3" fill="#37474f" stroke="#2a2333" stroke-width="4.5"/>
  </g>"""
    return wrap_svg(content)

def generate_mace():
    content = """  <!-- MACE (100% Transparent Background) -->
  <g filter="url(#drop-shadow)" transform="rotate(-45 256 256)">
    <rect x="247" y="140" width="18" height="290" rx="3" fill="url(#wood-grad)" stroke="#2a2333" stroke-width="5"/>
    <polygon points="247,115 170,140 247,165" fill="url(#blade-light)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <polygon points="265,115 342,140 265,165" fill="url(#blade-dark)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <circle cx="256" cy="140" r="26" fill="url(#blade-light)" stroke="#2a2333" stroke-width="5"/>
  </g>"""
    return wrap_svg(content)

def generate_warhammer():
    content = """  <!-- WARHAMMER (100% Transparent Background) -->
  <g filter="url(#drop-shadow)" transform="rotate(-45 256 256)">
    <rect x="247" y="120" width="18" height="310" rx="3" fill="url(#wood-grad)" stroke="#2a2333" stroke-width="5"/>
    <polygon points="247,120 160,145 247,170" fill="url(#blade-light)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <polygon points="265,120 355,120 355,170 265,170" fill="url(#blade-dark)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <rect x="240" y="115" width="32" height="60" rx="3" fill="url(#gold-grad)" stroke="#2a2333" stroke-width="4"/>
  </g>"""
    return wrap_svg(content)

def generate_padded_armor():
    content = """  <!-- PADDED ARMOR (100% Transparent Background) -->
  <g filter="url(#drop-shadow)">
    <!-- Main Quilted Tunic Body -->
    <path d="M 170,120 Q 256,135 342,120 L 390,190 L 350,225 L 330,200 L 330,420 Q 256,435 182,420 L 182,200 L 162,225 L 122,190 Z" fill="url(#cloth-grad)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <!-- Collar & Neck Trim -->
    <path d="M 210,120 C 220,150 292,150 302,120 L 256,155 Z" fill="url(#leather-grad)" stroke="#2a2333" stroke-width="4"/>
    <!-- Quilt Cross-Hatching Lines -->
    <path d="M 182,220 L 330,340 M 182,270 L 330,390 M 182,170 L 330,290 M 182,320 L 300,420" stroke="#241108" stroke-width="3" stroke-dasharray="6,4" opacity="0.6"/>
    <path d="M 330,220 L 182,340 M 330,270 L 182,390 M 330,170 L 182,290 M 330,320 L 212,420" stroke="#241108" stroke-width="3" stroke-dasharray="6,4" opacity="0.6"/>
    <!-- Center Placket & Brass Buttons -->
    <line x1="256" y1="155" x2="256" y2="425" stroke="#2a2333" stroke-width="4.5"/>
    <circle cx="256" cy="180" r="5" fill="url(#brass-grad)" stroke="#2a2333" stroke-width="2"/>
    <circle cx="256" cy="230" r="5" fill="url(#brass-grad)" stroke="#2a2333" stroke-width="2"/>
    <circle cx="256" cy="280" r="5" fill="url(#brass-grad)" stroke="#2a2333" stroke-width="2"/>
    <circle cx="256" cy="330" r="5" fill="url(#brass-grad)" stroke="#2a2333" stroke-width="2"/>
    <circle cx="256" cy="380" r="5" fill="url(#brass-grad)" stroke="#2a2333" stroke-width="2"/>
  </g>"""
    return wrap_svg(content)

def generate_leather_armor():
    content = """  <!-- LEATHER ARMOR (100% Transparent Background) -->
  <g filter="url(#drop-shadow)">
    <!-- Leather Vest Body -->
    <path d="M 175,115 Q 256,130 337,115 L 395,185 L 345,220 L 325,190 L 325,420 C 290,430 222,430 187,420 L 187,190 L 167,220 L 117,185 Z" fill="url(#leather-grad)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <!-- Padded Leather Pauldrons -->
    <path d="M 175,115 C 140,110 120,140 125,185 L 167,205 Z" fill="url(#leather-light)" stroke="#2a2333" stroke-width="4.5" stroke-linejoin="round"/>
    <path d="M 337,115 C 372,110 392,140 387,185 L 345,205 Z" fill="url(#leather-light)" stroke="#2a2333" stroke-width="4.5" stroke-linejoin="round"/>
    <!-- Double Chest Harness Straps with Buckles -->
    <path d="M 150,150 L 340,240" stroke="url(#leather-dark)" stroke-width="12" stroke-linecap="round"/>
    <path d="M 150,150 L 340,240" stroke="#2a2333" stroke-width="3" fill="none"/>
    <path d="M 340,150 L 150,240" stroke="url(#leather-dark)" stroke-width="12" stroke-linecap="round"/>
    <path d="M 340,150 L 150,240" stroke="#2a2333" stroke-width="3" fill="none"/>
    <rect x="238" y="180" width="36" height="26" rx="4" fill="url(#brass-grad)" stroke="#2a2333" stroke-width="4"/>
    <circle cx="256" cy="193" r="4" fill="#2a2333"/>
    <!-- Center Stitch Line & Waist Trim -->
    <line x1="256" y1="210" x2="256" y2="420" stroke="#f5b324" stroke-width="3.5" stroke-dasharray="8,5"/>
    <path d="M 187,360 Q 256,375 325,360" stroke="#2a2333" stroke-width="4.5" fill="none"/>
  </g>"""
    return wrap_svg(content)

def generate_studded_leather_armor():
    content = """  <!-- STUDDED LEATHER ARMOR (100% Transparent Background) -->
  <g filter="url(#drop-shadow)">
    <!-- Dark Studded Leather Body -->
    <path d="M 175,115 Q 256,130 337,115 L 395,185 L 345,220 L 325,190 L 325,425 Q 256,440 187,425 L 187,190 L 167,220 L 117,185 Z" fill="url(#leather-dark)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <!-- Reinforced Steel Collar & Shoulder Trim -->
    <path d="M 175,115 Q 256,145 337,115 L 330,145 Q 256,165 182,145 Z" fill="url(#steel-rim)" stroke="#2a2333" stroke-width="4"/>
    <path d="M 125,180 L 187,195 L 187,240 L 135,220 Z" fill="url(#steel-rim)" stroke="#2a2333" stroke-width="4"/>
    <path d="M 387,180 L 325,195 L 325,240 L 377,220 Z" fill="url(#steel-rim)" stroke="#2a2333" stroke-width="4"/>
    <!-- Grid of Brass Studs/Rivets -->
    <g fill="url(#brass-grad)" stroke="#2a2333" stroke-width="2">
      <circle cx="215" cy="180" r="5.5"/><circle cx="256" cy="180" r="5.5"/><circle cx="297" cy="180" r="5.5"/>
      <circle cx="200" cy="225" r="5.5"/><circle cx="237" cy="225" r="5.5"/><circle cx="275" cy="225" r="5.5"/><circle cx="312" cy="225" r="5.5"/>
      <circle cx="215" cy="270" r="5.5"/><circle cx="256" cy="270" r="5.5"/><circle cx="297" cy="270" r="5.5"/>
      <circle cx="200" cy="315" r="5.5"/><circle cx="237" cy="315" r="5.5"/><circle cx="275" cy="315" r="5.5"/><circle cx="312" cy="315" r="5.5"/>
      <circle cx="215" cy="360" r="5.5"/><circle cx="256" cy="360" r="5.5"/><circle cx="297" cy="360" r="5.5"/>
      <circle cx="237" cy="400" r="5.5"/><circle cx="275" cy="400" r="5.5"/>
    </g>
  </g>"""
    return wrap_svg(content)

def generate_hide_armor():
    content = """  <!-- HIDE ARMOR (100% Transparent Background) -->
  <g filter="url(#drop-shadow)">
    <!-- Jagged Raw Leather Body -->
    <path d="M 170,120 Q 256,135 342,120 L 390,180 L 350,225 L 325,195 L 330,410 L 300,435 L 270,415 L 240,440 L 210,415 L 182,430 L 187,195 L 162,225 L 122,180 Z" fill="url(#leather-grad)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <!-- Fur Mantle Collar -->
    <path d="M 155,120 C 130,90 200,60 256,90 C 312,60 382,90 357,120 C 390,155 350,195 325,170 C 300,200 212,200 187,170 C 162,195 122,155 155,120 Z" fill="url(#fur-grad)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <!-- Raw Horn Fastener Buttons -->
    <polygon points="215,160 235,145 225,175" fill="url(#horn-grad)" stroke="#2a2333" stroke-width="3"/>
    <polygon points="297,160 277,145 287,175" fill="url(#horn-grad)" stroke="#2a2333" stroke-width="3"/>
    <!-- Heavy Leather Cross-Stitches -->
    <path d="M 210,240 L 230,260 M 230,240 L 210,260" stroke="#f5b324" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M 282,240 L 302,260 M 302,240 L 282,260" stroke="#f5b324" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M 246,310 L 266,330 M 266,310 L 246,330" stroke="#f5b324" stroke-width="4.5" stroke-linecap="round"/>
  </g>"""
    return wrap_svg(content)

def generate_chain_shirt():
    content = """  <!-- CHAIN SHIRT (100% Transparent Background) -->
  <g filter="url(#drop-shadow)">
    <!-- Metallic Chainmail Shirt Body -->
    <path d="M 175,115 Q 256,130 337,115 L 405,185 L 355,235 L 325,195 L 325,415 Q 256,430 187,415 L 187,195 L 157,235 L 107,185 Z" fill="url(#blade-light)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <!-- Chain Ring Mesh Rows Pattern -->
    <g fill="none" stroke="#354457" stroke-width="3" opacity="0.65">
      <path d="M 140,165 Q 256,190 372,165 M 130,195 Q 256,220 382,195 M 187,225 Q 256,245 325,225 M 187,255 Q 256,275 325,255 M 187,285 Q 256,305 325,285 M 187,315 Q 256,335 325,315 M 187,345 Q 256,365 325,345 M 187,375 Q 256,395 325,375"/>
    </g>
    <!-- Leather Trim Edges -->
    <path d="M 175,115 Q 256,140 337,115 L 330,135 Q 256,155 182,135 Z" fill="url(#leather-grad)" stroke="#2a2333" stroke-width="4"/>
    <path d="M 187,400 Q 256,415 325,400 L 325,415 Q 256,430 187,415 Z" fill="url(#leather-grad)" stroke="#2a2333" stroke-width="4"/>
  </g>"""
    return wrap_svg(content)

def generate_scale_mail():
    content = """  <!-- SCALE MAIL (100% Transparent Background) -->
  <g filter="url(#drop-shadow)">
    <!-- Leather Backing Vest -->
    <path d="M 175,115 Q 256,130 337,115 L 395,185 L 345,220 L 325,190 L 325,425 Q 256,440 187,425 L 187,190 L 167,220 L 117,185 Z" fill="url(#leather-grad)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <!-- Overlapping Metallic Scale Rows -->
    <g stroke="#2a2333" stroke-width="3" stroke-linejoin="round">
      <path d="M 195,160 Q 210,180 225,160 M 225,160 Q 240,180 255,160 M 255,160 Q 270,180 285,160 M 285,160 Q 300,180 315,160" fill="url(#steel-rim)"/>
      <path d="M 185,200 Q 200,225 215,200 M 215,200 Q 230,225 245,200 M 245,200 Q 260,225 275,200 M 275,200 Q 290,225 305,200 M 305,200 Q 320,225 335,200" fill="url(#blade-light)"/>
      <path d="M 195,245 Q 210,270 225,245 M 225,245 Q 240,270 255,245 M 255,245 Q 270,270 285,245 M 285,245 Q 300,270 315,245" fill="url(#steel-rim)"/>
      <path d="M 185,290 Q 200,315 215,290 M 215,290 Q 230,315 245,290 M 245,290 Q 260,315 275,290 M 275,290 Q 290,315 305,290 M 305,290 Q 320,315 335,290" fill="url(#blade-light)"/>
      <path d="M 195,335 Q 210,360 225,335 M 225,335 Q 240,360 255,335 M 255,335 Q 270,360 285,335 M 285,335 Q 300,360 315,335" fill="url(#steel-rim)"/>
      <path d="M 205,380 Q 220,405 235,380 M 235,380 Q 250,405 265,380 M 265,380 Q 280,405 295,380 M 295,380 Q 310,405 325,380" fill="url(#blade-light)"/>
    </g>
  </g>"""
    return wrap_svg(content)

def generate_breastplate():
    content = """  <!-- BREASTPLATE (100% Transparent Background) -->
  <g filter="url(#drop-shadow)">
    <!-- Main Polished Steel Cuirass -->
    <path d="M 180,120 Q 256,135 332,120 C 375,160 355,250 340,310 C 320,390 290,430 256,440 C 222,430 192,390 172,310 C 157,250 137,160 180,120 Z" fill="url(#steel-rim)" stroke="#2a2333" stroke-width="5.5" stroke-linejoin="round"/>
    <path d="M 256,135 L 180,120 C 137,160 157,250 172,310 C 192,390 222,430 256,440 Z" fill="url(#blade-light)" opacity="0.6"/>
    <!-- Prominent Center Median Ridge -->
    <path d="M 256,135 L 256,440" stroke="#ffffff" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M 256,135 L 256,440" stroke="#2a2333" stroke-width="2" stroke-linecap="round"/>
    <!-- Gold / Brass Trim & Embellishments -->
    <path d="M 180,120 Q 256,145 332,120" stroke="url(#gold-grad)" stroke-width="7" fill="none"/>
    <path d="M 180,120 Q 256,145 332,120" stroke="#2a2333" stroke-width="3" fill="none"/>
    <path d="M 172,310 Q 256,335 340,310" stroke="url(#gold-grad)" stroke-width="6" fill="none"/>
    <!-- Shoulder Leather Straps -->
    <rect x="150" y="110" width="30" height="40" rx="3" fill="url(#leather-grad)" stroke="#2a2333" stroke-width="4" transform="rotate(-20 165 130)"/>
    <rect x="332" y="110" width="30" height="40" rx="3" fill="url(#leather-grad)" stroke="#2a2333" stroke-width="4" transform="rotate(20 347 130)"/>
    <circle cx="168" cy="135" r="4" fill="url(#brass-grad)"/>
    <circle cx="344" cy="135" r="4" fill="url(#brass-grad)"/>
  </g>"""
    return wrap_svg(content)

def generate_half_plate():
    content = """  <!-- HALF PLATE (100% Transparent Background) -->
  <g filter="url(#drop-shadow)">
    <!-- Under-garment Dark Leather Armor -->
    <path d="M 175,115 Q 256,130 337,115 L 395,185 L 345,220 L 325,190 L 325,430 Q 256,445 187,430 L 187,190 L 167,220 L 117,185 Z" fill="url(#leather-dark)" stroke="#2a2333" stroke-width="5"/>
    <!-- Heavy Layered Pauldrons (Shoulders) -->
    <path d="M 115,170 Q 140,110 190,120 L 180,210 L 130,215 Z" fill="url(#steel-rim)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <path d="M 397,170 Q 372,110 322,120 L 332,210 L 382,215 Z" fill="url(#steel-rim)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <!-- Steel Cuirass (Chestplate) -->
    <path d="M 190,135 Q 256,150 322,135 Q 340,240 325,320 Q 256,345 187,320 Q 172,240 190,135 Z" fill="url(#steel-rim)" stroke="#2a2333" stroke-width="5.5" stroke-linejoin="round"/>
    <path d="M 256,150 L 190,135 Q 172,240 187,320 Q 256,345 256,345 Z" fill="url(#blade-light)" opacity="0.5"/>
    <line x1="256" y1="150" x2="256" y2="340" stroke="#2a2333" stroke-width="3"/>
    <!-- Faulds / Tassets (Thigh Guard Plates) -->
    <path d="M 190,335 L 245,345 L 235,420 L 185,400 Z" fill="url(#steel-rim)" stroke="#2a2333" stroke-width="4.5" stroke-linejoin="round"/>
    <path d="M 322,335 L 267,345 L 277,420 L 327,400 Z" fill="url(#steel-rim)" stroke="#2a2333" stroke-width="4.5" stroke-linejoin="round"/>
    <!-- Brass Crest Medallion -->
    <circle cx="256" cy="235" r="16" fill="url(#gold-grad)" stroke="#2a2333" stroke-width="4"/>
    <polygon points="256,223 261,235 256,247 251,235" fill="#2a2333"/>
  </g>"""
    return wrap_svg(content)

def generate_ring_mail():
    content = """  <!-- RING MAIL (100% Transparent Background) -->
  <g filter="url(#drop-shadow)">
    <!-- Heavy Leather Tunic -->
    <path d="M 175,115 Q 256,130 337,115 L 405,185 L 355,235 L 325,195 L 325,425 Q 256,440 187,425 L 187,195 L 157,235 L 107,185 Z" fill="url(#leather-grad)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <!-- Large Sewn Metallic Rings -->
    <g fill="none" stroke="url(#steel-rim)" stroke-width="4.5" filter="drop-shadow(0px 2px 2px #2a2333)">
      <circle cx="215" cy="175" r="14"/><circle cx="256" cy="175" r="14"/><circle cx="297" cy="175" r="14"/>
      <circle cx="200" cy="220" r="14"/><circle cx="237" cy="220" r="14"/><circle cx="275" cy="220" r="14"/><circle cx="312" cy="220" r="14"/>
      <circle cx="215" cy="265" r="14"/><circle cx="256" cy="265" r="14"/><circle cx="297" cy="265" r="14"/>
      <circle cx="200" cy="310" r="14"/><circle cx="237" cy="310" r="14"/><circle cx="275" cy="310" r="14"/><circle cx="312" cy="310" r="14"/>
      <circle cx="215" cy="355" r="14"/><circle cx="256" cy="355" r="14"/><circle cx="297" cy="355" r="14"/>
      <circle cx="237" cy="395" r="14"/><circle cx="275" cy="395" r="14"/>
    </g>
    <!-- Heavy Belt & Buckle -->
    <path d="M 187,315 Q 256,330 325,315" stroke="url(#leather-dark)" stroke-width="14" fill="none"/>
    <rect x="238" y="307" width="36" height="26" rx="4" fill="url(#brass-grad)" stroke="#2a2333" stroke-width="4"/>
  </g>"""
    return wrap_svg(content)

def generate_chain_mail():
    content = """  <!-- CHAIN MAIL (100% Transparent Background) -->
  <g filter="url(#drop-shadow)">
    <!-- Full Heavy Chainmail Hauberk Body with Long Sleeves -->
    <path d="M 170,110 Q 256,125 342,110 L 435,175 L 375,250 L 325,200 L 325,435 Q 256,450 187,435 L 187,200 L 137,250 L 77,175 Z" fill="url(#blade-light)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>
    <!-- Interlocked Chain Ring Shading Overlay -->
    <g fill="none" stroke="#4e6278" stroke-width="3" opacity="0.6">
      <path d="M 110,165 Q 256,190 402,165 M 100,195 Q 256,220 412,195 M 187,225 Q 256,245 325,225 M 187,255 Q 256,275 325,255 M 187,285 Q 256,305 325,285 M 187,315 Q 256,335 325,315 M 187,345 Q 256,365 325,345 M 187,375 Q 256,395 325,375 M 187,405 Q 256,425 325,405"/>
    </g>
    <!-- Coif / Draped Mail Hood Collar -->
    <path d="M 195,110 C 210,160 302,160 317,110 C 340,150 172,150 195,110 Z" fill="url(#steel-rim)" stroke="#2a2333" stroke-width="4.5" stroke-linejoin="round"/>
    <!-- Heavy Waist Belt with Steel Buckle -->
    <path d="M 187,320 Q 256,335 325,320" stroke="url(#leather-grad)" stroke-width="14" fill="none"/>
    <rect x="238" y="312" width="36" height="26" rx="4" fill="url(#steel-rim)" stroke="#2a2333" stroke-width="4"/>
    <circle cx="256" cy="325" r="4" fill="#2a2333"/>
  </g>"""
    return wrap_svg(content)

def generate_splint_armor():
    content = """  <!-- SPLINT ARMOR (100% Transparent Background) -->
  <g filter="url(#drop-shadow)">
    <!-- Heavy Leather Foundation Tunic -->
    <path d="M 175,115 Q 256,130 337,115 L 395,185 L 345,220 L 325,190 L 325,430 Q 256,445 187,430 L 187,190 L 167,220 L 117,185 Z" fill="url(#leather-dark)" stroke="#2a2333" stroke-width="5"/>
    <!-- Vertical Steel Splint Slats (Torso) -->
    <g fill="url(#steel-rim)" stroke="#2a2333" stroke-width="4" stroke-linejoin="round">
      <rect x="192" y="160" width="20" height="250" rx="3"/>
      <rect x="218" y="165" width="20" height="250" rx="3"/>
      <rect x="246" y="170" width="20" height="250" rx="3"/>
      <rect x="274" y="165" width="20" height="250" rx="3"/>
      <rect x="300" y="160" width="20" height="250" rx="3"/>
    </g>
    <!-- Horizontal Cross-Straps & Rivets -->
    <path d="M 187,220 Q 256,235 325,220 M 187,320 Q 256,335 325,320" stroke="url(#leather-grad)" stroke-width="8" stroke-linecap="round"/>
    <g fill="url(#brass-grad)" stroke="#2a2333" stroke-width="1.5">
      <circle cx="202" cy="220" r="3.5"/><circle cx="228" cy="222" r="3.5"/><circle cx="256" cy="223" r="3.5"/><circle cx="284" cy="222" r="3.5"/><circle cx="310" cy="220" r="3.5"/>
      <circle cx="202" cy="320" r="3.5"/><circle cx="228" cy="322" r="3.5"/><circle cx="256" cy="323" r="3.5"/><circle cx="284" cy="322" r="3.5"/><circle cx="310" cy="320" r="3.5"/>
    </g>
    <!-- Steel Pauldrons -->
    <path d="M 120,180 L 185,190 L 175,130 Z" fill="url(#blade-light)" stroke="#2a2333" stroke-width="4.5" stroke-linejoin="round"/>
    <path d="M 392,180 L 327,190 L 337,130 Z" fill="url(#blade-light)" stroke="#2a2333" stroke-width="4.5" stroke-linejoin="round"/>
  </g>"""
    return wrap_svg(content)

def generate_plate_armor():
    content = """  <!-- FULL PLATE ARMOR (100% Transparent Background) -->
  <g filter="url(#drop-shadow)">
    <!-- Layered Massive Pauldrons (Shoulder Guards) -->
    <path d="M 105,170 C 130,95 200,105 210,140 L 190,230 L 120,230 Z" fill="url(#steel-rim)" stroke="#2a2333" stroke-width="5.5" stroke-linejoin="round"/>
    <path d="M 407,170 C 382,95 312,105 302,140 L 322,230 L 392,230 Z" fill="url(#steel-rim)" stroke="#2a2333" stroke-width="5.5" stroke-linejoin="round"/>
    <path d="M 115,190 L 195,195 L 185,240 L 125,235 Z" fill="url(#blade-light)" stroke="#2a2333" stroke-width="4.5"/>
    <path d="M 397,190 L 317,195 L 327,240 L 387,235 Z" fill="url(#blade-light)" stroke="#2a2333" stroke-width="4.5"/>

    <!-- Gorget / High Neck Collar -->
    <path d="M 195,115 C 220,145 292,145 317,115 L 302,150 C 275,170 237,170 210,150 Z" fill="url(#steel-rim)" stroke="#2a2333" stroke-width="5" stroke-linejoin="round"/>

    <!-- Main Knightly Breastplate -->
    <path d="M 190,145 Q 256,160 322,145 C 360,200 345,280 330,335 C 310,405 285,435 256,445 C 227,435 202,405 182,335 C 167,280 152,200 190,145 Z" fill="url(#steel-rim)" stroke="#2a2333" stroke-width="6" stroke-linejoin="round"/>
    <path d="M 256,160 L 190,145 C 152,200 167,280 182,335 C 202,405 227,435 256,445 Z" fill="url(#blade-light)" opacity="0.55"/>
    <line x1="256" y1="160" x2="256" y2="445" stroke="#ffffff" stroke-width="4.5"/>
    <line x1="256" y1="160" x2="256" y2="445" stroke="#2a2333" stroke-width="2.5"/>

    <!-- Gold Filigree & Knight Crest -->
    <path d="M 190,145 Q 256,170 322,145" stroke="url(#gold-grad)" stroke-width="7" fill="none"/>
    <path d="M 190,145 Q 256,170 322,145" stroke="#2a2333" stroke-width="3" fill="none"/>
    <g transform="translate(256, 240)">
      <polygon points="0,-25 22,0 0,25 -22,0" fill="url(#gold-grad)" stroke="#2a2333" stroke-width="4" stroke-linejoin="round"/>
      <circle cx="0" cy="0" r="8" fill="#9be2ff" stroke="#2a2333" stroke-width="2.5"/>
    </g>
    <!-- Flared Tassets / Belt Guard -->
    <path d="M 182,335 Q 256,355 330,335 L 340,365 Q 256,385 172,365 Z" fill="url(#gold-grad)" stroke="#2a2333" stroke-width="4.5" stroke-linejoin="round"/>
  </g>"""
    return wrap_svg(content)

# Map all items to their generator functions
ITEMS = {
    # Swords (6)
    "dagger": lambda: generate_sword("dagger", blade_top=130, blade_bot=280, blade_w=24, hilt_h=35, guard_type="swept", gem_color="#00e676"),
    "shortsword": lambda: generate_sword("shortsword", blade_top=90, blade_bot=300, blade_w=32, hilt_h=42, guard_type="straight"),
    "longsword": lambda: generate_sword("longsword", blade_top=40, blade_bot=300, blade_w=36, hilt_h=60, guard_type="swept"),
    "greatsword": lambda: generate_sword("greatsword", blade_top=30, blade_bot=275, blade_w=60, hilt_h=90, guard_type="winged", has_ricasso=True),
    "scimitar": generate_scimitar,
    "rapier": generate_rapier,

    # Axes & Polearms (5)
    "battleaxe": generate_battleaxe,
    "greataxe": generate_greataxe,
    "handaxe": generate_handaxe,
    "spear": generate_spear,
    "quarterstaff": generate_quarterstaff,

    # Bludgeoning & Heavy (2)
    "mace": generate_mace,
    "warhammer": generate_warhammer,

    # Ranged & Thrown (4)
    "javelin": generate_javelin,
    "shortbow": generate_shortbow,
    "longbow": generate_longbow,
    "light-crossbow": generate_light_crossbow,

    # Armor (13)
    "shield": generate_shield,
    "padded": generate_padded_armor,
    "leather": generate_leather_armor,
    "studded-leather": generate_studded_leather_armor,
    "hide": generate_hide_armor,
    "chain-shirt": generate_chain_shirt,
    "scale-mail": generate_scale_mail,
    "breastplate": generate_breastplate,
    "half-plate": generate_half_plate,
    "ring-mail": generate_ring_mail,
    "chain-mail": generate_chain_mail,
    "splint": generate_splint_armor,
    "plate": generate_plate_armor,

    # Consumables & Magic (4)
    "potion-healing": generate_potion_healing,
    "potion-greater-healing": generate_potion_greater_healing,
    "alchemists-fire": generate_alchemists_fire,
    "scroll": generate_scroll,
}

def main():
    print(f"Generating {len(ITEMS)} 100% transparent SVG items...")
    for item_id, gen_fn in ITEMS.items():
        svg_content = tighten(gen_fn(), item_id)
        out_path = os.path.join(SVG_DIR, f"{item_id}.svg")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(svg_content)
        print(f"  Wrote {item_id}.svg (100% Transparent)")

    print("\nNEXT: run `npm run svg-frame` to crop each viewBox to its drawing.")
    print("      Without it every icon keeps the full 512 canvas and a rapier")
    print("      uses 4% of it. See scripts/svg-item-frame.ts.")

    browser = find_browser()
    if not browser:
        print("\nNo Chromium found; skipping PNG previews (the SVGs are written).")
        return
    print("\nBatch rendering PNG previews...")
    for item_id in ITEMS.keys():
        svg_abs = os.path.join(SVG_DIR, f"{item_id}.svg")
        png_abs = os.path.join(PREVIEW_DIR, f"{item_id}.png")
        cmd = [
            # `--no-sandbox` because this also runs inside containers, where the
            # Chromium sandbox cannot start and the browser exits 1 on every file.
            browser, "--headless", "--disable-gpu", "--hide-scrollbars", "--no-sandbox",
            # `pathlib.as_uri()` rather than f"file:///{abs}": on POSIX the path
            # already begins with a slash, so the literal produced `file:////home/...`
            # and Chromium refused it.
            "--window-size=512,512", f"--screenshot={png_abs}", Path(svg_abs).as_uri(),
        ]
        # Not `check=True`: a preview that fails to render is a stale PNG, not
        # a failed generation. The claim above -- "the SVGs are the artefact" --
        # has to be true of the error path too.
        if subprocess.run(cmd).returncode == 0:
            print(f"  Rendered {item_id}.png")
        else:
            print(f"  (preview failed for {item_id}; SVG is written)")

if __name__ == "__main__":
    main()
