import os
import subprocess

# Output directories
SVG_DIR = os.path.abspath("art/svg-terrain")
PREVIEW_DIR = os.path.abspath("art/svg-terrain/preview")
os.makedirs(SVG_DIR, exist_ok=True)
os.makedirs(PREVIEW_DIR, exist_ok=True)

# Edge binary location for rendering PNG previews
EDGE_PATH = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

COMMON_DEFS = """  <defs>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="4" flood-color="#120c1f" flood-opacity="0.5"/>
    </filter>
    <filter id="lava-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="#ff4500" flood-opacity="0.8"/>
      <feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="#ffeb3b" flood-opacity="0.9"/>
    </filter>
  </defs>
"""

def wrap_svg(content: str) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
{COMMON_DEFS}
  <g id="terrain-prop">
{content}
  </g>
</svg>"""

TERRAIN_SVGS = {}

# ==============================================================================
# SHEET 1: STONE (Ruined Masonry)
# ==============================================================================

TERRAIN_SVGS["terrain-wall-stone-a"] = wrap_svg("""
    <!-- Base Shadow -->
    <ellipse cx="256" cy="455" rx="190" ry="25" fill="#171324" opacity="0.6"/>

    <!-- Stone Wall Back Structure -->
    <path d="M 80,450 L 80,140 L 140,80 L 370,80 L 430,140 L 430,450 Z" fill="#474059" stroke="#1f1a29" stroke-width="9" stroke-linejoin="round"/>
    
    <!-- Top Face (Lit Stone) -->
    <polygon points="140,80 370,80 430,140 140,140" fill="#9e95ba" stroke="#1f1a29" stroke-width="8" stroke-linejoin="round"/>
    <polygon points="145,86 365,86 415,134 145,134" fill="#beb6d9"/>
    <line x1="140" y1="140" x2="430" y2="140" stroke="#1f1a29" stroke-width="8"/>

    <!-- Front Face (Masonry Block Courses) -->
    <path d="M 80,140 L 430,140 L 430,450 L 80,450 Z" fill="#69617d" stroke="#1f1a29" stroke-width="9" stroke-linejoin="round"/>

    <!-- Alternating Shaded Bricks -->
    <rect x="80" y="140" width="110" height="70" fill="#756c8c" stroke="#2a2338" stroke-width="5"/>
    <rect x="190" y="140" x2="330" width="140" height="70" fill="#5e5670" stroke="#2a2338" stroke-width="5"/>
    <rect x="330" y="140" width="100" height="70" fill="#756c8c" stroke="#2a2338" stroke-width="5"/>

    <rect x="80" y="210" width="160" height="80" fill="#5e5670" stroke="#2a2338" stroke-width="5"/>
    <rect x="240" y="210" width="190" height="80" fill="#756c8c" stroke="#2a2338" stroke-width="5"/>

    <rect x="80" y="290" width="120" height="80" fill="#756c8c" stroke="#2a2338" stroke-width="5"/>
    <rect x="200" y="290" width="150" height="80" fill="#5e5670" stroke="#2a2338" stroke-width="5"/>
    <rect x="350" y="290" width="80" height="80" fill="#756c8c" stroke="#2a2338" stroke-width="5"/>

    <rect x="80" y="370" width="170" height="80" fill="#5e5670" stroke="#2a2338" stroke-width="5"/>
    <rect x="250" y="370" width="180" height="80" fill="#756c8c" stroke="#2a2338" stroke-width="5"/>

    <!-- Stone Cracks & Highlights -->
    <path d="M 120,180 L 140,230 L 130,260" stroke="#221b2e" stroke-width="4" fill="none"/>
    <path d="M 310,320 L 330,360 L 320,400" stroke="#221b2e" stroke-width="4" fill="none"/>

    <!-- Crumbled Corner Detail (Top Left) -->
    <polygon points="80,140 130,140 100,180 80,165" fill="#322b40" stroke="#1f1a29" stroke-width="5"/>
