#!/usr/bin/env python3
"""Pack the cut sprites from art/cut into public/sprites/atlas*.webp + atlas.json.

Usage: python3 -I tools/build_atlas.py   (after tools/slice_sprites.py)

Every frame in atlas.json: x, y, w, h (pixels in the atlas), ax, ay (anchor 0..1),
s (world units per atlas pixel). Frames ending in "_c" hold only the cloth of a sprite,
in grey, so the game can tint it with the colour of the band.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUT = os.path.join(ROOT, 'art', 'cut')
OUT = os.path.join(ROOT, 'public', 'sprites')
ATLAS = 2048
PAD = 4

TW = 32  # tile width in world units (same as src/client/render.ts)

# name prefix -> (cut ids, kind, world width, texture width)
GROUPS: list[tuple[str, list[str], str, float, int]] = []


def cells(sheet, rows):
    return ' '.join(f'{sheet}{r}{c}' for r in rows for c in (1, 2, 3, 4))


def group(prefix: str, ids: str, kind: str, world: float, tex: int):
    GROUPS.append((prefix, ids.split(), kind, world, tex))


# ground tiles (kind 'tile': anchor on the left/right corner of the diamond)
group('grass', 'A11 A12 A13 A14', 'tile', TW + 3, 128)
group('meadow', 'A21 A22 A23 A24', 'tile', TW + 3, 128)
group('steppe', 'A31 A32 A33 A34', 'tile', TW + 3, 128)
group('hill', 'A41 A42 A43 A44', 'tile', TW + 3, 128)
group('sand', 'B11 B12 B13 B14', 'tile', TW + 3, 128)
group('path', 'B21 B24', 'tile', TW + 3, 128)
group('wheat', 'B31 B32 B33 B34', 'tile', TW + 3, 128)
group('soil', 'B41 B42 B43 B44', 'tile', TW + 3, 128)
group('shallow', 'C11 C12 C13 C14', 'tile', TW + 3, 128)
group('deep', 'C21 C22 C23 C24', 'tile', TW + 3, 128)
group('lily', 'C31 C32 C33 C34', 'tile', TW + 3, 128)
group('marsh', 'C41 C42 C43 C44', 'tile', TW + 3, 128)
group('rock', 'D11 D12 D13 D14', 'tile', TW + 3, 128)
group('snow', 'D21 D22 D23 D24', 'tile', TW + 3, 128)
group('tundra', 'D31 D32 D33 D34', 'tile', TW + 3, 128)
group('crag', 'D41 D42 D43 D44', 'tile', TW + 3, 128)
# trees (kind 'prop': anchor in the middle of the grass patch at the foot)
group('oak', 'E11 E12 E14', 'prop', 26, 120)
group('blossom', 'E13', 'prop', 26, 120)
group('spruce', 'E21 E22', 'prop', 21, 96)
group('pine', 'E23 E24', 'prop', 24, 112)
group('birch', 'E31 E32', 'prop', 22, 104)
group('sapling', 'E33', 'prop', 18, 72)
group('apple', 'E34', 'prop', 22, 104)
group('spruce_snow', 'E41', 'prop', 21, 96)
group('bare_snow', 'E42', 'prop', 24, 112)
group('autumn', 'E43', 'prop', 24, 112)
group('bare', 'E44', 'prop', 24, 112)
# small nature
group('bush', 'F11 F12', 'prop', 15, 64)
group('berries', 'F13', 'prop', 15, 64)
group('flowerbush', 'F14', 'prop', 15, 64)
group('boulder', 'F21 F22 F23 F24', 'prop', 14, 64)
group('log', 'F31', 'prop', 14, 64)
group('stump', 'F32', 'prop', 12, 56)
group('mushroom', 'F33', 'prop', 9, 40)
group('reeds', 'F34', 'prop', 12, 56)
group('flowers', 'F41', 'prop', 11, 48)
group('tuft', 'F42', 'prop', 11, 48)
group('stones', 'F43', 'prop', 11, 48)
group('fern', 'F44', 'prop', 12, 56)
# stone age camp
group('hearth', 'G11 G12 G13 G14', 'prop', 17, 80)
group('tent', 'G21 G22', 'prop', 20, 88)
group('leanto', 'G23', 'prop', 20, 88)
group('bonehut', 'G24', 'prop', 21, 88)
group('furbed', 'G31', 'prop', 15, 64)
group('hiderack', 'G32', 'prop', 18, 80)
group('logpile', 'G33', 'prop', 13, 56)
group('embers', 'G34', 'prop', 17, 80)
group('totem', 'G41', 'prop', 6, 32)
group('banner', 'G42', 'cloth', 11, 56)
group('flag', 'G43', 'cloth', 12, 56)
group('cairn', 'G44', 'prop', 11, 48)
# neolithic village
group('roundhut', 'H11', 'prop', 21, 96)
group('house', 'H12', 'prop', 25, 112)
group('longhouse', 'H13', 'prop', 31, 128)
group('granary', 'H14', 'prop', 17, 72)
group('pen', 'H21', 'prop', 25, 112)
group('kiln', 'H22', 'prop', 15, 64)
group('well', 'H23', 'prop', 15, 64)
group('fence', 'H24', 'prop', 16, 64)
group('pots', 'H31', 'prop', 11, 48)
group('quern', 'H32', 'prop', 11, 48)
group('basket', 'H33', 'prop', 8, 40)
group('fishtrap', 'H34', 'prop', 12, 56)
group('canoe', 'H41', 'prop', 18, 80)
group('haystack', 'H42', 'prop', 13, 56)
group('sled', 'H43', 'prop', 15, 64)
group('shrine', 'H44', 'prop', 15, 64)
# people (world size is the height for these)
group('man', 'I11', 'person', 11, 64)
group('woman', 'I12', 'person', 11, 64)
group('elder', 'I13', 'person', 11, 64)
group('wave', 'I14', 'person', 11, 64)
group('gatherer', 'I21', 'person', 11, 64)
group('carrier', 'I22', 'person', 11, 64)
group('hunter', 'I23', 'person', 11, 64)
group('potter', 'I24', 'person', 11, 64)
group('walk', 'I31 I32 I33 I34', 'person', 11, 64)
# women and grandmothers (sheet K)
group('oldwoman', 'K11', 'person', 10.5, 64)
group('oldherbs', 'K12', 'person', 10.5, 64)
group('oldscarf', 'K13', 'person', 10.5, 64)
group('oldbasket', 'K14', 'person', 10.5, 64)
group('woman2', 'K21', 'person', 11, 64)
group('waterjar', 'K22', 'person', 11, 64)
group('spinner', 'K23', 'person', 11, 64)
group('reedcarrier', 'K24', 'person', 11, 64)
group('oldwalk', 'K31 K32 K33 K34', 'person', 10.5, 64)
group('womanwalk', 'K41 K42 K43 K44', 'person', 11, 64)
# children (sheet L): drawn smaller, the game scales them a bit more by age
group('boy', 'L11', 'person', 8, 56)
group('girl', 'L12', 'person', 8, 56)
group('kidtoy', 'L13', 'person', 8, 56)
group('kidwave', 'L14', 'person', 8, 56)
group('kidstick', 'L21', 'person', 8, 56)
group('kidberries', 'L22', 'person', 8, 56)
group('kidfish', 'L23', 'person', 8, 56)
group('kidpuppy', 'L24', 'person', 8, 56)
group('boywalk', 'L31 L32 L33 L34', 'person', 8, 56)
group('girlwalk', 'L41 L42 L43 L44', 'person', 8, 56)
# animals (kind 'animal': world size is the width, anchor at the hooves); frame 0 stands, 1 walks
# 'animal4': four frames of a walk (frame 0 also stands), one scale for all four from the first frame
group('mammoth', cells('DK', (1,)), 'animal4', 24, 120)
group('rhino', cells('DK', (2,)), 'animal4', 20, 104)
group('cavebear', cells('DK', (3,)), 'animal4', 16, 88)
group('megaloceros', cells('DK', (4,)), 'animal4', 18, 96)
group('aurochs', cells('DL', (1,)), 'animal4', 18, 96)
group('bison', cells('DL', (2,)), 'animal4', 18, 96)
group('wildhorse', cells('DL', (3,)), 'animal4', 14, 80)
group('reindeer', cells('DL', (4,)), 'animal4', 14, 80)
group('reddeer', cells('DM', (1,)), 'animal4', 14, 80)
group('boar', cells('DM', (2,)), 'animal4', 12, 72)
group('wolf', cells('DM', (3,)), 'animal4', 11, 64)
group('bear', cells('DM', (4,)), 'animal4', 15, 88)
group('fox', cells('DN', (1,)), 'animal4', 9, 56)
group('lynx', cells('DN', (2,)), 'animal4', 9, 56)
group('hare', cells('DN', (3,)), 'animal4', 6, 40)
group('beaver', cells('DN', (4,)), 'animal4', 7, 48)
# birds and water: eagle, owl and crow have two flight frames; duck, swan and fish sit on the water
group('eagle', cells('DU', (1,)), 'animal4', 12, 72)
group('stork', cells('DT', (1,)), 'animal4', 7, 48)
group('heron', cells('DT', (2,)), 'animal4', 7, 48)
group('duck', cells('DT', (4,)), 'animal4', 6, 40)
group('swan', cells('DT', (3,)), 'animal4', 8, 48)
group('owl', 'O33', 'animal', 5, 32)
group('owlfly', cells('DU', (2,)), 'animal4', 9, 56)
group('crow', 'O41', 'animal', 5, 32)
group('crowfly', cells('DU', (3,)), 'animal4', 8, 48)
group('fish', cells('DU', (4,)), 'animal4', 7, 48)
# farm animals
group('dog', cells('DQ', (1,)), 'animal4', 8, 48)
group('goat', cells('DQ', (2,)), 'animal4', 8, 48)
group('sheep', cells('DQ', (3,)), 'animal4', 8, 48)
group('cow', cells('DQ', (4,)), 'animal4', 13, 72)
group('pig', cells('DR', (1,)), 'animal4', 9, 56)
group('horse', cells('DR', (2,)), 'animal4', 13, 72)
group('hen', cells('DR', (3,)), 'animal4', 4, 32)
group('donkey', cells('DR', (4,)), 'animal4', 10, 56)
# south and desert
group('lion', cells('DO', (1,)), 'animal4', 13, 72)
group('camel', cells('DO', (2,)), 'animal4', 15, 80)
group('elephant', cells('DO', (3,)), 'animal4', 22, 112)
group('gazelle', cells('DO', (4,)), 'animal4', 9, 56)
group('reddeerrun', cells('DP', (2,)), 'animal4', 15, 84)
group('wildhorserun', cells('DP', (3,)), 'animal4', 15.5, 88)
group('wolfrun', cells('DP', (4,)), 'animal4', 13, 76)
group('ostrich', cells('DP', (1,)), 'animal4', 9, 56)
group('croc', cells('DS', (1,)), 'animal4', 14, 80)
group('monkey', cells('DS', (2,)), 'animal4', 6, 40)
group('cat', cells('DS', (3,)), 'animal4', 5, 32)
group('farmduck', cells('DS', (4,)), 'animal4', 6, 40)
# secrets (easter eggs): drawn tiny on purpose (10% bigger since ver. 1.06), frame 0 and 1 alternate
group('sec_ufo', 'R11 R12', 'prop', 6.6, 48)
group('sec_meteor', 'R13 R14', 'prop', 6.6, 48)
group('sec_eggs', 'R21 R22', 'prop', 5.5, 40)
group('sec_goldegg', 'R23 R24', 'prop', 5.5, 40)
group('sec_robot', 'R31 R32', 'prop', 5.5, 40)
group('sec_stag', 'R33 R34', 'prop', 6.6, 48)
group('sec_dragon', 'R41 R42', 'prop', 6.6, 48)
group('sec_portal', 'R43 R44', 'prop', 6.6, 48)
# the 100 fairy tale heroes of the secrets (sheet DJ, 10 x 10): hero0..hero99 in the order of the secrets
for _k in range(100):
    group(f'hero{_k}', f'DJ{_k // 10 + 1}{_k % 10 + 1:02}', 'thing', 0.058, 0)
# chiefs (sheets S-V, 8 frames each): A young/old, B young/old; their cream fur is kept as drawn (no band tint)
for look, young, old in (('chiefA', 'S', 'T'), ('chiefB', 'U', 'V')):
    for age, sheet in (('y', young), ('o', old)):
        group(f'{look}_{age}_idle', ' '.join(f'{sheet}{r}{c}' for r in (1, 2) for c in (1, 2, 3, 4)), 'person', 11.5, 64)
        group(f'{look}_{age}_walk', ' '.join(f'{sheet}{r}{c}' for r in (3, 4) for c in (1, 2, 3, 4)), 'person', 11.5, 64)
# growing trees (sheets W-Z): columns are kinds, rows are stages 1-4 (sapling, young, grown, big).
# Kind 'grow' keeps the sizes of the sheet: world units per source pixel instead of a fixed width.
GROW_WPP = 0.1   # world units per sheet pixel: the big oak is about 27 wide, like the old trees
GROW_TEX = 4.6   # texture pixels per world unit (same sharpness as the other trees)
GROW_BOOST = {'Y4': 1.22}  # the conifer sheet drew its last row no bigger than the third
for sheet, kinds in (('W', 'spruceS bareS autumn bare'), ('X', 'birch birchY fruit apple'),
                     ('Y', 'spruceL spruceD pine pineU'), ('Z', 'oak oakL blossom oakOld')):
    for c, kind in enumerate(kinds.split(), start=1):
        group(f'g_{kind}', ' '.join(f'{sheet}{r}{c}' for r in (1, 2, 3, 4)), 'grow', GROW_WPP, 0)
# sheets AA-AF (world units per sheet pixel; 'pose' = people, 'thing' = objects)
PEOPLE_WPP = 0.0525  # a standing adult in these sheets is about 220 px = 11.5 world units
for k, kind in enumerate(('oak', 'birch', 'pine', 'old'), start=1):
    group(f'stump_{kind}', f'AA1{k} AA2{k}', 'thing', 0.037, 0)  # 0 old, 1 fresh
group('felled', 'AA31', 'thing', 0.045, 0)
group('birchlog', 'AA32', 'thing', 0.04, 0)
group('logs3', 'AA33', 'thing', 0.04, 0)
group('woodstack', 'AA34', 'thing', 0.045, 0)
group('branches', 'AA41', 'thing', 0.035, 0)
group('chopblock', 'AA42', 'thing', 0.035, 0)
group('brushwood', 'AA43', 'thing', 0.035, 0)
group('staked', 'AA44', 'thing', 0.035, 0)
group('chop', cells('AB', (1, 2)), 'pose', PEOPLE_WPP, 0)
group('carry', cells('AB', (3, 4)), 'pose', PEOPLE_WPP, 0)
group('sleepM', 'AC11 AC12', 'pose', PEOPLE_WPP, 0)
group('sleepF', 'AC13 AC14', 'pose', PEOPLE_WPP, 0)
group('sleepK', 'AC21 AC22', 'pose', PEOPLE_WPP, 0)
group('sleepKK', 'AC23 AC24', 'pose', PEOPLE_WPP, 0)
group('sitM', 'AC31 AC32', 'pose', PEOPLE_WPP, 0)
group('sitF', 'AC33 AC34', 'pose', PEOPLE_WPP, 0)
group('guard', 'AC41 AC42 AC43 AC44', 'pose', PEOPLE_WPP, 0)
group('tell', cells('AD', (1, 2)), 'pose', PEOPLE_WPP, 0)
group('listen', cells('AD', (3, 4)), 'pose', PEOPLE_WPP, 0)
group('throw', cells('AE', (1,)), 'pose', PEOPLE_WPP, 0)
group('pick', cells('AE', (2,)), 'pose', PEOPLE_WPP, 0)
group('spearfish', cells('AE', (3,)), 'pose', PEOPLE_WPP, 0)
group('knap', cells('AE', (4,)), 'pose', PEOPLE_WPP, 0)
group('hutb', cells('AF', (1,)), 'thing', 0.07, 0)    # 0..3: stakes, wattle, roof frame, done
group('houseb', cells('AF', (2,)), 'thing', 0.075, 0)  # 0..3: first bricks, walls, beams, done
group('field', cells('AF', (3,)), 'tile', TW + 3, 128)  # 0..3: ploughed, sprouts, wheat, stubble
group('goatpen', 'AF41', 'thing', 0.08, 0)
group('quern2', 'AF42', 'thing', 0.05, 0)
group('oven', 'AF43', 'thing', 0.055, 0)
group('bricks', 'AF44', 'thing', 0.06, 0)
# bronze age (AG props, AH town); skipped until the sheets exist
for cid, name, w in (('AG11', 'ore', 0.045), ('AG12', 'mine', 0.07), ('AG13', 'furnace', 0.055), ('AG14', 'mould', 0.045),
                     ('AG21', 'anvil', 0.045), ('AG22', 'toolrack', 0.05), ('AG23', 'potwheel', 0.045), ('AG24', 'loom', 0.05),
                     ('AG31', 'ploughox', 0.075), ('AG32', 'cart', 0.06), ('AG33', 'cartfull', 0.06), ('AG34', 'horsepost', 0.06),
                     ('AG41', 'sailboat', 0.07), ('AG42', 'tablets', 0.045), ('AG43', 'granary2', 0.06), ('AG44', 'stall', 0.06),
                     ('AH21', 'wall', 0.075), ('AH22', 'wallc', 0.075), ('AH23', 'gate', 0.085), ('AH24', 'tower', 0.075),
                     ('AH41', 'well2', 0.05), ('AH42', 'market', 0.08), ('AH43', 'road', 0.07), ('AH44', 'statue', 0.06)):
    group(name, cid, 'thing', w, 0)
group('townb', cells('AH', (1,)), 'thing', 0.08, 0)   # 0..3: foundation, walls, upper floor, done
group('templeb', cells('AH', (3,)), 'thing', 0.09, 0)  # 0..3: platform, steps, columns, done
group('trod', cells('AM', (1, 2, 3, 4)), 'tile', TW + 3, 128)  # trampled camp ground, 16 variants
# village guards (AN stone age, AO bronze age): the spear reaches above the head; the man is ~10% taller than the others
group('gwalk', cells('AN', (1, 2)), 'person', 13.6, 64)
group('gidle', cells('AN', (3, 4)), 'person', 13.6, 64)
group('bgwalk', cells('AO', (1, 2)), 'person', 13.6, 64)
group('bgidle', cells('AO', (3, 4)), 'person', 13.6, 64)
# sleepers that had no own sprites (AP): chiefs, old people, girls and boys
for cid, name in (('AP11 AP12', 'chiefA_y_sleep'), ('AP13 AP14', 'chiefA_o_sleep'), ('AP21 AP22', 'chiefB_y_sleep'), ('AP23 AP24', 'chiefB_o_sleep'),
                  ('AP31 AP32', 'sleepOldM'), ('AP33 AP34', 'sleepOldF'), ('AP41 AP42', 'sleepGirl'), ('AP43 AP44', 'sleepBoy')):
    group(name, cid, 'pose', PEOPLE_WPP * 0.8, 0)  # drawn a bit bigger than the AC sleepers
group('smith', cells('AI', (1,)), 'pose', PEOPLE_WPP, 0)
group('plougher', cells('AI', (2,)), 'pose', PEOPLE_WPP, 0)
group('wheelpot', cells('AI', (3,)), 'pose', PEOPLE_WPP, 0)
group('weaver', cells('AI', (4,)), 'pose', PEOPLE_WPP, 0)
group('trader', cells('AJ', (1,)), 'pose', PEOPLE_WPP, 0)
group('scribe', cells('AJ', (2,)), 'pose', PEOPLE_WPP, 0)
group('rider', cells('AJ', (3,)), 'pose', PEOPLE_WPP, 0)
group('sailer', cells('AJ', (4,)), 'pose', PEOPLE_WPP, 0)
# iron age (AS props, AT/AU town, AV workers, AW travellers, AX guard)
for cid, name, w in (('AS11', 'charcoal', 0.055), ('AS12', 'bloomery', 0.055), ('AS13', 'ianvil', 0.045), ('AS14', 'irack', 0.05),
                     ('AS21', 'mint', 0.05), ('AS22', 'chest', 0.045), ('AS23', 'stele', 0.045), ('AS24', 'scrolls', 0.05),
                     ('AS31', 'herbtable', 0.05), ('AS32', 'amphorae', 0.045), ('AS33', 'press', 0.05), ('AS34', 'beehives', 0.05),
                     ('AS41', 'fountain', 0.05), ('AS42', 'crane', 0.055), ('AS43', 'blocks', 0.045), ('AS44', 'milestone', 0.045),
                     ('AT41', 'aqueduct', 0.085), ('AT42', 'aqfount', 0.08), ('AT43', 'archbridge', 0.08), ('AT44', 'lighthouse', 0.07),
                     ('AU33', 'warehouse', 0.08), ('AU34', 'galley', 0.08),
                     ('AU41', 'iwall', 0.08), ('AU42', 'iwallc', 0.08), ('AU43', 'igate', 0.09), ('AU44', 'itower', 0.07)):
    group(name, cid, 'thing', w, 0)
group('villab', cells('AT', (1,)), 'thing', 0.09, 0)     # 0..3: foundation, walls, beams, done (courtyard house)
group('palaceb', cells('AT', (2,)), 'thing', 0.11, 0)    # 0..3: terrace, walls, columns, done
group('mill', cells('AT', (3,)), 'thing', 0.08, 0)       # 4 frames: the wheel turns
group('theatreb', cells('AU', (1,)), 'thing', 0.1, 0)    # 0..3
group('schoolb', cells('AU', (2,)), 'thing', 0.09, 0)    # 0..3
group('ismith', cells('AV', (1,)), 'pose', PEOPLE_WPP, 0)
group('mason', cells('AV', (2,)), 'pose', PEOPLE_WPP, 0)
group('healer', cells('AV', (3,)), 'pose', PEOPLE_WPP, 0)
group('actor', cells('AV', (4,)), 'pose', PEOPLE_WPP, 0)
group('trader2', cells('AW', (1,)), 'pose', PEOPLE_WPP, 0)
group('rowship', cells('AW', (2,)), 'pose', PEOPLE_WPP, 0)
group('king', cells('AW', (3,)), 'pose', PEOPLE_WPP, 0)
group('teacher', cells('AW', (4,)), 'pose', PEOPLE_WPP, 0)
group('igwalk', cells('AX', (1, 2)), 'person', 13.6, 64)
group('igidle', cells('AX', (3, 4)), 'person', 13.6, 64)
# middle ages (AY props, AZ castle, BA town, BB workers, BC travellers, BD guard)
for cid, name, w in (('AY11', 'hplough', 0.07), ('AY12', 'spinwheel', 0.045), ('AY13', 'brewery', 0.05), ('AY14', 'tannery', 0.055),
                     ('AY21', 'papervat', 0.055), ('AY22', 'lectern', 0.05), ('AY23', 'compass', 0.05), ('AY24', 'printpress', 0.05),
                     ('AY31', 'bell', 0.05), ('AY32', 'farrier', 0.05), ('AY33', 'guildsign', 0.045), ('AY34', 'mwell', 0.05),
                     ('AY41', 'warhorse', 0.06), ('AY42', 'quintain', 0.045), ('AY43', 'haycart', 0.055), ('AY44', 'barrow', 0.045),
                     ('AZ21', 'cwall', 0.085), ('AZ22', 'cwallc', 0.085), ('AZ23', 'cgate', 0.095), ('AZ24', 'ctower', 0.07),
                     ('BA31', 'guildhall', 0.08), ('BA32', 'markethall', 0.085), ('BA33', 'clocktower', 0.065), ('BA34', 'inn', 0.08),
                     ('BA41', 'mbridge', 0.08), ('BA42', 'cog', 0.075), ('BA43', 'treadcrane', 0.065), ('BA44', 'tourney', 0.08)):
    group(name, cid, 'thing', w, 0)
group('keepb', cells('AZ', (1,)), 'thing', 0.1, 0)        # 0..3: foundation, walls, no roof, done
group('churchb', cells('AZ', (3,)), 'thing', 0.1, 0)      # 0..3: gothic church
group('windmill', cells('AZ', (4,)), 'thing', 0.075, 0)   # 4 frames: the sails turn
group('timberb', cells('BA', (1,)), 'thing', 0.085, 0)    # 0..3: half-timbered house
group('abbeyb', cells('BA', (2,)), 'thing', 0.1, 0)       # 0..3: monastery
group('monk', cells('BB', (1,)), 'pose', PEOPLE_WPP, 0)
group('miller', cells('BB', (2,)), 'pose', PEOPLE_WPP, 0)
group('cooper', cells('BB', (3,)), 'pose', PEOPLE_WPP, 0)
group('spinner', cells('BB', (4,)), 'pose', PEOPLE_WPP, 0)
group('knight', cells('BC', (1,)), 'pose', PEOPLE_WPP, 0)
group('wagon', cells('BC', (2,)), 'pose', PEOPLE_WPP, 0)
group('minstrel', cells('BC', (3,)), 'pose', PEOPLE_WPP, 0)
group('pilgrims', cells('BC', (4,)), 'pose', PEOPLE_WPP, 0)
group('mgwalk', cells('BD', (1, 2)), 'person', 13.6, 64)
group('mgidle', cells('BD', (3, 4)), 'person', 13.6, 64)
# early modern age (BE props, BF palace/observatory/star fort, BG town, BH ships and colonies, BI workers, BJ travellers, BK guard)
for cid, name, w in (('BE11', 'telescope', 0.05), ('BE12', 'globe', 0.045), ('BE13', 'microscope', 0.05), ('BE14', 'pclock', 0.04),
                     ('BE21', 'glassfurn', 0.055), ('BE22', 'newspress', 0.05), ('BE23', 'bankchest', 0.05), ('BE24', 'navtable', 0.05),
                     ('BE31', 'potatoes', 0.055), ('BE32', 'maize', 0.055), ('BE33', 'coffee', 0.05), ('BE34', 'fireworks', 0.045),
                     ('BE41', 'tradecart', 0.055), ('BE42', 'cargo', 0.05), ('BE43', 'apothecary', 0.05), ('BE44', 'sedan', 0.045),
                     ('BF31', 'sfwall', 0.085), ('BF32', 'sfbastion', 0.085), ('BF33', 'sfgate', 0.09), ('BF34', 'sfhouse', 0.075),
                     ('BF41', 'bank', 0.085), ('BF42', 'townhall', 0.09), ('BF43', 'bfountain', 0.06), ('BF44', 'opera', 0.09),
                     ('BG31', 'bwarehouse', 0.08), ('BG32', 'coffeehouse', 0.08), ('BG33', 'printhouse', 0.075), ('BG34', 'clockshop', 0.075),
                     ('BG41', 'pier', 0.08), ('BG42', 'lighthouse2', 0.065), ('BG43', 'quay', 0.08), ('BG44', 'customs', 0.08),
                     ('BH41', 'jetty', 0.075), ('BH42', 'colfort', 0.08), ('BH43', 'logcabin', 0.075), ('BH44', 'colflag', 0.065)):
    group(name, cid, 'thing', w, 0)
group('baroqueb', cells('BF', (1,)), 'thing', 0.12, 0)    # 0..3: baroque palace
group('observb', cells('BF', (2,)), 'thing', 0.08, 0)     # 0..3: observatory
group('brickb', cells('BG', (1,)), 'thing', 0.08, 0)      # 0..3: brick gable house
group('shipyardb', cells('BG', (2,)), 'thing', 0.1, 0)    # 0..3: galleon on the slipway
group('galleon', cells('BH', (1,)), 'thing', 0.1, 0)      # 4 frames: rocking on the waves
group('caravel', cells('BH', (2,)), 'thing', 0.08, 0)     # 4 frames
group('rowboat', cells('BH', (3,)), 'thing', 0.07, 0)     # 4 frames
group('astronomer', cells('BI', (1,)), 'pose', PEOPLE_WPP, 0)
group('printer', cells('BI', (2,)), 'pose', PEOPLE_WPP, 0)
group('glassblower', cells('BI', (3,)), 'pose', PEOPLE_WPP, 0)
group('sailor', cells('BI', (4,)), 'pose', PEOPLE_WPP, 0)
group('coach', cells('BJ', (1,)), 'pose', PEOPLE_WPP, 0)
group('crier', cells('BJ', (2,)), 'pose', PEOPLE_WPP, 0)
group('strollers', cells('BJ', (3,)), 'pose', PEOPLE_WPP, 0)
group('sailors', cells('BJ', (4,)), 'pose', PEOPLE_WPP, 0)
group('pgwalk', cells('BK', (1, 2)), 'person', 13.6, 64)
group('pgidle', cells('BK', (3, 4)), 'person', 13.6, 64)
# industrial age (BL props, BM factory/station/bridge, BN town, BO trains and steamers, BP workers, BQ travellers, BR watchman)
for cid, name, w in (('BL11', 'steamengine', 0.055), ('BL12', 'powerloom', 0.055), ('BL13', 'coalcart', 0.05), ('BL14', 'girders', 0.05),
                     ('BL21', 'sewing', 0.045), ('BL22', 'camera', 0.045), ('BL23', 'telegraph', 0.05), ('BL24', 'gaslamp', 0.035),
                     ('BL31', 'pennyfar', 0.045), ('BL32', 'gramophone', 0.04), ('BL33', 'bulbs', 0.05), ('BL34', 'docbag', 0.045),
                     ('BL41', 'tractor', 0.055), ('BL42', 'churns', 0.04), ('BL43', 'bench', 0.045), ('BL44', 'pump', 0.04),
                     ('BM31', 'ironbridge', 0.085), ('BM32', 'watertower', 0.06), ('BM33', 'gasholder', 0.08), ('BM34', 'powerplant', 0.09),
                     ('BM41', 'rail', 0.07), ('BM42', 'railcurve', 0.07), ('BM43', 'signal', 0.045), ('BM44', 'signalbox', 0.06),
                     ('BN21', 'villa', 0.08), ('BN22', 'schoolhouse', 0.085), ('BN23', 'hospital', 0.09), ('BN24', 'store', 0.09),
                     ('BN31', 'postoffice', 0.085), ('BN32', 'museum', 0.09), ('BN33', 'bandstand', 0.07), ('BN34', 'glassmarket', 0.09),
                     ('BN41', 'firestation', 0.08), ('BN42', 'theatre2', 0.09), ('BN43', 'ifountain', 0.06), ('BN44', 'brickchurch', 0.08),
                     ('BO41', 'carriage', 0.07), ('BO42', 'goodswagon', 0.065), ('BO43', 'horsetram', 0.07), ('BO44', 'motorcar', 0.055)):
    group(name, cid, 'thing', w, 0)
group('factoryb', cells('BM', (1,)), 'thing', 0.11, 0)    # 0..3: factory
group('stationb', cells('BM', (2,)), 'thing', 0.11, 0)    # 0..3: railway station
group('flatsb', cells('BN', (1,)), 'thing', 0.085, 0)     # 0..3: brick apartment house
group('loco', cells('BO', (1,)), 'thing', 0.075, 0)       # 4 frames
group('steamer', cells('BO', (2,)), 'thing', 0.09, 0)     # 4 frames
group('balloon', cells('BO', (3,)), 'thing', 0.06, 0)     # 4 frames
group('stoker', cells('BP', (1,)), 'pose', PEOPLE_WPP, 0)
group('seamstress', cells('BP', (2,)), 'pose', PEOPLE_WPP, 0)
group('telegraphist', cells('BP', (3,)), 'pose', PEOPLE_WPP, 0)
group('photographer', cells('BP', (4,)), 'pose', PEOPLE_WPP, 0)
group('cyclist', cells('BQ', (1,)), 'pose', PEOPLE_WPP, 0)
group('pram', cells('BQ', (2,)), 'pose', PEOPLE_WPP, 0)
group('paperboy', cells('BQ', (3,)), 'pose', PEOPLE_WPP, 0)
group('lady', cells('BQ', (4,)), 'pose', PEOPLE_WPP, 0)
group('wgwalk', cells('BR', (1, 2)), 'person', 13.6, 64)
group('wgidle', cells('BR', (3, 4)), 'person', 13.6, 64)
# information age (CE props, CF skyscraper/airport/plants, CG town, CH cars, buses, planes, CI workers, CJ travellers, CK patrol officer)
for cid, name, w in (('CE11', 'satdish', 0.05), ('CE12', 'pcdesk', 0.055), ('CE13', 'tvset', 0.05), ('CE14', 'phonebox', 0.045),
                     ('CE21', 'solarpanel', 0.06), ('CE22', 'charger', 0.045), ('CE23', 'trafficlight', 0.045), ('CE24', 'busstop', 0.06),
                     ('CE31', 'playground', 0.07), ('CE32', 'recycling', 0.055), ('CE33', 'postbox', 0.04), ('CE34', 'parkbench2', 0.055),
                     ('CE41', 'windturbine', 0.06), ('CE42', 'vending', 0.045), ('CE43', 'kiosk', 0.06), ('CE44', 'scooter', 0.05),
                     ('CF31', 'nuclear', 0.1), ('CF32', 'tvtower', 0.07), ('CF33', 'solarfarm', 0.09), ('CF34', 'radioscope', 0.08),
                     ('CF41', 'mrail', 0.07), ('CF42', 'mrailcurve', 0.07), ('CF43', 'msignal', 0.045), ('CF44', 'launchpad', 0.08),
                     ('CG21', 'house2', 0.085), ('CG22', 'school2', 0.095), ('CG23', 'hospital2', 0.095), ('CG24', 'supermarket', 0.095),
                     ('CG31', 'cinema', 0.09), ('CG32', 'stadium', 0.1), ('CG33', 'library', 0.09), ('CG34', 'office', 0.09),
                     ('CG41', 'firestation2', 0.09), ('CG42', 'petrol', 0.09), ('CG43', 'cafe2', 0.085), ('CG44', 'park', 0.09),
                     ('CH41', 'etrain', 0.08), ('CH42', 'containership', 0.1), ('CH43', 'helicopter', 0.06), ('CH44', 'truck', 0.065)):
    group(name, cid, 'thing', w, 0)
group('skyscraperb', cells('CF', (1,)), 'thing', 0.1, 0)   # 0..3: glass skyscraper
group('airportb', cells('CF', (2,)), 'thing', 0.12, 0)     # 0..3: airport with tower
group('blockb', cells('CG', (1,)), 'thing', 0.09, 0)       # 0..3: apartment block
group('car', cells('CH', (1,)), 'thing', 0.055, 0)         # 4 frames
group('bus', cells('CH', (2,)), 'thing', 0.075, 0)         # 4 frames
group('plane', cells('CH', (3,)), 'thing', 0.09, 0)        # 4 frames
group('programmer', cells('CI', (1,)), 'pose', PEOPLE_WPP, 0)
group('scientist', cells('CI', (2,)), 'pose', PEOPLE_WPP, 0)
group('builder', cells('CI', (3,)), 'pose', PEOPLE_WPP, 0)
group('doctor', cells('CI', (4,)), 'pose', PEOPLE_WPP, 0)
group('jogger', cells('CJ', (1,)), 'pose', PEOPLE_WPP, 0)
group('phonewalk', cells('CJ', (2,)), 'pose', PEOPLE_WPP, 0)
group('kickscooter', cells('CJ', (3,)), 'pose', PEOPLE_WPP, 0)
group('courier', cells('CJ', (4,)), 'pose', PEOPLE_WPP, 0)
group('ogwalk', cells('CK', (1, 2)), 'person', 13.6, 64)
group('ogidle', cells('CK', (3, 4)), 'person', 13.6, 64)
# space age (CL props, CM green tower/spaceport/plants, CN town, CO maglev, flying cars, rockets, CP workers, CQ travellers, CR ranger)
for cid, name, w in (('CL11', 'hoverscooter', 0.05), ('CL12', 'gardendome', 0.065), ('CL13', 'drone', 0.045), ('CL14', 'robodog', 0.04),
                     ('CL21', 'rover', 0.055), ('CL22', 'planttower', 0.06), ('CL23', 'solartree', 0.06), ('CL24', 'spacesuit', 0.045),
                     ('CL31', 'hydrocrate', 0.06), ('CL32', 'chargepad', 0.05), ('CL33', 'airpillar', 0.045), ('CL34', 'scope2', 0.045),
                     ('CL41', 'wavebench', 0.055), ('CL42', 'gardenbot', 0.05), ('CL43', 'watertank', 0.055), ('CL44', 'futlamp', 0.035),
                     ('CM31', 'fusion', 0.1), ('CM32', 'elevator', 0.09), ('CM33', 'vfarm', 0.09), ('CM34', 'rocketpad', 0.085),
                     ('CM41', 'maglevbeam', 0.07), ('CM42', 'maglevcurve', 0.07), ('CM43', 'maglevstation', 0.09), ('CM44', 'domehouse', 0.09),
                     ('CN21', 'roundhouse', 0.085), ('CN22', 'school3', 0.095), ('CN23', 'medcenter', 0.095), ('CN24', 'glassmarket2', 0.095),
                     ('CN31', 'observatory2', 0.09), ('CN32', 'spacemuseum', 0.095), ('CN33', 'park2', 0.09), ('CN34', 'windtower', 0.07),
                     ('CN41', 'robotshop', 0.09), ('CN42', 'skyport', 0.095), ('CN43', 'cafe3', 0.09), ('CN44', 'starmonument', 0.07),
                     ('CO41', 'cargodrone', 0.06), ('CO42', 'airship', 0.1), ('CO43', 'pod', 0.05), ('CO44', 'starship', 0.12)):
    group(name, cid, 'thing', w, 0)
group('arcob', cells('CM', (1,)), 'thing', 0.1, 0)        # 0..3: green tower with gardens
group('spaceportb', cells('CM', (2,)), 'thing', 0.12, 0)  # 0..3: spaceport
group('ecob', cells('CN', (1,)), 'thing', 0.095, 0)       # 0..3: terraced eco apartments
group('maglev', cells('CO', (1,)), 'thing', 0.09, 0)      # 4 frames
group('flycar', cells('CO', (2,)), 'thing', 0.055, 0)     # 4 frames
group('launch', cells('CO', (3,)), 'thing', 0.085, 0)     # 4 frames: a rocket lifts off
group('technician', cells('CP', (1,)), 'pose', PEOPLE_WPP, 0)
group('botanist', cells('CP', (2,)), 'pose', PEOPLE_WPP, 0)
group('engineer', cells('CP', (3,)), 'pose', PEOPLE_WPP, 0)
group('astronaut', cells('CP', (4,)), 'pose', PEOPLE_WPP, 0)
group('robodogwalk', cells('CQ', (1,)), 'pose', PEOPLE_WPP, 0)
group('hoverride', cells('CQ', (2,)), 'pose', PEOPLE_WPP, 0)
group('dronekid', cells('CQ', (3,)), 'pose', PEOPLE_WPP, 0)
group('eldercouple', cells('CQ', (4,)), 'pose', PEOPLE_WPP, 0)
group('rgwalk', cells('CR', (1, 2)), 'person', 13.6, 64)
group('rgidle', cells('CR', (3, 4)), 'person', 13.6, 64)
# canoes and fishing (CS: canoe paddling towards us / away, net cast from the canoe, rod on the bank; CT: carrying fish home, woman with rod, net pulled in the shallows)
group('canoese', cells('CS', (1,)), 'pose', PEOPLE_WPP, 0)
group('canoene', cells('CS', (2,)), 'pose', PEOPLE_WPP, 0)
group('canoenet', cells('CS', (3,)), 'pose', PEOPLE_WPP, 0)
group('rodfish', cells('CS', (4,)), 'pose', PEOPLE_WPP, 0)
group('fishcarry', cells('CT', (1,)), 'pose', PEOPLE_WPP, 0)
group('fishbasket', cells('CT', (2,)), 'pose', PEOPLE_WPP, 0)
group('rodfishf', cells('CT', (3,)), 'pose', PEOPLE_WPP, 0)
group('netpull', cells('CT', (4,)), 'pose', PEOPLE_WPP, 0)
# fishing in the later ages (CU antiquity + middle ages, CV 1600s + 1800s, CW today + future): man with a rod, woman with the catch
for cid, rows in (('CU', ('e2', 'e4')), ('CV', ('e5', 'e6')), ('CW', ('e7', 'e8'))):
    for k, era in enumerate(rows):
        group(f'{era}rodfish', cells(cid, (2 * k + 1,)), 'pose', PEOPLE_WPP, 0)
        group(f'{era}fishbasket', cells(cid, (2 * k + 2,)), 'pose', PEOPLE_WPP, 0)
# boats after the dugout (CX): wooden rowing boat and motorboat, towards us / away
group('skiffse', cells('CX', (1,)), 'pose', PEOPLE_WPP, 0)
group('skiffne', cells('CX', (2,)), 'pose', PEOPLE_WPP, 0)
group('motorse', cells('CX', (3,)), 'pose', PEOPLE_WPP, 0)
group('motorne', cells('CX', (4,)), 'pose', PEOPLE_WPP, 0)
# Mars (CY colonists, CZ children and poses, DA domes, DB things and rocks, DC rockets and work); people prefix m9
group('mdomeb', cells('DA', (1,)), 'thing', 0.085, 0)     # 0..3: a small living dome going up
group('bigdomeb', cells('DA', (2,)), 'thing', 0.115, 0)   # 0..3: a big town dome going up
for cid, name, w in (('DA31', 'mgreenhouse', 0.085), ('DA32', 'mlab', 0.075), ('DA33', 'mstore', 0.075), ('DA34', 'mpower', 0.08),
                     ('DA41', 'mairtower', 0.06), ('DA42', 'mmed', 0.075), ('DA43', 'mschool', 0.075), ('DA44', 'mpad', 0.085),
                     ('DB11', 'mrocks', 0.04), ('DB12', 'mpillar', 0.045), ('DB13', 'mcrater', 0.05), ('DB14', 'mboulders', 0.04),
                     ('DB21', 'mrover', 0.045), ('DB22', 'mbigrover', 0.05), ('DB23', 'micedrill', 0.042), ('DB24', 'mdish', 0.042),
                     ('DB31', 'msolar', 0.05), ('DB32', 'mairmaker', 0.045), ('DB33', 'mcrates', 0.04), ('DB34', 'msuit', 0.035),
                     ('DB41', 'mplants', 0.042), ('DB42', 'mtank', 0.04), ('DB43', 'mbot', 0.03), ('DB44', 'mcairn', 0.03)):
    group(name, cid, 'thing', w, 0)
group('rocketdown', cells('DC', (1,)), 'thing', 0.075, 0)  # 4 frames: comes down and lands
group('rocketup', cells('DC', (2,)), 'thing', 0.075, 0)    # 4 frames: lifts off
group('mdrill', cells('DC', (3,)), 'pose', PEOPLE_WPP, 0)
group('mbotanist', cells('DC', (4,)), 'pose', PEOPLE_WPP, 0)
# town walls of each age (DD palisade, DE stone, DF castle, DG brick bastion, DH iron railing, DI white wall with a hedge):
# straight pieces along a tile edge rising to the right (r) or left (l), gates, towers, half-built pieces, rubble, stairs
for kit in ('DD', 'DE', 'DF', 'DG', 'DH', 'DI'):
    first = os.path.join(CUT, f'{kit}11.png')
    if not os.path.exists(first):
        continue
    # one straight piece spans one side of a tile (16 x 8 world units) and a little more, so the pieces overlap
    wpp = 19 / Image.open(first).size[0]
    for cid, name in ((f'{kit}11', 'r0'), (f'{kit}12', 'r1'), (f'{kit}13', 'l0'), (f'{kit}14', 'l1')):
        group(f'wall{kit}{name}', cid, 'thing', wpp, 0)
    for cid, name in ((f'{kit}21', 'gate{k}r'), (f'{kit}22', 'gate{k}l'), (f'{kit}23', 'tower{k}'), (f'{kit}24', 'tower{k}s'),
                      (f'{kit}41', 'rubble{k}r'), (f'{kit}42', 'rubble{k}l'), (f'{kit}43', 'stairs{k}r'), (f'{kit}44', 'stairs{k}l')):
        group(name.format(k=kit), cid, 'thing', wpp, 0)
    group(f'wbuild{kit}r', f'{kit}31 {kit}32', 'thing', wpp, 0)
    group(f'wbuild{kit}l', f'{kit}33 {kit}34', 'thing', wpp, 0)
# everyday clothes of each age (sheets BS-CD, two per age: adults, then children and more poses); prefix e<era>
for pre, a, b in (('e2', 'BS', 'BT'), ('e4', 'BU', 'BV'), ('e5', 'BW', 'BX'), ('e6', 'BY', 'BZ'), ('e7', 'CA', 'CB'), ('e8', 'CC', 'CD'), ('m9', 'CY', 'CZ')):
    group(pre + 'walk', cells(a, (1,)), 'person', 11, 64)
    group(pre + 'womanwalk', cells(a, (2,)), 'person', 11, 64)
    group(pre + 'oldwalk', cells(a, (3,)), 'person', 10.5, 64)
    for c, nm in enumerate(('man', 'woman', 'elder', 'wave'), 1):
        group(pre + nm, f'{a}4{c}', 'person', 11, 64)
    group(pre + 'boywalk', cells(b, (1,)), 'person', 8, 56)
    group(pre + 'girlwalk', cells(b, (2,)), 'person', 8, 56)
    for c, nm in enumerate(('boy', 'girl', 'kidwave', 'kidtoy'), 1):
        group(pre + nm, f'{b}3{c}', 'person', 8, 56)
    for c, nm, w in ((1, 'gatherer', 11), (2, 'carrier', 11), (3, 'oldwoman', 10.5), (4, 'woman2', 11)):
        group(pre + nm, f'{b}4{c}', 'person', w, 64)
# band symbols (white, tinted in game), same order as SYMBOLS in render.ts
group('sym', 'AQ101 AQ102 AQ103 AQ104 AQ105 AQ106 AQ107 AQ108 AQ109 AQ110 AQ201 AQ202 AQ203 AQ204 AQ205 AQ206 AQ207 AQ208 AQ209 AQ210 AQ301 AQ302 AQ303 AQ304 AQ305 AQ306 AQ307 AQ308 AQ309 AQ310 AQ401 AQ402 AQ403 AQ404 AQ405 AQ406 AQ407 AQ408 AQ409 AQ410 AQ501 AQ502 AQ503 AQ504 AQ505 AQ506 AQ507 AQ508 AQ509 AQ510 AR101 AR102 AR103 AR104 AR105 AR106 AR107 AR108 AR109 AR110 AR201 AR202 AR203 AR204 AR205 AR206 AR207 AR208 AR209 AR210 AR301 AR302 AR303 AR304 AR305 AR306 AR307 AR308 AR309 AR310 AR401 AR402 AR403 AR404 AR405 AR406 AR407 AR408 AR409 AR410 AR501 AR502 AR503 AR504 AR505 AR506 AR507 AR508 AR509 AR510', 'symbol', 6, 64)


def resize(img: Image.Image, w: int, h: int) -> Image.Image:
    return img.convert('RGBa').resize((w, h), Image.LANCZOS).convert('RGBA')


def corner_y(a: np.ndarray) -> float:
    """Row of the left and right corners of an isometric tile (where it is widest)."""
    m = a[..., 3] > 0
    left = np.nonzero(m[:, :4].any(1))[0]
    right = np.nonzero(m[:, -4:].any(1))[0]
    return (left.min() + right.min()) / 2


def top_only(img: Image.Image, cy: float) -> Image.Image:
    """Only the top diamond of a tile, without the side wall: used where the tile in front is not lower,
    so no wall can peek out between neighbours and the ground looks seamless.
    The darker rim along the front edges is replaced by colours from inside the tile, so it does not
    show as a grid line under the uneven back edge of the next tile."""
    a = np.array(img).astype(np.float32)
    h, w = a.shape[:2]
    ys, xs = np.mgrid[0:h, 0:w]
    edge = cy + (w / 4) * (1 - np.abs(xs - w / 2) / (w / 2))
    inner = (ys < edge - 7) & (a[..., 3] > 200)
    # average colour of the nearby inside, by a masked blur
    rgbm = np.dstack([a[..., :3] * inner[..., None], inner * 255.0]).astype(np.uint8)
    blur = np.array(Image.fromarray(rgbm, 'RGBA').filter(ImageFilter.GaussianBlur(7))).astype(np.float32)
    mean = a[..., :3][inner].mean(0)
    k = np.clip(blur[..., 3:4] / 40, 0, 1)
    fill = (blur[..., :3] / np.maximum(blur[..., 3:4], 1) * 255) * k + mean * (1 - k)
    t = np.clip((ys - (edge - 9)) / 6, 0, 1)[..., None]  # 0 inside -> 1 at the edge
    band = (ys > edge - 9) & (xs >= 0)
    out = a.copy()
    out[..., :3] = np.where(band[..., None], a[..., :3] * (1 - t) + fill * t, a[..., :3])
    # soften the light rim along the back edges too, keeping the uneven outline of the grass
    top_edge = cy - (w / 4) * (1 - np.abs(xs - w / 2) / (w / 2))
    tb = (np.clip(1 - (ys - top_edge) / 8, 0, 1) * 0.65 * (ys > top_edge - 8))[..., None]
    out[..., :3] = out[..., :3] * (1 - tb) + fill * tb
    out[..., 3] = np.where(band, 255, a[..., 3])
    # cut below the front edges, keeping some overlap so no gap shows when zoomed out
    out[ys > edge + 6, 3] = 0
    out[ys < edge - 9, 3] = a[ys < edge - 9, 3]
    # stray wall pixels at the left/right corners
    out[(np.abs(xs - w / 2) > w / 2 - 7) & (ys < edge - 2), 3] = 0
    out[out[..., 3] == 0, :3] = 0
    return Image.fromarray(out.astype(np.uint8))


def split_cloth(img: Image.Image, head: float, bright: float = 0.45, satmax: float = 0.2, upto: float = 1.0) -> tuple[Image.Image, Image.Image]:
    """Light grey/white cloth -> separate grey layer; the rest stays in the base. Only rows from head to upto (share of the height)."""
    a = np.array(img).astype(np.float32)
    rgb = a[..., :3] / 255
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    cloth = (sat < satmax) & (mx > bright) & (a[..., 3] > 0)
    cloth[: int(a.shape[0] * head)] = False
    cloth[int(a.shape[0] * upto):] = False
    base = a.copy()
    base[cloth, 3] = 0
    c = np.zeros_like(a)
    lum = rgb.mean(-1)
    # stretch so the brightest cloth is white: tint then gives the real band colour
    top = np.percentile(lum[cloth], 95) if cloth.any() else 1
    g = np.clip(lum / max(top, 1e-3), 0, 1) * 255
    c[..., 0] = c[..., 1] = c[..., 2] = g
    c[..., 3] = np.where(cloth, a[..., 3], 0)
    return Image.fromarray(base.astype(np.uint8)), Image.fromarray(c.astype(np.uint8))


def keep_fish(img: Image.Image, base: Image.Image, cloth: Image.Image) -> tuple[Image.Image, Image.Image]:
    """Silver fish and water foam are as pale as the clothes, but bluish: they go back to the base layer."""
    o = np.array(img).astype(np.int16)
    b, c = np.array(base), np.array(cloth)
    blue = (o[..., 2] > o[..., 0] + 8) & (c[..., 3] > 0)
    b[blue] = o[blue].astype(np.uint8)
    c[blue, 3] = 0
    return Image.fromarray(b), Image.fromarray(c)


def split_fur(img: Image.Image, head: float) -> tuple[Image.Image, Image.Image]:
    """Sheets AB-AE draw the clothes as cream fur: that fur -> a separate grey layer for the band colour."""
    a = np.array(img).astype(np.float32)
    rgb = a[..., :3] / 255
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    d = np.maximum(mx - mn, 1e-6)
    hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    # warm, pale, a little saturated: fur; white hair and beards (sat < 0.12) and skin (sat > 0.45) stay
    fur = (sat > 0.12) & (sat < 0.45) & (mx > 0.45) & (hue > 20) & (hue < 60) & (a[..., 3] > 0)
    fur[: int(a.shape[0] * head)] = False
    base = a.copy()
    base[fur, 3] = 0
    c = np.zeros_like(a)
    lum = rgb.mean(-1)
    top = np.percentile(lum[fur], 95) if fur.any() else 1
    gr = np.clip(lum / max(top, 1e-3), 0, 1) * 255
    c[..., 0] = c[..., 1] = c[..., 2] = gr
    c[..., 3] = np.where(fur, a[..., 3], 0)
    return Image.fromarray(base.astype(np.uint8)), Image.fromarray(c.astype(np.uint8))


# roads (sheets AK dirt, AL paved): only the road is kept, as an overlay on any ground.
# mask bits: 1 = -x (upper-left edge), 2 = -y (upper-right), 4 = +x (lower-right), 8 = +y (lower-left)
ROAD_SHEETS = (('AK', 1), ('AL', 2))
ROAD_CELLS = {5: '11', 10: '12', 15: '13', 4: '14', 6: '22', 9: '24', 14: '31', 13: '32', 8: '41', 1: '42', 2: '43'}
ROAD_ENDS = {1: '42', 2: '43', 4: '14', 8: '41'}


def road_overlay(img: Image.Image, cy: float) -> Image.Image:
    t = np.array(top_only(img, cy)).astype(np.float32)
    rgb = t[..., :3] / 255
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = np.maximum(mx - mn, 1e-6)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    grass = (hue > 62) & (hue < 170) & (sat > 0.2)
    road = (t[..., 3] > 200) & ~grass
    m = Image.fromarray((road * 255).astype(np.uint8))
    m = m.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(5))  # flowers and pebbles out
    m = m.filter(ImageFilter.GaussianBlur(0.8))
    out = t.copy()
    out[..., 3] = np.minimum(np.array(m).astype(np.float32), t[..., 3])
    out[out[..., 3] == 0, :3] = 0
    return Image.fromarray(out.astype(np.uint8))


def road_frames() -> list:
    items = []
    for sheet, lvl in ROAD_SHEETS:
        if not all(os.path.exists(os.path.join(CUT, f'{sheet}{c}.png')) for c in list(ROAD_CELLS.values()) + ['44']):
            continue
        over = {}
        geo = None
        for key, c in list(ROAD_CELLS.items()) + [('bridge', '44')]:
            src = Image.open(os.path.join(CUT, f'{sheet}{c}.png')).convert('RGBA')
            a = np.array(src)
            w0, h0 = src.size
            h = max(1, round(h0 * 128 / w0))
            img = resize(src, 128, h)
            ay = corner_y(a) / h0
            over[key] = (road_overlay(img, ay * h), ay)
            if geo is None:
                geo = (ay, (TW + 3) / 128, h)
        ay, s, h = geo
        for mask in range(1, 16):
            if mask in over:
                im, a_y = over[mask]
                items.append((f'road{lvl}_{mask}', im, 0.5, a_y, s))
                continue
            # no drawn tile for this shape: the dead ends of its edges meet in the middle
            im = Image.new('RGBA', (128, h), (0, 0, 0, 0))
            for bit in (1, 2, 4, 8):
                if mask & bit:
                    e = over[bit][0]
                    im.alpha_composite(e.crop((0, 0, 128, h)) if e.size[1] >= h else e, (0, 0))
            items.append((f'road{lvl}_{mask}', im, 0.5, ay, s))
        im, a_y = over['bridge']
        items.append((f'bridge{lvl}', im, 0.5, a_y, s))
    return items


GROUND_CELL, GROUND_GUT = 96, 4  # square texture per ground tile, with an edge-copied gutter
GROUND_COLS = 10


def ground_square(src: Image.Image) -> Image.Image:
    """The top diamond of a ground tile unwarped into a square: u runs from the top corner to the right one,
    v from the top corner to the left one. The game lays these squares over its sloped height mesh."""
    a = np.array(src)
    m = a[..., 3] > 0
    w = src.size[0]
    cy = corner_y(a)
    mid = m[:, w // 2 - 3:w // 2 + 4].any(1)
    t = float(np.nonzero(mid)[0].min())
    c = np.array([w / 2, cy])
    k = 0.95  # stay inside the diamond, away from its soft outline
    q = [c + (np.array(pt) - c) * k for pt in ((w / 2, t), (0, cy), (w / 2, 2 * cy - t), (w, cy))]
    inner = GROUND_CELL - 2 * GROUND_GUT
    img = np.array(src.convert('RGB').transform((inner, inner), Image.QUAD, tuple(float(v) for pt in q for v in pt), Image.BICUBIC)).astype(np.float32)
    # make it tile: towards its edges the square fades into itself shifted by half, so the edges of
    # neighbouring squares show the same (middle) part of the picture and meet without a seam
    t = (np.arange(inner) + 0.5) / inner
    e = np.clip(np.minimum(t, 1 - t) / 0.3, 0, 1)
    e = e * e * (3 - 2 * e)
    m = np.minimum(e[:, None], e[None, :])[..., None]
    img = img * m + np.roll(img, (inner // 2, inner // 2), (0, 1)) * (1 - m)
    return Image.fromarray(np.pad(img.round().astype(np.uint8), ((GROUND_GUT,) * 2, (GROUND_GUT,) * 2, (0, 0)), mode='edge'))


def ground_page() -> dict:
    names = []
    for prefix, ids, kind, _world, _tex in GROUPS:
        if kind != 'tile' or prefix == 'trod' or not all(os.path.exists(os.path.join(CUT, f'{c}.png')) for c in ids):
            continue
        for k, cid in enumerate(ids):
            names.append((prefix if len(ids) == 1 else f'{prefix}{k}', cid))
    rows = (len(names) + GROUND_COLS - 1) // GROUND_COLS
    size = 1
    while size < max(GROUND_COLS, rows) * GROUND_CELL:
        size *= 2
    page = Image.new('RGB', (size, size))
    index = {}
    for n, (name, cid) in enumerate(names):
        x, y = (n % GROUND_COLS) * GROUND_CELL, (n // GROUND_COLS) * GROUND_CELL
        page.paste(ground_square(Image.open(os.path.join(CUT, f'{cid}.png')).convert('RGBA')), (x, y))
        index[name] = [x + GROUND_GUT, y + GROUND_GUT, GROUND_CELL - 2 * GROUND_GUT]
    page.save(os.path.join(OUT, 'ground.webp'), 'WEBP', quality=90, method=5)
    print(f'ground.webp: {len(index)} squares')
    return {'file': 'ground.webp', 'size': [size, size], 'cells': index}


def main() -> int:
    items = []  # (name, image, ax, ay, s)
    for prefix, ids, kind, world, tex in GROUPS:
        if not all(os.path.exists(os.path.join(CUT, f'{c}.png')) for c in ids):
            continue  # sheet not made yet
        for k, cid in enumerate(ids):
            name = prefix if len(ids) == 1 else f'{prefix}{k}'
            src = Image.open(os.path.join(CUT, f'{cid}.png')).convert('RGBA')
            a = np.array(src)
            w0, h0 = src.size
            if kind == 'person':
                h = tex
                w = max(1, round(w0 * h / h0))
                s = world / h
            elif kind in ('pose', 'thing'):
                # world units per sheet pixel: the sheet keeps its own sizes between cells
                ww = w0 * world
                w = max(1, round(ww * (5.6 if kind == 'pose' else 10 if cid[:2] == 'DJ' else 4.6)))
                h = max(1, round(h0 * w / w0))
                s = ww / w
            elif kind == 'grow':
                ww = w0 * world * GROW_BOOST.get(cid[:2], 1)
                w = max(1, round(ww * GROW_TEX))
                h = max(1, round(h0 * w / w0))
                s = ww / w
            elif kind == 'animal4':
                # the width of the first frame sets the scale, so legs and tails stretching out do not change the size
                first = Image.open(os.path.join(CUT, f'{ids[0]}.png')).size[0]
                w = max(1, round(w0 * tex / first))
                h = max(1, round(h0 * w / w0))
                s = world / tex
            else:
                w = tex
                h = max(1, round(h0 * w / w0))
                s = world / w
            if kind == 'tile':
                ay = corner_y(a) / h0
            elif kind == 'person':
                ay = 0.97
            elif kind == 'symbol':
                ay = 0.5
            elif kind in ('animal', 'animal4'):
                ay = 0.96
            elif kind == 'pose':
                ay = 0.95
            else:
                # foot of a prop: the middle of its grass patch, about 8% of the width above the bottom
                ay = max(0.5, 1 - 0.08 * w0 / h0)
                if cid[:2] == 'CH' and cid[:4] not in ('CH41', 'CH42'):
                    ay = 0.9  # cars, buses, planes, the helicopter and the truck have no ground patch under them
                if cid[:2] == 'DJ':
                    ay = 0.93  # the heroes stand on nothing
                if cid[:2] in ('DD', 'DE', 'DF', 'DG', 'DH', 'DI'):
                    ay = 0.85  # wall pieces stand on the tile edge, no patch under them
                if cid[:2] in ('DB', 'DC') and cid[:4] not in ('DB13',):
                    ay = 0.9  # Mars: machines, rocks and rockets stand on the bare ground, no patch under them
                if cid[:2] == 'DA':
                    ay = max(0.5, 1 - 0.12 * w0 / h0)  # the domes' round base: its middle is a little higher
            if kind == 'symbol':
                a[..., :3] = 255  # black silhouettes -> white, tinted in game
                src = Image.fromarray(a)
            img = resize(src, w, h)
            if kind == 'tile':
                items.append((name, img, 0.5, ay, s))
                items.append((name + '_t', top_only(img, ay * h), 0.5, ay, s))
                continue
            if (kind == 'person' and cid[:2] in ('CA', 'CB', 'CC', 'CD', 'CR', 'CY', 'CZ')) or (kind == 'pose' and cid[:2] in ('CP', 'CQ', 'DC')):
                # today and the future: white clothes stay white, only the collar takes the clan colour
                kid = cid[:2] in ('CB', 'CD', 'CZ') and cid[2] in '123'
                base, cloth = split_cloth(img, 0.36 if kid else 0.25, upto=0.47 if kid else 0.36)
                items.append((name, base, 0.5, ay, s))
                items.append((name + '_c', cloth, 0.5, ay, s))
                continue
            if kind == 'pose' and cid[:2] in ('CU', 'CV', 'CW', 'CX'):
                # later fishing and boats: CU/CV keep their own shaded colours (a tint only came out in patches);
                # CW tints only the collar, like the other sheets of today; the rowing boat the shirt; the motorboat stays white
                if cid[:3] in ('CX3', 'CX4') or cid[:2] in ('CU', 'CV'):
                    items.append((name, img, 0.5, ay, s))
                    continue
                base, cloth = (split_cloth(img, 0.25, upto=0.36) if cid[:2] == 'CW'
                               else split_cloth(img, 0.15, 0.6, upto=0.6) if cid[:2] == 'CX'
                               else split_cloth(img, 0.28, 0.66, upto=0.78))
                base, cloth = keep_fish(img, base, cloth)
                items.append((name, base, 0.5, ay, s))
                items.append((name + '_c', cloth, 0.5, ay, s))
                continue
            if kind == 'pose' and cid[:2] in ('AB', 'AC', 'AD', 'AE', 'CS', 'CT'):
                # sleeping people lie down (no head on top); the storyteller's long beard reaches half way down
                head = 0 if cid[:3] in ('AC1', 'AC2') else 0.55 if cid[:2] == 'AD' else 0.3
                base, cloth = split_fur(img, head)
                items.append((name, base, 0.5, ay, s))
                items.append((name + '_c', cloth, 0.5, ay, s))
                continue
            if kind == 'pose' and cid[:2] in ('AI', 'AJ', 'AV', 'AW', 'BB', 'BC', 'BI', 'BJ', 'BP', 'BQ', 'CI', 'CJ'):
                # bronze age linen: only the bright cloth is tinted (grey anvils and stones stay)
                head = {'AI3': 0.35, 'AJ2': 0.35, 'AJ4': 0.0, 'AW2': 0.0, 'AV3': 0.35, 'BB1': 0.35, 'BB4': 0.35, 'BC2': 0.0, 'BJ1': 0.0, 'BI2': 0.35, 'BI3': 0.35, 'BQ1': 0.0, 'BQ2': 0.0, 'BQ4': 0.0}.get(cid[:3], 0.28)
                base, cloth = split_cloth(img, head, 0.66)
                items.append((name, base, 0.5, ay, s))
                items.append((name + '_c', cloth, 0.5, ay, s))
                continue
            if kind == 'person' and cid[:2] in ('AN', 'AO', 'AX', 'BD', 'BK', 'BR', 'CK'):
                # guards: only the light tunic takes the clan colour, the grey wolf fur and the metal stay
                base, cloth = split_fur(img, 0.3) if cid[:2] == 'AN' else split_cloth(img, 0.3, 0.72, 0.3)
                items.append((name, base, 0.5, ay, s))
                items.append((name + '_c', cloth, 0.5, ay, s))
                continue
            if kind in ('person', 'cloth'):
                base, cloth = split_cloth(img, head=0.48 if cid == 'I13' else 1.0 if (cid[0] in 'STUV' and cid[1].isdigit()) else 0.3 if kind == 'person' else 0)
                items.append((name, base, 0.5, ay, s))
                items.append((name + '_c', cloth, 0.5, ay, s))
            else:
                items.append((name, img, 0.5, ay, s))

    items += road_frames()

    # shelf packing, tallest first; a new page (atlas1.webp, ...) when one is full.
    # The first page keeps the sheets it always had, so the order of GROUPS decides what goes where.
    frames = {}
    pages = []
    os.makedirs(OUT, exist_ok=True)
    rest = items
    while rest:
        rest.sort(key=lambda it: -it[1].size[1])
        atlas = Image.new('RGBA', (ATLAS, ATLAS), (0, 0, 0, 0))
        x = y = PAD
        shelf = 0
        bottom = 0
        left = []
        for name, img, ax, ay, s in rest:
            w, h = img.size
            if x + w + PAD > ATLAS:
                x = PAD
                y += shelf + PAD
                shelf = 0
            if y + h + PAD > ATLAS:
                left.append((name, img, ax, ay, s))
                continue
            atlas.paste(img, (x, y))
            frames[name] = {'x': x, 'y': y, 'w': w, 'h': h, 'ax': ax, 'ay': round(ay, 4), 's': round(s, 5), 'p': len(pages)}
            x += w + PAD
            shelf = max(shelf, h)
            bottom = max(bottom, y + h)
        used = bottom + PAD
        # keep the height a power of two so mipmaps work everywhere
        height = 1
        while height < used:
            height *= 2
        # WebP: about a third of the PNG, so the page opens much faster; the edges (alpha) stay lossless
        fname = 'atlas.webp' if not pages else f'atlas{len(pages)}.webp'
        atlas.crop((0, 0, ATLAS, height)).save(os.path.join(OUT, fname), 'WEBP', quality=90, method=5, alpha_quality=100)
        pages.append({'file': fname, 'size': [ATLAS, height]})
        print(f'page {fname}: {len(rest) - len(left)} frames, used {used} rows')
        if len(left) == len(rest):
            print('a sprite does not fit on an empty page', file=sys.stderr)
            return 1
        rest = left
    with open(os.path.join(OUT, 'atlas.json'), 'w', encoding='utf-8') as f:
        json.dump({'size': pages[0]['size'], 'pages': pages, 'ground': ground_page(), 'frames': dict(sorted(frames.items()))}, f, separators=(',', ':'))
    print(f'{len(frames)} frames on {len(pages)} pages')
    return 0


if __name__ == '__main__':
    sys.exit(main())
