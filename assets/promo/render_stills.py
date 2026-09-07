"""Blender cinematics using the game's GLB assets. Run in background Blender."""
import bpy, math, random
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/promo/stills'
random.seed(23)

def mat(name, color, metal=0, rough=.5, emission=0):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal
    p.inputs['Roughness'].default_value=rough
    p.inputs['Emission Color'].default_value=(*color,1)
    p.inputs['Emission Strength'].default_value=emission
    return m

def sphere(name, loc, scale, material, segments=32):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=16,location=loc)
    o=bpy.context.object; o.name=name; o.scale=scale; o.data.materials.append(material)
    for p in o.data.polygons:p.use_smooth=True
    return o

def light(loc, target, power, color, size=10):
    d=bpy.data.lights.new('Cinematic softbox','AREA'); d.energy=power; d.color=color; d.shape='DISK'; d.size=size
    o=bpy.data.objects.new(d.name,d); bpy.context.collection.objects.link(o); o.location=loc
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()

def line(points, radius, material, name='Trail'):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.bevel_depth=radius; c.bevel_resolution=2
    s=c.splines.new('POLY'); s.points.add(len(points)-1)
    for p,v in zip(s.points,points):p.co=(*v,1)
    o=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(o); o.data.materials.append(material)
    return o

def model(name, pos=(0,0,0), angle=0, scale=1):
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/f'public/models/{name}.glb'))
    objects=set(bpy.data.objects)-before
    root=bpy.data.objects.new(name+' cinematic rig',None); bpy.context.collection.objects.link(root)
    for o in objects:
        if o.parent not in objects:o.parent=root
    root.location=pos; root.rotation_euler.z=angle; root.scale=(scale,)*3
    return root

def boss(pos=(0,0,0), broken=False):
    x,y,z=pos
    hull=mat('Disc armor',(.038,.07,.077),.7,.4)
    sphere('Disc pressure hull',pos,(28,28,7),hull)
    sphere('Upper command section',(x,y,z+4.2),(9,9,3),hull)
    bpy.ops.mesh.primitive_torus_add(major_radius=26,minor_radius=1.1,major_segments=80,minor_segments=12,location=pos)
    bpy.context.object.data.materials.append(hull)
    red=mat('Hostile ports',(1,.085,.025),.1,.3,6)
    for i in range(6):
        a=i*math.tau/6
        sphere('Launch port',(x+math.cos(a)*25,y+math.sin(a)*25,z),(.7,.7,.7),red,16)
    if broken:
        fire=mat('Explosion core',(1,.3,.035),0,.5,9)
        for i in range(12):
            p=(x+random.uniform(-16,16),y+random.uniform(-16,16),z+random.uniform(0,9))
            sphere('Blooming impact',p,(random.uniform(1,4),)*3,fire,20)
        light((x,y,z+10),pos,22000,(1,.22,.03),20)

shots=[
    ('ryuou',(14,-18,7),(0,0,.4),0),
    ('ryuou',(11,15,6),(0,0,.3),1),
    ('ryuou',(4,-19,5),(0,3,.5),2),
    ('ryuou',(13,8,18),(0,0,0),3),
    ('taigei',(10,12,5),(0,0,.2),4),
    ('taigei',(18,20,14),(0,1,0),5),
    ('ryuou',(15,11,6),(0,5,0),6),
    ('ryuou',(18,9,3),(0,7,0),7),
    ('ryuou',(-12,-14,9),(0,0,0),8),
    ('corback',(10,14,7),(0,0,.4),9),
    ('boss',(55,-70,35),(0,0,0),10),
    ('boss',(65,40,35),(0,0,0),11),
    ('boss',(55,-50,28),(0,0,0),12),
    ('fleet',(20,23,12),(0,0,0),13),
    ('ryuou',(16,-25,10),(0,0,.5),14),
]

