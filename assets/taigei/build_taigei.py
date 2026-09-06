"""Build a Taigei-class visual study in Blender, preserving existing scenes.

Run this, then export_taigei.py. Bow +Y, up +Z; game bow -Z, up +Y.
The supplied reference is an exterior illustration, not engineering drawings.
"""
import bpy
import bmesh
import math

scene = bpy.data.scenes.new('Taigei • Model')
bpy.context.window.scene = scene
collection = bpy.data.collections.new('Taigei • Editable parts')
scene.collection.children.link(collection)

def material(name, rgb, metal, rough):
    mat = bpy.data.materials.new('Taigei | ' + name)
    mat.use_nodes = True
    mat.diffuse_color = (*rgb, 1)
    node = mat.node_tree.nodes['Principled BSDF']
    node.inputs['Base Color'].default_value = mat.diffuse_color
    node.inputs['Metallic'].default_value = metal
    node.inputs['Roughness'].default_value = rough
    return mat

rubber = material('Charcoal acoustic coating', (.035,.042,.046), .18, .58)
panel = material('Graphite fairings', (.048,.055,.058), .25, .48)
dark = material('Recesses and sonar dome', (.016,.022,.025), .1, .65)
steel = material('Mast hardware', (.22,.26,.28), .75, .3)
bronze = material('Screw bronze', (.28,.20,.075), .72, .34)

def mesh(name, verts, faces, mat, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    data.materials.append(mat)
    for p in data.polygons:
        p.use_smooth = smooth
    return obj

def loft(name, stations, mat, sides=48):
    # Each ring: longitudinal position, half-width, half-height, vertical center.
    verts = [(rx*math.cos(i*math.tau/sides), y, z+rz*math.sin(i*math.tau/sides))
             for y,rx,rz,z in stations for i in range(sides)]
    faces = [(j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i)
             for j in range(len(stations)-1) for i in range(sides)]
    faces += [tuple(reversed(range(sides))), tuple((len(stations)-1)*sides+i for i in range(sides))]
    return mesh(name, verts, faces, mat, True)

def foil(name, outline, offset, mat):
    n = len(outline)
    verts = [tuple(p[i]+s*offset[i] for i in range(3)) for s in (-.5,.5) for p in outline]
    faces = [tuple(reversed(range(n))), tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    obj = mesh(name,verts,faces,mat)
    bevel = obj.modifiers.new('Soft hydrofoil edges','BEVEL')
    bevel.width, bevel.segments = .016, 3
    normal = obj.modifiers.new('Weighted surface normals','WEIGHTED_NORMAL')
    return obj

def ellipsoid(name, location, scale, mat, segments=24, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=location)
    obj = bpy.context.object
    obj.name, obj.scale = name, scale
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth=True
    return obj

# Broad, rounded bow, almost parallel mid-body and a tapered single-shaft stern.
loft('01 • Rounded pressure hull', [
    (-4.78,.075,.075,0),(-4.52,.14,.14,0),(-4.15,.24,.24,0),
    (-3.7,.36,.35,0),(-3.1,.48,.46,0),(-2.5,.55,.53,0),
    (-1.7,.575,.555,0),(-.5,.58,.56,0),(1,.58,.56,0),
    (2.4,.575,.55,0),(3.2,.55,.53,0),(3.65,.50,.49,-.015),
    (4,.43,.43,-.035),(4.28,.32,.35,-.05),(4.47,.18,.23,-.055),
    (4.55,.015,.035,-.055)], rubber)
loft('02 • Low continuous upper deck', [
    (-3.9,.025,.025,.26),(-3.25,.21,.10,.43),(-2.6,.28,.10,.51),
    (-1,.30,.09,.54),(1.8,.30,.09,.54),(3,.25,.075,.52),
    (3.7,.13,.035,.44),(4,.015,.015,.37)], panel, 32)

# Rounded leading edge, broad flat sides and a gently sloped trailing edge.
loft('03 • Forward sail', [
    (.65,.03,.44,.96),(.76,.17,.45,.96),(.96,.20,.46,.97),
    (1.6,.20,.47,.98),(1.98,.18,.46,.97),(2.12,.12,.43,.94),
    (2.18,.025,.36,.88)], rubber, 32)
# The elliptical sections above are squared vertically to give the sail a flat cap.
sail = collection.objects['03 • Forward sail']
for v in sail.data.vertices:
    center = .96
    relative = (v.co.z-center)/.47
    v.co.z = center + math.copysign(abs(relative)**.32, relative)*.47
sail.data.update()

for side in (-1,1):
    foil('04 • Sail mounted diving plane',
         [(side*.16,1.9,.99),(side*.96,1.55,.99),
          (side*.92,1.28,.99),(side*.16,1.31,.99)], (0,0,.055), rubber)
    # Long low flank-array fairings, visible as subtle raised bands.
    ellipsoid('05 • Flank sonar array', (side*.551,.3,-.14), (.039,2.15,.115), panel, 24, 8)
    for y in (2.92,3.16,3.4):
        ellipsoid('06 • Bow tube shutter', (side*(.533-(y-2.92)*.07),y,.015),
                  (.018,.115,.048),dark,16,8)
    for y in (-2.6,-2.25,-1.9,-1.55,-1.2,-.85,-.5):
        ellipsoid('07 • Deck drainage slot',(side*.305,y,.543),(.012,.075,.024),dark,12,6)

for y,r,height in [(1.66,.026,.47),(1.23,.022,.30),(.97,.038,.18)]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=r,depth=height,location=(0,y,1.4+height/2))
    obj=bpy.context.object
    obj.name='08 • Retractable mast'
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    obj.data.materials.append(steel)
    ellipsoid('09 • Optronic mast head',(0,y,1.4+height),(.043,.055,.053),dark,16,8)
for y in (2.8,-1.4):
    ellipsoid('10 • Deck hatch',(0,y,.627),(.12,.16,.015),dark,20,8)

# Four diagonally arranged control surfaces: an X when viewed from astern.
for i in range(4):
    angle=math.pi/4+i*math.pi/2
    dx,dz=math.cos(angle),math.sin(angle)
    foil('11 • X stern rudder '+str(i+1),
         [(r*dx,y,r*dz) for r,y in [(.24,-3.82),(1.12,-4.05),(1.18,-4.55),(.15,-4.43)]],
         (-dz*.055,0,dx*.055),rubber)

rotor=loft('12 • Screw hub',[(-5.02,.018,.018,0),(-4.94,.075,.075,0),
                            (-4.74,.09,.09,0),(-4.68,.055,.055,0)],bronze,24)
rotor['taigei_rotor']=True
for i in range(7):
    angle=i*math.tau/7
    # Swept blades with a visible pitch, modeled as solid thin hydrofoils.
    outline=[]
    for r,a,y in [(.065,0,-4.79),(.28,.08,-4.79),(.49,.35,-4.86),
                  (.50,.61,-4.94),(.38,.69,-4.96),(.13,.30,-4.85)]:
        outline.append((r*math.cos(angle+a),y,r*math.sin(angle+a)))
    blade=foil('13 • Swept screw blade '+str(i+1),outline,(0,.022,0),bronze)
    blade['taigei_rotor']=True

print({'scene':scene.name,'editable_parts':len(collection.objects)})
