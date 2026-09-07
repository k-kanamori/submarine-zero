"""Blender MCP: reference study of docs/sample/uav01.jpg and uav02.jpg.
Creates its own scene. Bow +Y / up +Z; glTF bow -Z / up +Y.
"""
import bpy, bmesh, math
from mathutils import Vector
scene=bpy.data.scenes.new('Ash Wing • Editable')
bpy.context.window.scene=scene
parts=bpy.data.collections.new('Ash Wing • Parts');scene.collection.children.link(parts)
def mat(name,rgb,metal=.45,rough=.4):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*rgb,1)
    p=m.node_tree.nodes['Principled BSDF'];p.inputs['Base Color'].default_value=m.diffuse_color
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    return m
orange=mat('Ash Wing | Volcanic orange',(.55,.055,.014))
dark=mat('Ash Wing | Carbon spars',(.018,.026,.031),.6)
steel=mat('Ash Wing | Titanium',(.28,.34,.38),.8,.25)
black=mat('Ash Wing | Sonar windows',(.005,.01,.013),.15,.25)
def mesh(name,verts,faces,m,smooth=False):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
    o=bpy.data.objects.new(name,data);parts.objects.link(o);data.materials.append(m)
    for p in data.polygons:p.use_smooth=smooth
    return o
def ellipsoid(name,pos,scale,m):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=pos)
    o=bpy.context.object;o.name=name;o.scale=scale
    for c in list(o.users_collection):c.objects.unlink(o)
    parts.objects.link(o);o.data.materials.append(m)
    for p in o.data.polygons:p.use_smooth=True
    return o
def foil(name,outline,offset,m):
    n=len(outline);verts=[tuple(p[j]+s*offset[j] for j in range(3)) for s in (-.5,.5) for p in outline]
    faces=[tuple(reversed(range(n))),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    o=mesh(name,verts,faces,m);b=o.modifiers.new('Hydrodynamic edges','BEVEL');b.width=.16;b.segments=3
    o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return o
def spar(name,a,b,r,m):
    mid=(Vector(a)+Vector(b))/2;length=(Vector(b)-Vector(a)).length
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=r,depth=length,location=mid)
    o=bpy.context.object;o.name=name;o.rotation_euler=(Vector(b)-Vector(a)).to_track_quat('Z','Y').to_euler()
    for c in list(o.users_collection):c.objects.unlink(o)
    parts.objects.link(o);o.data.materials.append(m)
    for p in o.data.polygons:p.use_smooth=True
    return o
ellipsoid('01 Orange pressure pod',(0,3,0),(3.2,8.6,2.5),orange)
ellipsoid('02 Black nose sonar',(0,10.5,.3),(2.1,1.3,1.75),black)
foil('03 Planing keel',[(0,11,-.8),(0,7,-3.1),(0,-4,-2.6),(0,-5,0)],(2.8,0,0),orange)
for side in (-1,1):
    foil('04 Long straight main wing',[(side*.1,2.7,5),(side*27,1.4,5),
        (side*27,-.65,5),(side*24,-1.1,5),(side*.1,-2.1,5)],(0,0,.52),orange)
    x=side*7
    foil('05 Engine pylon',[(x,2.2,-.4),(x,1.6,4.9),(x,-1.6,4.9),(x,-2.8,-.3)],(.68,0,0),orange)
    ellipsoid('06 Pylon float',(x,.2,-.35),(1.45,4.3,1),orange)
    spar('07 Cross spar',(0,-.4,.3),(x,-.4,.3),.35,dark)
    spar('08 Twin tail boom',(x,-1.5,4.9),(x,-14.5,4.8),.35,dark)
    foil('09 Tail fin',[(x,-11,4.7),(x,-12.4,7.7),(x,-15.6,7.1),(x,-15.8,4.4)],(.48,0,0),dark)
    ellipsoid('10 Engine nacelle',(x,2,5),(1.1,2,1.1),dark)
    hub=ellipsoid('11 Propeller hub',(x,4,5),(.65,.7,.65),steel);hub['rotor']=side
    for i in range(3):
        angle=i*math.tau/3
        outline=[(x+r*math.cos(angle+a),4,5+r*math.sin(angle+a))
            for r,a in [(.4,0),(2.65,.04),(2.85,.24),(1.45,.4),(.4,.5)]]
        o=foil('12 Three blade propeller',outline,(0,.16,0),dark);o['rotor']=side
    for y in (1,4):ellipsoid('13 Hull side sensor',(side*3.13,y,.1),(.08,.46,.46),black)
    spar('14 Bow torpedo tube',(side*1.6,6,-1.5),(side*1.6,10.9,-1.5),.4,dark)
    for y in (-.6,1.3):
        bpy.ops.mesh.primitive_torus_add(major_radius=2.65,minor_radius=.09,major_segments=32,minor_segments=6,
            location=(0,y,0),rotation=(math.pi/2,0,0))
        o=bpy.context.object;o.name='15 Pressure bands';o.scale.x=1.19
        for c in list(o.users_collection):c.objects.unlink(o)
        parts.objects.link(o);o.data.materials.append(steel)
foil('16 Horizontal tail', [(-7.3,-12.8,7.2),(7.3,-12.8,7.2),(7.3,-15,7.2),(-7.3,-15,7.2)],(0,0,.4),orange)
spar('17 Sensor mast',(0,4.5,2),(0,4.5,3.3),.12,dark)
ellipsoid('18 Sensor head',(0,4.5,3.3),(.3,.35,.2),steel)
print('Ash Wing modeled:',len(parts.objects),'editable parts')