""")

TERRAIN_SVGS["terrain-wall-stone-b"] = wrap_svg("""
    <!-- Base Shadow -->
    <ellipse cx="256" cy="455" rx="195" ry="25" fill="#171324" opacity="0.6"/>

    <!-- Tumbled Stone Wall Structure -->
    <path d="M 70,450 L 70,100 L 170,80 L 250,180 L 440,330 L 440,450 Z" fill="#474059" stroke="#1f1a29" stroke-width="9" stroke-linejoin="round"/>
    
    <!-- Top Face (Lit) -->
    <polygon points="70,100 170,80 250,180 180,200" fill="#9e95ba" stroke="#1f1a29" stroke-width="8" stroke-linejoin="round"/>
    <polygon points="250,180 440,330 380,360 180,200" fill="#847a9e" stroke="#1f1a29" stroke-width="8" stroke-linejoin="round"/>

    <!-- Front Face -->
    <path d="M 70,100 L 180,200 L 380,360 L 440,360 L 440,450 L 70,450 Z" fill="#69617d" stroke="#1f1a29" stroke-width="9" stroke-linejoin="round"/>

    <!-- Brick Shading Lines -->
    <line x1="70" y1="210" x2="200" y2="210" stroke="#2a2338" stroke-width="6"/>
    <line x1="70" y1="290" x2="300" y2="290" stroke="#2a2338" stroke-width="6"/>
    <line x1="70" y1="370" x2="440" y2="370" stroke="#2a2338" stroke-width="6"/>

    <line x1="160" y1="120" x2="160" y2="210" stroke="#2a2338" stroke-width="5"/>
    <line x1="120" y1="210" x2="120" y2="290" stroke="#2a2338" stroke-width="5"/>
    <line x1="220" y1="210" x2="220" y2="290" stroke="#2a2338" stroke-width="5"/>
    <line x1="170" y1="290" x2="170" y2="370" stroke="#2a2338" stroke-width="5"/>
    <line x1="290" y1="370" x2="290" y2="450" stroke="#2a2338" stroke-width="5"/>

    <!-- Fallen Rocks at Base -->
    <polygon points="360,450 360,410 410,410 410,450" fill="#69617d" stroke="#1f1a29" stroke-width="5"/>
    <polygon points="360,410 410,410 420,400 370,400" fill="#9e95ba" stroke="#1f1a29" stroke-width="5"/>
    <polygon points="415,450 415,425 455,425 455,450" fill="#544d66" stroke="#1f1a29" stroke-width="5"/>
    <polygon points="415,425 455,425 462,418 422,418" fill="#847a9e" stroke="#1f1a29" stroke-width="5"/>
""")

TERRAIN_SVGS["terrain-cover-stone-a"] = wrap_svg("""
    <!-- Base Shadow -->
    <ellipse cx="256" cy="455" rx="210" ry="22" fill="#171324" opacity="0.6"/>

    <!-- Low Stone Barricade (Chest High: y=230 to 450) -->
    <!-- Top Face (Broad & Lit) -->
    <polygon points="40,290 90,230 420,230 470,290" fill="#9e95ba" stroke="#1f1a29" stroke-width="8" stroke-linejoin="round"/>
    <polygon points="98,238 412,238 456,282 54,282" fill="#beb6d9"/>

    <!-- Front Face -->
    <rect x="40" y="290" width="430" height="160" rx="4" fill="#69617d" stroke="#1f1a29" stroke-width="8"/>

    <!-- Alternating Bricks -->
    <rect x="40" y="290" width="130" height="80" fill="#756c8c" stroke="#2a2338" stroke-width="5"/>
    <rect x="170" y="290" width="150" height="80" fill="#5e5670" stroke="#2a2338" stroke-width="5"/>
    <rect x="320" y="290" width="150" height="80" fill="#756c8c" stroke="#2a2338" stroke-width="5"/>

    <rect x="40" y="370" width="190" height="80" fill="#5e5670" stroke="#2a2338" stroke-width="5"/>
    <rect x="230" y="370" width="140" height="80" fill="#756c8c" stroke="#2a2338" stroke-width="5"/>
    <rect x="370" y="370" width="100" height="80" fill="#5e5670" stroke="#2a2338" stroke-width="5"/>

    <!-- Rubble Foot -->
    <path d="M 60,450 Q 80,425 100,450 Z" fill="#474059" stroke="#1f1a29" stroke-width="4"/>
    <path d="M 390,450 Q 415,420 440,450 Z" fill="#474059" stroke="#1f1a29" stroke-width="4"/>
""")

TERRAIN_SVGS["terrain-cover-stone-b"] = wrap_svg("""
    <!-- Base Shadow -->
    <ellipse cx="256" cy="455" rx="210" ry="22" fill="#171324" opacity="0.6"/>

    <!-- Low Tumbled Barricade -->
    <!-- Top Face -->
    <polygon points="40,290 90,230 250,230 280,290" fill="#9e95ba" stroke="#1f1a29" stroke-width="8" stroke-linejoin="round"/>
    <polygon points="280,290 250,230 330,330 360,370" fill="#847a9e" stroke="#1f1a29" stroke-width="8" stroke-linejoin="round"/>
    <polygon points="360,370 330,330 420,330 460,370" fill="#9e95ba" stroke="#1f1a29" stroke-width="8" stroke-linejoin="round"/>

    <!-- Front Face -->
    <path d="M 40,290 L 280,290 L 360,370 L 460,370 L 460,450 L 40,450 Z" fill="#69617d" stroke="#1f1a29" stroke-width="8" stroke-linejoin="round"/>

    <line x1="40" y1="370" x2="360" y2="370" stroke="#2a2338" stroke-width="6"/>
    <line x1="140" y1="290" x2="140" y2="370" stroke="#2a2338" stroke-width="5"/>
    <line x1="250" y1="370" x2="250" y2="450" stroke="#2a2338" stroke-width="5"/>

    <!-- Fallen Rubble Blocks -->
    <polygon points="290,450 310,410 340,450" fill="#544d66" stroke="#1f1a29" stroke-width="5"/>
    <polygon points="340,450 360,425 390,450" fill="#69617d" stroke="#1f1a29" stroke-width="5"/>
