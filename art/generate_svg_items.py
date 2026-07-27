import os
import subprocess

# Output directories
SVG_DIR = os.path.abspath("art/svg-items")
PREVIEW_DIR = os.path.abspath("art/svg-items/preview")
os.makedirs(SVG_DIR, exist_ok=True)
os.makedirs(PREVIEW_DIR, exist_ok=True)

# Edge binary location for rendering PNG previews
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

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

# Map all 22 items to their generator functions
ITEMS = {
    # Swords (5)
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

    # Ranged & Thrown (3)
    "javelin": generate_javelin,
    "shortbow": generate_shortbow,
    "longbow": generate_longbow,
    "light-crossbow": generate_light_crossbow,

    # Armor & Magic (5)
    "shield": generate_shield,
    "potion-healing": generate_potion_healing,
    "potion-greater-healing": generate_potion_greater_healing,
    "alchemists-fire": generate_alchemists_fire,
    "scroll": generate_scroll,
}

def main():
    print(f"Generating {len(ITEMS)} 100% transparent SVG items...")
    for item_id, gen_fn in ITEMS.items():
        svg_content = gen_fn()
        out_path = os.path.join(SVG_DIR, f"{item_id}.svg")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(svg_content)
        print(f"  Wrote {item_id}.svg (100% Transparent)")

    print("\nBatch rendering PNG previews...")
    for item_id in ITEMS.keys():
        svg_abs = os.path.join(SVG_DIR, f"{item_id}.svg")
        png_abs = os.path.join(PREVIEW_DIR, f"{item_id}.png")
        cmd = [
            EDGE_PATH,
            "--headless",
            "--disable-gpu",
            "--hide-scrollbars",
            "--window-size=512,512",
            f"--screenshot={png_abs}",
            f"file:///{svg_abs}"
        ]
        subprocess.run(cmd, check=True)
        print(f"  Rendered {item_id}.png")

if __name__ == "__main__":
    main()
