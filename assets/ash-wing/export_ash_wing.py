"""Run after build_ash_wing.py through Blender MCP."""
import bpy
from pathlib import Path
from mathutils import Vector
ROOT=Path('/Users/koji/Codex/submarine-zero')
source_scene=bpy.context.scene
source=next(c for c in source_scene.collection.children if c.name.startswith('Ash Wing • Parts'))
depsgraph=bpy.context.evaluated_depsgraph_get()
export_scene=bpy.data.scenes.new('Ash Wing • Game')
groups={0:[],-1:[],1:[]}
for obj in source.objects:
    data=bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
    clone=bpy.data.objects.new(obj.name+' runtime',data);clone.matrix_world=obj.matrix_world.copy()
    export_scene.collection.objects.link(clone);groups[int(obj.get('rotor',0))].append(clone)
bpy.context.window.scene=export_scene
for rotor,objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();o=bpy.context.object
    o.name='AshWing_Hull' if not rotor else ('AshWing_Rotor_Left' if rotor<0 else 'AshWing_Rotor_Right')
    export_scene.cursor.location=(rotor*7,4,5) if rotor else (0,0,0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR');bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    mats=[];slots=[]
    for m in o.data.materials:
        if m not in mats:mats.append(m)
        slots.append(mats.index(m))
    face_slots=[slots[p.material_index] for p in o.data.polygons];o.data.materials.clear()
    for m in mats:o.data.materials.append(m)
    for p,i in zip(o.data.polygons,face_slots):p.material_index=i
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/ash-wing.glb'),export_format='GLB',use_selection=True,
    use_active_scene=True,export_animations=False,export_cameras=False,export_lights=False,export_yup=True,export_texcoords=False)
print('GLB exported',sum(len(o.data.polygons) for o in export_scene.objects),'faces')
bpy.context.window.scene=source_scene
def area(pos,power,color,size):
    d=bpy.data.lights.new('Ash Wing preview light','AREA');d.energy=power;d.color=color;d.size=size
    o=bpy.data.objects.new(d.name,d);source_scene.collection.objects.link(o);o.location=pos
    o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
area((12,20,35),23000,(.8,.91,1),25)
area((-25,0,15),18000,(1,.45,.18),20)
area((5,-28,20),26000,(.4,.65,1),20)
data=bpy.data.cameras.new('Ash Wing preview');camera=bpy.data.objects.new(data.name,data)
source_scene.collection.objects.link(camera);camera.location=(37,47,26)
camera.rotation_euler=(Vector((0,-1,2))-camera.location).to_track_quat('-Z','Y').to_euler()
data.type='ORTHO';data.ortho_scale=66;source_scene.camera=camera
world=bpy.data.worlds.new('Ash Wing studio');world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.022,.032,.042,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.5;source_scene.world=world
source_scene.render.engine='CYCLES';source_scene.cycles.samples=24;source_scene.cycles.use_denoising=True
source_scene.render.resolution_x=1400;source_scene.render.resolution_y=900;source_scene.render.resolution_percentage=100
source_scene.render.image_settings.file_format='PNG';source_scene.render.film_transparent=True
source_scene.render.filepath=str(ROOT/'public/images/ash-wing-preview.png')
bpy.data.libraries.write(str(ROOT/'assets/ash-wing/ash-wing.blend'),{source_scene,export_scene},fake_user=True,compress=True)
print('Saved editable Blender project')