""")

# ==============================================================================
# SHEET 2: FOREST (Undergrowth)
# ==============================================================================

TERRAIN_SVGS["terrain-wall-forest-a"] = wrap_svg("""
    <!-- Base Shadow -->
    <ellipse cx="256" cy="450" rx="170" ry="25" fill="#101c0c" opacity="0.6"/>

    <!-- Trunk Base -->
    <rect x="220" y="380" width="72" height="70" rx="10" fill="#3d2616" stroke="#1c1109" stroke-width="8"/>

    <!-- Organic Scalloped Shrub Foliage -->
    <!-- Base Shadow Canopy -->
    <path d="M 120,380 C 40,320 40,180 110,120 C 180,50 330,50 400,120 C 470,180 470,320 390,380 C 310,430 180,430 120,380 Z" fill="#203310" stroke="#101b08" stroke-width="9" stroke-linejoin="round"/>

    <!-- Mid Canopy Leaf Mass -->
    <path d="M 100,320 Q 70,250 110,190 Q 150,130 220,110 Q 300,90 370,130 Q 430,180 420,260 Q 410,340 330,370 Q 230,390 150,360 Z" fill="#36541b" stroke="#101b08" stroke-width="7"/>

    <!-- Lit Upper Leaf Clusters -->
    <path d="M 140,210 C 130,150 190,100 250,110 C 310,120 370,140 350,210 C 310,240 200,250 140,210 Z" fill="#588527" stroke="#101b08" stroke-width="6"/>
    <path d="M 180,160 C 170,110 240,80 290,110 C 320,130 300,180 250,180 Z" fill="#75ab32"/>
""")

TERRAIN_SVGS["terrain-wall-forest-b"] = wrap_svg("""
    <!-- Base Shadow -->
    <ellipse cx="256" cy="450" rx="175" ry="25" fill="#101c0c" opacity="0.6"/>

    <!-- Trunk Base -->
    <rect x="210" y="380" width="80" height="70" rx="10" fill="#3d2616" stroke="#1c1109" stroke-width="8"/>

    <!-- Protruding Broken Branch (Right) -->
    <path d="M 280,240 L 430,130 L 450,145 L 300,270 Z" fill="#523520" stroke="#1c1109" stroke-width="6"/>

    <!-- Lopsided Bush Foliage -->
    <path d="M 100,380 C 40,320 50,180 120,120 C 180,60 290,60 340,120 C 420,160 440,280 390,360 C 330,430 160,430 100,380 Z" fill="#203310" stroke="#101b08" stroke-width="9" stroke-linejoin="round"/>

    <path d="M 110,310 Q 80,230 130,170 Q 180,110 270,130 Q 370,150 380,250 Q 360,350 250,370 Z" fill="#36541b" stroke="#101b08" stroke-width="7"/>

    <!-- Lighter Yellow-Green Cluster on Left -->
    <circle cx="150" cy="170" r="65" fill="#85b82e" stroke="#101b08" stroke-width="6"/>
    <circle cx="230" cy="140" r="55" fill="#699e26" stroke="#101b08" stroke-width="6"/>
""")

TERRAIN_SVGS["terrain-cover-forest-a"] = wrap_svg("""
    <!-- Base Shadow -->
    <ellipse cx="256" cy="455" rx="215" ry="20" fill="#101c0c" opacity="0.6"/>

    <!-- Low Fallen Log (y=240 to 440) -->
    <!-- Log Main Body -->
    <rect x="50" y="270" width="410" height="170" rx="35" fill="#4d331c" stroke="#1c1109" stroke-width="8"/>

    <!-- Bark Texture Lines -->
    <line x1="90" y1="320" x2="380" y2="320" stroke="#311f10" stroke-width="7" stroke-dasharray="25 12"/>
    <line x1="70" y1="370" x2="360" y2="370" stroke="#311f10" stroke-width="7" stroke-dasharray="35 15"/>
    <line x1="100" y1="410" x2="390" y2="410" stroke="#311f10" stroke-width="7" stroke-dasharray="20 10"/>

    <!-- Mossy Top Lit Surface -->
    <path d="M 50,300 C 150,240 350,240 460,300 L 460,270 C 350,230 150,230 50,270 Z" fill="#5f8c2b" stroke="#1c1109" stroke-width="6"/>

    <!-- Sawn Log End (Right Side) -->
    <ellipse cx="430" cy="355" rx="30" ry="70" fill="#8c633a" stroke="#1c1109" stroke-width="7"/>
    <ellipse cx="430" cy="355" rx="20" ry="48" fill="none" stroke="#5c3f21" stroke-width="4"/>
    <ellipse cx="430" cy="355" rx="10" ry="24" fill="none" stroke="#5c3f21" stroke-width="4"/>
