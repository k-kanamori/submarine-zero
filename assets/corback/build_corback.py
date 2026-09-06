"""Corback II study from http://noboland.web.fc2.com/corback.htm.

Run in Blender. Creates a NEW scene, preserving the current project.
Bow is +Y, up is +Z; glTF converts these to -Z and +Y respectively.
"""
import bpy
import bmesh
import math
from mathutils import Vector, Matrix

scene = bpy.data.scenes.new('Corback II • Model')
bpy.context.window.scene = scene
collection = bpy.data.collections.new('Corback • Editable parts')
scene.collection.children.link(collection)
parts = []

def material(name, color, metal=0.5, rough=0.32, emission=0):
    mat = bpy.data.materials.new('Corback | ' + name)
    mat.use_nodes = True
    rgb = [int(color[i:i+2], 16) / 255 for i in (1, 3, 5)]
    mat.diffuse_color = tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055)**2.4 for v in rgb) + (1,)
    node = mat.node_tree.nodes['Principled BSDF']
    node.inputs['Base Color'].default_value = mat.diffuse_color
    node.inputs['Metallic'].default_value = metal
    node.inputs['Roughness'].default_value = rough
    if emission:
        node.inputs['Emission Color'].default_value = mat.diffuse_color
        node.inputs['Emission Strength'].default_value = emission
    return mat

blue = material('Blue fleet enamel', '#356A9E', .62)
edge = material('Blue raised panels', '#5686AD', .58)
dark = material('Recessed vents and turbine', '#101E2B', .35, .45)
steel = material('Silver alloy', '#A6B9C4', .75, .27)
white = material('Fleet markings', '#E4EDEB', .15, .4)
lamp = material('Searchlight glass', '#C1F3FF', .1, .25, 2.5)

def register(obj, name, mat):
    obj.name = name
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    obj.data.materials.append(mat)
    parts.append(obj)
    return obj

def mesh(name, vertices, faces, mat, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    obj.data.materials.append(mat)
    for face in data.polygons:
        face.use_smooth = smooth
    parts.append(obj)
    return obj

def hull(name, stations, mat, center=(0, 0), sides=32):
    # Cross sections are (longitudinal Y, radius). Straight conical bow is
    # deliberate: the reference has a rocket silhouette, not a blunt nose.
    vertices = [(center[0] + r*math.cos(i*math.tau/sides), y,
                 center[1] + r*math.sin(i*math.tau/sides))
                for y, r in stations for i in range(sides)]
    faces = [(j*sides+i, (j+1)*sides+i, (j+1)*sides+(i+1)%sides, j*sides+(i+1)%sides)
             for j in range(len(stations)-1) for i in range(sides)]
    faces += [tuple(reversed(range(sides))), tuple((len(stations)-1)*sides+i for i in range(sides))]
    return mesh(name, vertices, faces, mat, True)

def ellipsoid(name, position, scale, mat, segments=20, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=position)
    obj = register(bpy.context.object, name, mat)
    obj.scale = scale
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj

def fin(name, outline, offset, mat):
    n = len(outline)
    vertices = [tuple(Vector(p)+Vector(offset)*s) for s in (-.5,.5) for p in outline]
    faces = [tuple(reversed(range(n))), tuple(range(n,n*2))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    obj = mesh(name, vertices, faces, mat)
    bevel = obj.modifiers.new('Rounded hydrofoil edges', 'BEVEL')
    bevel.width = .025
    bevel.segments = 2
    return obj

def ring(name, position, radius, thickness, mat):
    bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=thickness,
        major_segments=32, minor_segments=6, location=position, rotation=(math.pi/2,0,0))
    obj = register(bpy.context.object, name, mat)
    for face in obj.data.polygons:
        face.use_smooth = True
    return obj

body = hull('01 • Rocket pressure hull', [
    (6.2,.018),(6.02,.07),(5.55,.17),(4.8,.31),(3.8,.47),
    (2.8,.61),(1.7,.72),(.6,.78),(-.6,.80),(-1.8,.78),
    (-3.1,.73),(-4.2,.64),(-5.1,.52),(-5.65,.43),(-5.78,.39)], blue)

# Low dorsal fairing and tall forward sail. II has no sail-mounted planes.
ellipsoid('02 • Dorsal fairing', (0,1.6,.62), (.22,1.85,.23), blue)
fin('03 • Swept command sail', [(0,3.22,.49),(0,2.86,1.61),
    (0,2.31,1.70),(0,2.12,1.60),(0,2.25,.61)], (.28,0,0), blue)
ellipsoid('04 • Sail cap', (0,2.56,1.66), (.20,.43,.105), edge)
for y,z,r,h in [(2.53,1.84,.038,.3),(2.32,1.78,.025,.19)]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=r, depth=h, location=(0,y,z))
    register(bpy.context.object, '05 • Retractable mast', steel)
ellipsoid('06 • Periscope head', (0,2.50,1.99), (.07,.11,.045), dark, 12, 6)

