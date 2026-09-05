"""Editable, texture-free Ryuou study from the user's Blue Submarine No. 6 reference.

Run in Blender 4.5. Bow is +Y, up is +Z; glTF exports bow to the game's -Z.
Reference: http://blog.livedoor.jp/yoshikawa_amm/archives/2189583.html
Creates a separate scene; never deletes objects from the user's existing scene.
"""
import bpy
import bmesh
import math
from mathutils import Vector

scene = bpy.data.scenes.new('Ryuou • Model')
bpy.context.window.scene = scene
collection = bpy.data.collections.new('Ryuou • Editable parts')
scene.collection.children.link(collection)
parts = []

def linear_hex(hex_color):
    values = [int(hex_color[i:i+2], 16) / 255 for i in (1, 3, 5)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in values) + (1,)

def material(name, color, metal=0.35, roughness=0.36, emission=0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = linear_hex(color)
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = mat.diffuse_color
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = roughness
    if emission:
        bsdf.inputs['Emission Color'].default_value = mat.diffuse_color
        bsdf.inputs['Emission Strength'].default_value = emission
    return mat

purple = material('Ryuou | Violet ceramic hull', '#796784', 0.42, 0.32)
trim = material('Ryuou | Raised armor', '#A08DA9', 0.5, 0.3)
dark = material('Ryuou | Recesses', '#181B28', 0.28, 0.5)
metal = material('Ryuou | Turbine alloy', '#657989', 0.72, 0.28)
cyan = material('Ryuou | MHD blue', '#55CFFF', 0.05, 0.32, 4.0)
white = material('Ryuou | Searchlights', '#D8F7FF', 0.05, 0.25, 3.5)

def register(obj, name, mat):
    obj.name = name
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    obj.data.materials.append(mat)
    parts.append(obj)
    return obj

def mesh(name, vertices, faces, mat, smooth=True):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    obj.data.materials.append(mat)
    for poly in data.polygons:
        poly.use_smooth = smooth
    parts.append(obj)
    return obj

def hull(name, stations, mat, sides=24, steps=4):
    # Catmull-Rom cross sections: (Y, X-center, Z-center, X-radius, Z-radius).
    sections = []
    for i in range(len(stations) - 1):
        p0, p1 = stations[max(0, i-1)], stations[i]
        p2, p3 = stations[i+1], stations[min(len(stations)-1, i+2)]
        for step in range(steps):
            t = step / steps
            sections.append([0.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)
                             for a,b,c,d in zip(p0,p1,p2,p3)])
    sections.append(stations[-1])
    vertices = []
    for y,x,z,rx,rz in sections:
        for i in range(sides):
            angle = math.tau * i / sides
            vertices.append((x + max(0.015,rx)*math.cos(angle), y, z + max(0.015,rz)*math.sin(angle)))
    faces = []
    for row in range(len(sections)-1):
        for i in range(sides):
            j = (i+1) % sides
            faces.append((row*sides+i, (row+1)*sides+i, (row+1)*sides+j, row*sides+j))
    faces += [tuple(reversed(range(sides))), tuple((len(sections)-1)*sides+i for i in range(sides))]
    return mesh(name, vertices, faces, mat)