""")

TERRAIN_SVGS["terrain-cover-forest-b"] = wrap_svg("""
    <!-- Base Shadow -->
    <ellipse cx="256" cy="455" rx="215" ry="20" fill="#101c0c" opacity="0.6"/>

    <!-- Low Bramble & Deadfall Thicket (y=240 to 450) -->
    <rect x="60" y="340" width="390" height="90" rx="20" fill="#4a311b" stroke="#1c1109" stroke-width="7"/>
    <rect x="90" y="280" width="330" height="80" rx="18" fill="#5c3d22" stroke="#1c1109" stroke-width="7"/>

    <!-- Bristling Twigs -->
    <path d="M 70,280 L 50,210 M 120,280 L 110,200 M 200,280 L 210,190 M 280,280 L 270,195 M 360,280 L 380,205 M 430,280 L 450,220" stroke="#2b1a0d" stroke-width="7" stroke-linecap="round"/>
    
    <!-- Mossy Top Edges -->
    <circle cx="150" cy="270" r="30" fill="#577827" stroke="#1c1109" stroke-width="5"/>
    <circle cx="310" cy="265" r="35" fill="#688c30" stroke="#1c1109" stroke-width="5"/>
""")

# ==============================================================================
# SHEET 3: GRAVEYARD (Memorial Stone)
# ==============================================================================

TERRAIN_SVGS["terrain-wall-graveyard-a"] = wrap_svg("""
    <!-- Base Shadow -->
    <ellipse cx="256" cy="455" rx="170" ry="24" fill="#12131a" opacity="0.6"/>

    <!-- Tall Standing Tomb Marker (Tilted 4deg, y=50 to 450) -->
    <g transform="rotate(-4 256 450)">
      <!-- Back Slab Shadow -->
      <path d="M 120,450 L 120,130 C 120,70 360,70 360,130 L 360,450 Z" fill="#363942" stroke="#1b1c21" stroke-width="9" stroke-linejoin="round"/>

      <!-- Lit Top Rim -->
      <path d="M 120,130 C 120,70 360,70 360,130 L 340,145 C 340,90 140,90 140,145 Z" fill="#9fa6b5"/>

      <!-- Front Face -->
      <path d="M 140,145 C 140,90 340,90 340,145 L 340,450 L 140,450 Z" fill="#575a66" stroke="#1b1c21" stroke-width="9" stroke-linejoin="round"/>

      <!-- Carved Inscription Relief Cross -->
      <rect x="225" y="190" width="30" height="110" fill="#363942" stroke="#25262c" stroke-width="3"/>
      <rect x="185" y="220" width="110" height="30" fill="#363942" stroke="#25262c" stroke-width="3"/>

      <!-- Lichen Base Patches -->
      <path d="M 140,410 Q 180,380 220,450 Z" fill="#475e3e"/>
      <path d="M 280,450 Q 310,400 340,430 Z" fill="#475e3e"/>
    </g>
""")

TERRAIN_SVGS["terrain-wall-graveyard-b"] = wrap_svg("""
    <!-- Base Shadow -->
    <ellipse cx="256" cy="455" rx="160" ry="24" fill="#12131a" opacity="0.6"/>

    <!-- Cracked Obelisk Spire -->
    <polygon points="256,40 170,140 340,140" fill="#797f8c" stroke="#1b1c21" stroke-width="9" stroke-linejoin="round"/>
    <polygon points="256,40 170,140 256,140" fill="#a4aac7"/>

    <polygon points="170,140 340,140 360,450 150,450" fill="#474a54" stroke="#1b1c21" stroke-width="9" stroke-linejoin="round"/>
    <polygon points="170,140 256,140 256,450 150,450" fill="#5d6270"/>

    <!-- Vertical Split Crack -->
    <path d="M 256,140 L 240,230 L 270,310 L 250,450" stroke="#1b1c21" stroke-width="7" fill="none"/>

    <!-- Missing Shoulder Chunk -->
    <polygon points="340,140 310,180 345,210" fill="#2a2c33" stroke="#1b1c21" stroke-width="5"/>
""")

TERRAIN_SVGS["terrain-cover-graveyard-a"] = wrap_svg("""
    <!-- Base Shadow -->
    <ellipse cx="256" cy="455" rx="210" ry="22" fill="#12131a" opacity="0.6"/>

    <!-- Low Stone Sarcophagus (y=230 to 450) -->
    <!-- Base Box -->
    <rect x="60" y="300" width="390" height="150" fill="#474a54" stroke="#1b1c21" stroke-width="8"/>
    <rect x="90" y="330" width="330" height="90" fill="#363840" stroke="#1b1c21" stroke-width="5"/>

    <!-- Pushed Aside Heavy Lid (Lit Top Surface) -->
    <polygon points="40,290 90,230 440,230 470,290" fill="#797f8c" stroke="#1b1c21" stroke-width="8" stroke-linejoin="round"/>
    <polygon points="90,230 440,230 455,275 75,275" fill="#a4aac7"/>

    <!-- Dark Interior Gap -->
    <rect x="70" y="290" width="370" height="15" fill="#121317"/>