for name,cam,target,index in shots:
    if index not in (0,3,5,6,9,10,14):continue
    path=OUT/f'{index:02}.png'
    if path.exists():
        print('EXISTS',index,flush=True);continue
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    scene=bpy.context.scene
    world=bpy.data.worlds.new(f'Abyss {index}');world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.008,.024,.032,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.45;scene.world=world
    rock=mat('Glacial rock',(.015,.055,.069),.2,.8)
    ice=mat('Blue ice',(.07,.18,.22),.1,.35)
    cyan=mat('Sonar teal',(.08,.85,.65),.1,.4,3)
    scale=4 if name=='boss' else 1
    if name=='boss':
        boss(broken=index==12);model('ryuou',(12,-38,-6),.25,.85)
    elif name=='fleet':
        model('ryuou',(-4,1,0));model('corback',(4,-2,-.5))
    else:model(name)
    if index==5:
        model('taigei',(-5,-4,-2),.15);model('taigei',(5,4,1),-.2)
    # Seafloor and distant ice pillars give depth without obscuring the hero.
    bpy.ops.mesh.primitive_plane_add(size=400,location=(0,0,-7*scale))
    bpy.context.object.data.materials.append(rock)
    for i in range(15):
        x=random.choice([-1,1])*random.uniform(13,36)*scale
        y=random.uniform(-12,45)*scale
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,y,random.uniform(-2,7)*scale))
        o=bpy.context.object;o.scale=(random.uniform(2,5)*scale,random.uniform(2,7)*scale,random.uniform(7,18)*scale)
        o.data.materials.append(ice)
    if index in (3,5):
        for r in (5,9,14):
            line([(r*math.cos(a*math.tau/96),r*math.sin(a*math.tau/96),-.5) for a in range(97)],.025,cyan,'Sonar wave')
    if index in (6,7,11):
        for j in range(3 if index==11 else 2):
            x=(j-1)*3+(12 if index==11 else 0)
            y= (-25+j*8) if index==11 else 10+j*4
            sphere('Torpedo',(x,y,-.4),( .15,1,.15),mat('Torpedo alloy',(.22,.35,.36),.6,.3))
            line([(x+.4*math.sin(t*.3),y-t,-.4) for t in range(1,12)],.06,cyan,'Torpedo wake')
    if index==8:
        for i in range(6):
            sphere('Decoy',(random.uniform(-4,4),random.uniform(-8,-4),random.uniform(-1,2)),(.10,)*3,cyan,12)
    light((8*scale,5*scale,13*scale),(0,0,0),2400*scale*scale,(.57,.8,1),12*scale)
    light((-8*scale,-8*scale,6*scale),(0,0,0),3000*scale*scale,(.12,.75,.69),10*scale)
    light((0,13*scale,9*scale),(0,0,0),3500*scale*scale,(.52,.65,1),9*scale)
    if index in (6,7,11,12):light((10,-5,4),(0,0,0),1600*scale,(1,.28,.08),8)
    camera_data=bpy.data.cameras.new('Promo camera');camera=bpy.data.objects.new('Promo camera',camera_data)
    bpy.context.collection.objects.link(camera);camera.location=cam
    camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    camera_data.lens=42;scene.camera=camera
    scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.render.resolution_x=1600;scene.render.resolution_y=900;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(path)
    scene.view_settings.view_transform='AgX'
    scene.use_nodes=True;nodes=scene.node_tree.nodes;nodes.clear()
    rl=nodes.new('CompositorNodeRLayers');glow=nodes.new('CompositorNodeGlare');glow.glare_type='FOG_GLOW';glow.quality='MEDIUM';glow.threshold=1.5
    out=nodes.new('CompositorNodeComposite');scene.node_tree.links.new(rl.outputs['Image'],glow.inputs['Image']);scene.node_tree.links.new(glow.outputs['Image'],out.inputs['Image'])
    bpy.ops.render.render(write_still=True)
    print('SHOT_DONE',index,flush=True)