def ellipsoid(name, location, scale, mat, segments=20, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = register(bpy.context.object, name, mat)
    obj.scale = scale
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj

def line(name, points, radius, mat):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 8
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for point, co in zip(spline.bezier_points, points):
        point.co = co
        point.handle_left_type = point.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    obj.data.materials.append(mat)
    parts.append(obj)
    return obj

def fin(name, points, offset, mat):
    n = len(points)
    vertices = [tuple(Vector(p) + Vector(offset)*side) for side in (-0.5,0.5) for p in points]
    faces = [tuple(reversed(range(n))), tuple(range(n, 2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    obj = mesh(name, vertices, faces, mat)
    bevel = obj.modifiers.new('Soft hydrofoil edges', 'BEVEL')
    bevel.width = 0.045
    bevel.segments = 2
    return obj

# Whale-like central hull with a broad, blunt forebody and tapered aft spine.
hull('01 • Central pressure hull', [
    (5.95,0,0.0,0.025,0.025),(5.65,0,0.03,0.55,0.36),
    (4.9,0,0.0,1.02,0.69),(3.6,0,0.05,1.34,0.91),
    (1.9,0,0.12,1.30,1.05),(0.0,0,0.16,1.06,1.0),
    (-1.8,0,0.12,0.77,0.82),(-3.05,0,0.08,0.60,0.64),
    (-3.7,0,0.04,0.32,0.38)], purple)

# Upper/lower side lobes remain separated from the central hull aft of the bow.
upper_profile = [(3.9,0.87,0.07,0.05,0.07),(2.9,1.19,0.20,0.40,0.53),
    (1.25,1.72,0.35,0.66,0.84),(-0.7,2.03,0.35,0.72,0.90),
    (-2.6,2.12,0.24,0.63,0.78),(-4.25,1.90,0.05,0.62,0.51),
    (-5.30,1.43,-0.08,0.39,0.27),(-5.65,1.2,-0.09,0.025,0.025)]
lower_profile = [(3.7,0.86,-0.15,0.025,0.025),(2.7,1.22,-0.52,0.38,0.30),
    (1.0,1.73,-0.66,0.61,0.50),(-0.9,2.04,-0.69,0.65,0.54),
    (-2.8,2.08,-0.64,0.61,0.48),(-4.25,1.86,-0.45,0.55,0.33),
    (-5.35,1.35,-0.15,0.21,0.10),(-5.58,1.19,-0.10,0.025,0.025)]
for side, label in [(-1,'Port'),(1,'Starboard')]:
    for suffix, profile in [('upper',upper_profile),('lower',lower_profile)]:
        hull(f'02 • {label} {suffix} lobe', [(y,x*side,z,rx,rz) for y,x,z,rx,rz in profile], purple)
    slit = [(side*x,y,z) for x,y,z in [(1.35,3.25,-0.11),(1.85,2.45,-0.17),
        (2.41,1.05,-0.23),(2.75,-0.65,-0.23),(2.73,-2.2,-0.23),
        (2.53,-3.65,-0.22),(2.07,-4.85,-0.18)]]
    line(f'03 • {label} recessed MHD channel', slit, 0.100, dark)
    line(f'03 • {label} luminous MHD slit', [(x+side*0.065,y,z) for x,y,z in slit], 0.041, cyan)
    line(f'04 • {label} dorsal armor seam', [(side*x,y,z) for x,y,z in [
        (0.92,4.3,0.52),(1.38,2.65,0.78),(1.95,0.75,1.20),
        (2.24,-1.25,1.14),(2.18,-3.2,0.84)]], 0.021, dark)
    # Swept X-tail, with small illuminated extremities.
    fin(f'05 • {label} upper X rudder', [(side*1.8,-2.75,0.55),
        (side*3.04,-4.8,1.74),(side*3.1,-5.04,1.78),(side*2.44,-4.50,0.08)], (0.09*side,0,0), purple)
    fin(f'05 • {label} lower X rudder', [(side*1.72,-2.60,-0.68),
        (side*2.77,-4.65,-1.85),(side*2.82,-4.88,-1.88),(side*2.18,-4.55,-0.45)], (0.08*side,0,0), purple)
    ellipsoid(f'05 • {label} rudder light', (side*3.03,-4.83,1.73),(0.055,0.10,0.055),white,12,6)

# High dorsal/ventral spines are a defining part of the reference silhouette.
fin('06 • Dorsal sail', [(0,0.8,0.93),(0,-1.2,1.22),(0,-2.23,2.09),
    (0,-2.72,3.03),(0,-2.86,3.02),(0,-2.9,1.49),(0,-4.21,0.70)], (0.25,0,0), purple)
fin('06 • Ventral Grampus launch keel', [(0,0.20,-0.90),(0,-1.5,-1.13),
    (0,-2.95,-2.30),(0,-3.15,-2.31),(0,-2.9,-1.0),(0,-3.4,-0.55)], (0.22,0,0), purple)
ellipsoid('06 • Grampus bay hatch', (0,-1.45,-1.06),(0.36,0.72,0.10),dark)
ellipsoid('06 • Sail navigation light', (0,-2.71,2.97),(0.065,0.085,0.07),white,12,6)

# A curved rear bridge surrounds the open central contra-rotating propulsor.
line('07 • Aft bridge', [(-2.28,-4.38,0.12),(-1.62,-4.1,0.68),
    (-0.84,-4.00,1.14),(0,-3.94,1.31),(0.84,-4.0,1.14),
    (1.62,-4.1,0.68),(2.28,-4.38,0.12)], 0.16, purple)

def duct():
    vertices=[]
    # Outside and inside of a short ring duct, with rounded lips.
    sections=[(-3.64,1.06),(-3.86,1.22),(-4.35,1.26),(-4.52,1.19),
              (-4.52,1.03),(-4.35,1.06),(-3.86,1.02),(-3.64,0.93)]
    sides=48
    for y,r in sections:
        for i in range(sides):
            angle=math.tau*i/sides
            vertices.append((r*math.cos(angle),y,r*math.sin(angle)-0.1))
    faces=[]
    for row in range(len(sections)):
        for i in range(sides):
            j=(i+1)%sides
            faces.append((row*sides+i,((row+1)%len(sections))*sides+i,
                          ((row+1)%len(sections))*sides+j,row*sides+j))
    return mesh('08 • Open turbine duct',vertices,faces,trim)
duct()

def rotor(name,y,direction):
    vertices=[]
    faces=[]
    for blade in range(6):
        base=len(vertices)
        for radius, width, sweep in [(0.20,0.10,0),(0.50,0.19,0.23),(0.84,0.20,0.54),(0.99,0.10,0.70)]:
            for edge,depth in [(-1,-0.025),(1,-0.025),(1,0.025),(-1,0.025)]:
                angle=blade*math.tau/6+direction*(sweep+edge*width)
                vertices.append((radius*math.cos(angle),depth+direction*edge*0.06, radius*math.sin(angle)))
        for row in range(3):
            for k in range(4):
                faces.append((base+row*4+k,base+(row+1)*4+k,
                    base+(row+1)*4+(k+1)%4,base+row*4+(k+1)%4))
        faces.append(tuple(base+i for i in reversed(range(4))))
        faces.append(tuple(base+12+i for i in range(4)))
    obj=mesh(name,vertices,faces,metal)
    obj.location=(0,y,-0.1)
    return obj
rotor('Ryuou_Rotor_Front',-3.92,1)
rotor('Ryuou_Rotor_Rear',-4.28,-1)
ellipsoid('08 • Propulsor hub',(0,-4.12,-0.1),(0.25,0.46,0.25),metal)
for angle in [math.pi/2,7*math.pi/6,11*math.pi/6]:
    line('08 • Duct strut',[(0,-3.80,-0.1),(0.96*math.cos(angle),-3.80,0.96*math.sin(angle)-0.1)],0.045,dark)

# Bow launch doors, cheek sensors, paired downward-facing searchlights.
for side in (-1,1):
    for i in range(3):
        obj=ellipsoid('09 • Bow torpedo door',(side*(0.38+i*0.11),5.44-i*0.17,-0.07),
                      (0.105,0.035,0.16),dark,12,6)
        obj.rotation_euler[2]=side*0.25
    ellipsoid('09 • Lorenzini sensor',(side*0.91,4.1,0.50),(0.095,0.36,0.12),dark)
    ellipsoid('09 • Searchlight housing',(side*0.50,3.82,-0.78),(0.23,0.30,0.16),metal)
    ellipsoid('09 • Searchlight lens',(side*0.50,3.88,-0.90),(0.17,0.20,0.045),white,16,8)
    for i in range(5):
        ellipsoid('10 • Dorsal VLS hatch',(side*0.41,1.3-i*0.44,1.075-i*0.022),
                  (0.17,0.19,0.025),dark,12,6)
    # Side launcher pods, blended into the upper/lower lobes.
    for z in (0.72,-0.91):
        ellipsoid('10 • Side launcher fairing',(side*2.40,-1.15,z),(0.24,0.63,0.14),purple)
        for i in range(3):
            ellipsoid('10 • Launcher port',(side*2.58,-0.76-i*0.28,z),(0.025,0.085,0.065),dark,12,6)

for obj in parts:
    obj['asset'] = 'ryuou'
    if obj.type == 'MESH':
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data)
        bm.free()
scene['reference_url'] = 'http://blog.livedoor.jp/yoshikawa_amm/archives/2189583.html'
scene['description'] = 'Ryuou: five-lobe violet hull, open aft duct, contra-rotating turbine, blue MHD slits.'
bpy.ops.object.select_all(action='DESELECT')
for obj in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
print({'scene':scene.name,'editable_parts':len(parts),'materials':6})