""")

TERRAIN_SVGS["terrain-cover-graveyard-b"] = wrap_svg("""
    <!-- Base Shadow -->
    <ellipse cx="256" cy="455" rx="215" ry="20" fill="#12131a" opacity="0.6"/>

    <!-- Low Iron Railing on Stone Kerb (y=210 to 450) -->
    <!-- Stone Kerb Base -->
    <polygon points="40,390 80,350 430,350 470,390" fill="#797f8c" stroke="#1b1c21" stroke-width="7" stroke-linejoin="round"/>
    <rect x="40" y="390" width="430" height="60" fill="#474a54" stroke="#1b1c21" stroke-width="7"/>

    <!-- Iron Posts -->
    <rect x="60" y="210" width="20" height="140" fill="#24262c" stroke="#121317" stroke-width="4"/>
    <rect x="430" y="210" width="20" height="140" fill="#24262c" stroke="#121317" stroke-width="4"/>
    <rect x="60" y="230" width="390" height="16" fill="#3a3d47" stroke="#121317" stroke-width="4"/>

    <!-- Pickets -->
    <path d="M 120,350 L 120,220 L 125,200 L 130,220 L 130,350 Z" fill="#24262c" stroke="#121317" stroke-width="3"/>
    <path d="M 180,350 L 180,220 L 185,200 L 190,220 L 190,350 Z" fill="#24262c" stroke="#121317" stroke-width="3"/>
    <path d="M 240,350 L 240,220 L 245,200 L 250,220 L 250,350 Z" fill="#24262c" stroke="#121317" stroke-width="3"/>
    <path d="M 300,350 L 300,220 L 305,200 L 310,220 L 310,350 Z" fill="#24262c" stroke="#121317" stroke-width="3"/>
    <path d="M 360,350 L 360,220 L 365,200 L 370,220 L 370,350 Z" fill="#24262c" stroke="#121317" stroke-width="3"/>
""")

# ==============================================================================
# SHEET 4: EMBER (Volcanic Rock)
# ==============================================================================

TERRAIN_SVGS["terrain-wall-ember-a"] = wrap_svg("""
    <!-- Base Shadow -->
    <ellipse cx="256" cy="455" rx="175" ry="24" fill="#140a08" opacity="0.7"/>

    <!-- Jagged Basalt Spire (y=40 to 450) -->
    <polygon points="256,40 120,160 80,450 430,450 380,180" fill="#262329" stroke="#121014" stroke-width="9" stroke-linejoin="round"/>
    
    <polygon points="256,40 120,160 210,450 80,450" fill="#1c191f" stroke="#121014" stroke-width="6"/>
    <polygon points="256,40 210,450 340,450 380,180" fill="#3b353d" stroke="#121014" stroke-width="6"/>

    <!-- Glowing Molten Orange Lava Fissure with Glow Filter -->
    <g filter="url(#lava-glow)">
      <path d="M 256,80 L 230,170 L 270,260 L 240,360 L 260,450" stroke="#ff4500" stroke-width="12" fill="none" stroke-linecap="round"/>
      <path d="M 256,80 L 230,170 L 270,260 L 240,360 L 260,450" stroke="#ffeb3b" stroke-width="5" fill="none" stroke-linecap="round"/>
    </g>
""")

TERRAIN_SVGS["terrain-wall-ember-b"] = wrap_svg("""
    <!-- Base Shadow -->
    <ellipse cx="256" cy="455" rx="185" ry="24" fill="#140a08" opacity="0.7"/>

    <!-- Cooled Lava Chunk with Basalt Facets & Glow Base -->
    <path d="M 90,450 L 80,160 L 150,80 L 360,80 L 430,160 L 420,450 Z" fill="#29252a" stroke="#121014" stroke-width="9" stroke-linejoin="round"/>

    <!-- Ash Crusted Top Surface -->
    <polygon points="150,80 360,80 430,160 80,160" fill="#9c959c" stroke="#121014" stroke-width="8" stroke-linejoin="round"/>
    <polygon points="160,88 350,88 410,152 95,152" fill="#c7c1c7"/>

    <!-- Rock Facet Shading Lines -->
    <line x1="160" y1="160" x2="190" y2="450" stroke="#19171a" stroke-width="6"/>
    <line x1="310" y1="160" x2="330" y2="450" stroke="#19171a" stroke-width="6"/>

    <!-- Glowing Base Seam -->
    <g filter="url(#lava-glow)">
      <path d="M 90,450 Q 256,410 420,450 Z" fill="#ff4500"/>
    </g>