# White hull number on both faces; lettering is geometry, requiring no textures.
for side in (-1,1):
    font = bpy.data.curves.new('Fleet number 1', 'FONT')
    font.body = '1'
    font.size = .44
    font.align_x = 'CENTER'
    font.align_y = 'CENTER'
    font.extrude = .001
    obj = bpy.data.objects.new('07 • Sail number 1', font)
    collection.objects.link(obj)
    obj.data.materials.append(white)
    obj.location = (side*.147,2.64,1.19)
    obj.rotation_euler = Matrix(((0,0,side),(side,0,0),(0,1,0))).to_euler()
    parts.append(obj)

# Four swept hydroplanes in an X, each carrying an aft-launching rocket pod.
for index in range(4):
    angle = math.pi/4 + index*math.pi/2
    dx,dz = math.cos(angle),math.sin(angle)
    outline = [(dx*r,y,dz*r) for r,y in [(.58,-2.95),(2.25,-4.93),(2.25,-5.63),(.54,-4.78)]]
    fin(f'08 • X tail plane {index+1}', outline, (-dz*.085,0,dx*.085), blue)
    x,z = dx*2.25,dz*2.25
    hull(f'09 • Aft rocket pod {index+1}', [(-4.16,.015),(-4.42,.10),(-4.75,.13),
        (-5.66,.13),(-5.9,.085),(-6.0,.055)], edge, (x,z), 16)
    ring(f'10 • Rocket nozzle rim {index+1}', (x,-5.94,z), .071,.017,steel)
    ellipsoid(f'10 • Rocket nozzle recess {index+1}', (x,-5.959,z),(.05,.018,.05),dark,12,6)

# Characteristic oval dorsal blisters and long lower flank fairings.
for side in (-1,1):
    ellipsoid('11 • Dorsal equipment blister', (side*.49,-1.26,.595),(.18,.72,.145),dark)
    ellipsoid('12 • Blister armored lid', (side*.49,-1.22,.638),(.145,.60,.10),blue)
    ellipsoid('13 • Lower flank fairing', (side*.63,-1.05,-.35),(.18,2.55,.15),edge,24,10)
    for i in range(18):
        y = 1.25 - i*.265
        radius = .71 if y > .6 else .76 if y > -2 else .69
        ellipsoid('14 • Flood vent', (side*radius,y,-.24),(.018,.077,.030),dark,8,4)
    # Three narrow recessed panel lines forward of the blisters.
    for y in (.88,1.02,1.16):
        fin('15 • Forward flank panel', [(side*.71,y,-.03),(side*.67,y,.27),
            (side*.67,y+.022,.27),(side*.71,y+.022,-.03)], (.012,0,0),dark)
    # Small five-point star and horizontal bars on the upper shoulder.
    center = Vector((side*.44,.85,.645))
    along = Vector((0,1,0))
    across = Vector((1,0,-side*.68)).normalized()
    star = [tuple(center + along*(math.cos(math.pi/2+i*math.pi/5)*(.11 if i%2==0 else .045))
        + across*(math.sin(math.pi/2+i*math.pi/5)*(.11 if i%2==0 else .045))) for i in range(10)]
    mesh('16 • Fleet star', star, [tuple(range(10))], white)
    for sign in (-1,1):
        c = center + across*.17*sign
        mesh('16 • Fleet star bar', [tuple(c+across*a+along*b) for a,b in [(-.045,-.022),(.045,-.022),(.045,.022),(-.045,.022)]],[(0,1,2,3)],white)

for y,r in [(3.8,.474),(1.7,.724),(-1.8,.784),(-3.1,.734)]:
    ring('17 • Hull section seam', (0,y,0),r,.009,steel)
for y,z in [(3.62,.50),(.02,.802),(-2.7,.752)]:
    ellipsoid('18 • Deck hatch', (0,y,z),(.09,.14,.028),steel,16,6)
    ellipsoid('18 • Hatch inset', (0,y,z+.022),(.035,.065,.012),dark,12,6)

# Recessed central stern turbine. Only its rotor moves in the game.
hull('19 • Stern turbine recess', [(-5.70,.385),(-5.82,.35)],dark)
ring('20 • Stern turbine rim',(0,-5.81,0),.345,.045,steel)
rotor_parts = []
rotor_parts.append(ellipsoid('Rotor hub',(0,-5.85,0),(.10,.12,.10),steel,16,8))
for i in range(5):
    a = i*math.tau/5
    points = []
    for r,theta,y in [(.08,a,-5.85),(.31,a+.45,-5.86),(.31,a+.88,-5.83),(.11,a+.7,-5.82)]:
        points.append((r*math.cos(theta),y,r*math.sin(theta)))
    rotor_parts.append(fin('Rotor blade',points,(0,.022,0),steel))
for obj in rotor_parts:
    obj['corback_rotor'] = True
for side in (-1,1):
    ellipsoid('21 • Bow searchlight', (side*.15,4.70,-.27),(.055,.08,.033),lamp,12,6)

# Resolve winding for all custom faces, including the two-sided insignia.
for obj in parts:
    if obj.type == 'MESH':
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data)
        bm.free()
print({'scene':scene.name,'editable_parts':len(parts)})