""")

TERRAIN_SVGS["terrain-cover-ember-a"] = wrap_svg("""
    <!-- Base Shadow -->
    <ellipse cx="256" cy="455" rx="210" ry="22" fill="#140a08" opacity="0.7"/>

    <!-- Low Ridge of Hardened Lava (y=230 to 450) -->
    <!-- Top Face -->
    <polygon points="40,290 90,230 420,230 470,290" fill="#3d373f" stroke="#121014" stroke-width="8" stroke-linejoin="round"/>

    <!-- Glowing Seams -->
    <g filter="url(#lava-glow)">
      <path d="M 90,250 L 180,270 L 260,240 L 370,280" stroke="#ff4500" stroke-width="8" fill="none"/>
      <path d="M 90,250 L 180,270 L 260,240 L 370,280" stroke="#ffeb3b" stroke-width="3" fill="none"/>
    </g>

    <!-- Front Face -->
    <rect x="40" y="290" width="430" height="160" rx="6" fill="#29252a" stroke="#121014" stroke-width="8"/>
    
    <!-- Base Glow -->
    <g filter="url(#lava-glow)">
      <line x1="40" y1="445" x2="470" y2="445" stroke="#ff4500" stroke-width="10"/>
    </g>
""")

TERRAIN_SVGS["terrain-cover-ember-b"] = wrap_svg("""
    <!-- Base Shadow -->
    <ellipse cx="256" cy="455" rx="210" ry="22" fill="#140a08" opacity="0.7"/>

    <!-- Low Blackened Iron Barricade -->
    <polygon points="50,280 80,220 430,220 460,280" fill="#423e47" stroke="#121014" stroke-width="8" stroke-linejoin="round"/>
    <polygon points="80,220 430,220 445,270 65,270" fill="#615b69"/>

    <rect x="50" y="280" width="410" height="170" fill="#2d2930" stroke="#121014" stroke-width="8"/>
    
    <!-- Rivets -->
    <circle cx="80" cy="310" r="6" fill="#121014"/>
    <circle cx="430" cy="310" r="6" fill="#121014"/>

    <!-- Base Glow -->
    <g filter="url(#lava-glow)">
      <rect x="50" y="440" width="410" height="10" fill="#ffeb3b"/>
    </g>
""")

# ==============================================================================
# SHEET 5: VILLAGE (Market Square)
# ==============================================================================

TERRAIN_SVGS["terrain-wall-village-a"] = wrap_svg("""
    <!-- Base Shadow -->
    <ellipse cx="256" cy="455" rx="195" ry="24" fill="#17120e" opacity="0.6"/>

    <!-- Wooden Counter Base with Plank Lines & Shading -->
    <rect x="70" y="260" width="372" height="190" fill="#5c3d22" stroke="#211308" stroke-width="8"/>
    <!-- Vertical Wooden Planks -->
    <line x1="160" y1="260" x2="160" y2="450" stroke="#3b2413" stroke-width="5"/>
    <line x1="256" y1="260" x2="256" y2="450" stroke="#3b2413" stroke-width="5"/>
    <line x1="350" y1="260" x2="350" y2="450" stroke="#3b2413" stroke-width="5"/>

    <!-- Peaked Striped Canvas Awning -->
    <polygon points="256,50 40,170 472,170" fill="#3b2413"/>

    <!-- Striped Segments -->
    <polygon points="256,50 40,170 110,240 256,110" fill="#ab3c2e" stroke="#211308" stroke-width="6"/>
    <polygon points="256,50 110,240 180,240 256,110" fill="#e3d8c3" stroke="#211308" stroke-width="6"/>
    <polygon points="256,50 180,240 256,240 256,110" fill="#ab3c2e" stroke="#211308" stroke-width="6"/>
    <polygon points="256,50 256,240 330,240 256,110" fill="#e3d8c3" stroke="#211308" stroke-width="6"/>
    <polygon points="256,50 330,240 400,240 256,110" fill="#ab3c2e" stroke="#211308" stroke-width="6"/>
    <polygon points="256,50 400,240 472,170 256,110" fill="#e3d8c3" stroke="#211308" stroke-width="6"/>
""")

TERRAIN_SVGS["terrain-wall-village-b"] = wrap_svg("""
    <!-- Base Shadow -->
    <ellipse cx="256" cy="455" rx="190" ry="24" fill="#17120e" opacity="0.6"/>

    <!-- Bottom Left Crate -->
    <rect x="60" y="270" width="190" height="180" fill="#7a522f" stroke="#211308" stroke-width="8"/>
    <line x1="60" y1="270" x2="250" y2="450" stroke="#211308" stroke-width="5"/>
    <line x1="250" y1="270" x2="60" y2="450" stroke="#211308" stroke-width="5"/>

    <!-- Bottom Right Crate -->
    <rect x="250" y="250" width="200" height="200" fill="#694424" stroke="#211308" stroke-width="8"/>
    <line x1="250" y1="250" x2="450" y2="450" stroke="#211308" stroke-width="5"/>
    <line x1="450" y1="250" x2="250" y2="450" stroke="#211308" stroke-width="5"/>

    <!-- Top Barrel -->
    <ellipse cx="340" cy="110" rx="60" ry="20" fill="#8a5e38" stroke="#211308" stroke-width="6"/>
    <rect x="280" y="110" width="120" height="140" fill="#5c3d22" stroke="#211308" stroke-width="7"/>
    <line x1="280" y1="140" x2="400" y2="140" stroke="#3a3d42" stroke-width="6"/>
    <line x1="280" y1="210" x2="400" y2="210" stroke="#3a3d42" stroke-width="6"/>

    <!-- Rope Tied Around Stack -->
    <path d="M 60,360 Q 250,340 450,360" fill="none" stroke="#c7a76d" stroke-width="7"/>
""")

TERRAIN_SVGS["terrain-cover-village-a"] = wrap_svg("""
    <!-- Base Shadow -->
    <ellipse cx="256" cy="455" rx="210" ry="20" fill="#17120e" opacity="0.6"/>

    <!-- Low Overturned Handcart -->
    <polygon points="50,280 90,230 420,230 460,280" fill="#8a5e38" stroke="#211308" stroke-width="8" stroke-linejoin="round"/>
    <polygon points="90,230 420,230 440,270 70,270" fill="#a87447"/>

    <rect x="50" y="280" width="410" height="170" fill="#694424" stroke="#211308" stroke-width="8"/>
    <line x1="150" y1="280" x2="150" y2="450" stroke="#211308" stroke-width="5"/>
    <line x1="250" y1="280" x2="250" y2="450" stroke="#211308" stroke-width="5"/>
    <line x1="350" y1="280" x2="350" y2="450" stroke="#211308" stroke-width="5"/>

    <!-- Spoked Wheel -->
    <circle cx="100" cy="380" r="55" fill="#4d3119" stroke="#211308" stroke-width="8"/>
    <circle cx="100" cy="380" r="15" fill="#8a5e38" stroke="#211308" stroke-width="5"/>
    <line x1="100" y1="325" x2="100" y2="435" stroke="#211308" stroke-width="5"/>
    <line x1="45" y1="380" x2="155" y2="380" stroke="#211308" stroke-width="5"/>
""")

TERRAIN_SVGS["terrain-cover-village-b"] = wrap_svg("""
    <!-- Base Shadow -->
    <ellipse cx="256" cy="455" rx="215" ry="20" fill="#17120e" opacity="0.6"/>

    <!-- Fence Railing & Water Trough -->
    <rect x="60" y="240" width="30" height="210" fill="#5c3d22" stroke="#211308" stroke-width="6"/>
    <rect x="240" y="240" width="30" height="210" fill="#5c3d22" stroke="#211308" stroke-width="6"/>

    <polygon points="50,250 80,220 270,220 300,250" fill="#8a5e38" stroke="#211308" stroke-width="7" stroke-linejoin="round"/>
    <rect x="50" y="250" width="250" height="25" fill="#694424" stroke="#211308" stroke-width="6"/>

    <!-- Stone Trough -->
    <polygon points="280,330 310,290 440,290 470,330" fill="#757a85" stroke="#1d1e24" stroke-width="7" stroke-linejoin="round"/>
    <rect x="280" y="330" width="190" height="120" fill="#4d5159" stroke="#1d1e24" stroke-width="7"/>
    <polygon points="310,295 440,295 450,325 300,325" fill="#3b82a6"/>
""")

# ==============================================================================
# SHEET 6: BOG (Wet Ground)
# ==============================================================================

TERRAIN_SVGS["terrain-wall-bog-a"] = wrap_svg("""
    <!-- Base Shadow -->
    <ellipse cx="256" cy="455" rx="185" ry="24" fill="#091410" opacity="0.7"/>

    <!-- Mossy Hummock Wall -->
    <path d="M 80,450 C 50,320 80,180 160,110 C 230,50 330,60 380,140 C 450,220 460,350 430,450 Z" fill="#241e17" stroke="#100d0a" stroke-width="9" stroke-linejoin="round"/>

    <!-- Lush Green Moss Top Curve -->
    <path d="M 100,320 C 80,200 150,110 240,80 C 330,60 390,130 410,250 Z" fill="#4d692b" stroke="#100d0a" stroke-width="7"/>
    <path d="M 140,180 C 180,100 280,80 340,120 Z" fill="#73993d"/>

    <!-- Reeds -->
    <path d="M 220,100 L 200,20 M 240,90 L 240,10 M 260,90 L 280,25 M 280,100 L 310,35" stroke="#8fa843" stroke-width="6" stroke-linecap="round"/>
""")

TERRAIN_SVGS["terrain-wall-bog-b"] = wrap_svg("""
    <!-- Base Shadow -->
    <ellipse cx="256" cy="455" rx="180" ry="24" fill="#091410" opacity="0.7"/>

    <!-- Waterlogged Tree Stump -->
    <path d="M 80,450 Q 150,380 180,450 Q 256,400 330,450 Q 370,380 430,450 Z" fill="#1c1a17" stroke="#0a0a09" stroke-width="9"/>

    <path d="M 140,450 L 120,160 L 370,160 L 360,450 Z" fill="#292622" stroke="#0a0a09" stroke-width="9" stroke-linejoin="round"/>

    <!-- Hollow Top -->
    <ellipse cx="245" cy="160" rx="125" ry="35" fill="#141311" stroke="#0a0a09" stroke-width="8"/>
    <ellipse cx="245" cy="160" rx="80" ry="20" fill="#000000"/>

    <!-- Shelf Mushrooms -->
    <path d="M 360,260 C 420,250 430,280 360,290 Z" fill="#d9c49c" stroke="#0a0a09" stroke-width="5"/>
    <path d="M 355,310 C 410,300 420,330 355,340 Z" fill="#d9c49c" stroke="#0a0a09" stroke-width="5"/>
""")

TERRAIN_SVGS["terrain-cover-bog-a"] = wrap_svg("""
    <!-- Base Shadow -->
    <ellipse cx="256" cy="455" rx="210" ry="20" fill="#091410" opacity="0.7"/>

    <!-- Low Peat & Root Bank -->
    <path d="M 40,450 L 50,290 L 460,290 L 470,450 Z" fill="#2b231a" stroke="#100d0a" stroke-width="8"/>

    <polygon points="40,290 80,230 430,230 470,290" fill="#4d692b" stroke="#100d0a" stroke-width="8" stroke-linejoin="round"/>
    <polygon points="80,230 430,230 445,275 65,275" fill="#73993d"/>

    <!-- Grass Fringe -->
    <path d="M 50,290 L 40,260 M 90,290 L 85,250 M 150,290 L 160,255 M 230,290 L 220,250 M 310,290 L 320,255 M 400,290 L 390,260" stroke="#8fa843" stroke-width="5" stroke-linecap="round"/>

    <!-- Water Pool -->
    <ellipse cx="256" cy="445" rx="200" ry="12" fill="#182e2b" opacity="0.8"/>
""")

TERRAIN_SVGS["terrain-cover-bog-b"] = wrap_svg("""
    <!-- Base Shadow -->
    <ellipse cx="256" cy="455" rx="210" ry="20" fill="#091410" opacity="0.7"/>

    <!-- Low Driftwood Tangle -->
    <rect x="50" y="410" width="410" height="40" rx="10" fill="#182e2b" stroke="#091410" stroke-width="6"/>

    <!-- Driftwood Logs -->
    <path d="M 40,380 L 460,280 L 470,320 L 50,420 Z" fill="#9c9489" stroke="#1f1d1a" stroke-width="7"/>
    <path d="M 60,270 L 440,390 L 430,430 L 50,310 Z" fill="#847c72" stroke="#1f1d1a" stroke-width="7"/>

    <path d="M 40,380 L 460,280 L 450,295 L 45,395 Z" fill="#c2bba8"/>
    <rect x="220" y="320" width="40" height="50" rx="5" fill="#3b5226" stroke="#1f1d1a" stroke-width="4"/>
""")

def write_svg_files():
    print(f"Writing 24 terrain SVGs to {SVG_DIR}...")
    for name, content in TERRAIN_SVGS.items():
        filepath = os.path.join(SVG_DIR, f"{name}.svg")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"  Saved {name}.svg")

def render_previews():
    if not os.path.exists(EDGE_PATH):
        print("Edge binary not found, skipping screenshots.")
        return

    print("\nRendering 512x512 PNG previews with Edge...")
    for name in TERRAIN_SVGS.keys():
        svg_path = os.path.join(SVG_DIR, f"{name}.svg")
        png_path = os.path.join(PREVIEW_DIR, f"{name}.png")

        html_content = f"""<!DOCTYPE html>
<html>
<head>
  <style>
    body {{
      margin: 0;
      padding: 0;
      width: 512px;
      height: 512px;
      background: #1a1625;
      display: flex;
      align-items: center;
      justify-content: center;
    }}
    img {{
      width: 480px;
      height: 480px;
    }}
  </style>
</head>
<body>
  <img src="file:///{svg_path.replace('\\', '/')}" />
</body>
</html>"""
        temp_html = os.path.join(PREVIEW_DIR, f"temp_{name}.html")
        with open(temp_html, "w", encoding="utf-8") as f:
            f.write(html_content)

        cmd = [
            EDGE_PATH,
            "--headless",
            "--disable-gpu",
            "--hide-scrollbars",
            "--window-size=512,512",
            f"--screenshot={png_path}",
            f"file:///{temp_html.replace('\\', '/')}"
        ]
        subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        if os.path.exists(temp_html):
            os.remove(temp_html)

        print(f"  Rendered preview for {name}.png")

if __name__ == "__main__":
    write_svg_files()
    render_previews()
