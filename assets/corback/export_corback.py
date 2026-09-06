"""Run after build_corback.py; export a lightweight GLB and set up a preview.

Override ROOT if using Blender's text editor in a different checkout.
"""
import bpy
from pathlib import Path
from mathutils import Vector

ROOT = Path('/Users/koji/Codex/submarine-zero')
source_scene = bpy.context.scene
source = next(c for c in source_scene.collection.children if c.name.startswith('Corback • Editable'))
depsgraph = bpy.context.evaluated_depsgraph_get()
export_scene = bpy.data.scenes.new('Corback • Game export')
groups = {False: [], True: []}
for obj in source.objects:
    data = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
    clone = bpy.data.objects.new(obj.name + ' • runtime', data)
    clone.matrix_world = obj.matrix_world.copy()
    export_scene.collection.objects.link(clone)
    groups[bool(obj.get('corback_rotor'))].append(clone)

bpy.context.window.scene = export_scene
for is_rotor, objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = 'Corback_Rotor_Game' if is_rotor else 'Corback_Hull'
    export_scene.cursor.location = (0,-5.85,0) if is_rotor else (0,0,0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    materials = []
    slots = []
    for mat in obj.data.materials:
        if mat not in materials:
            materials.append(mat)
        slots.append(materials.index(mat))
    face_slots = [slots[p.material_index] for p in obj.data.polygons]
    obj.data.materials.clear()
    for mat in materials:
        obj.data.materials.append(mat)
        mat.use_backface_culling = True
    for face, slot in zip(obj.data.polygons, face_slots):
        face.material_index = slot

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/corback.glb'),
    export_format='GLB', use_selection=True, use_active_scene=True,
    export_animations=False, export_cameras=False, export_lights=False,
    export_yup=True, export_extras=False, export_texcoords=False)
triangles = 0
for obj in export_scene.objects:
    obj.data.calc_loop_triangles()
    triangles += len(obj.data.loop_triangles)
print({'triangles':triangles, 'runtime_nodes':len(export_scene.objects),
       'draw_calls':sum(len(o.data.materials) for o in export_scene.objects)})

bpy.context.window.scene = source_scene
studio = bpy.data.collections.new('Corback • Preview studio (not exported)')
source_scene.collection.children.link(studio)
def area(name, position, energy, color, size):
    data = bpy.data.lights.new(name,'AREA')
    data.energy, data.color, data.shape, data.size = energy,color,'DISK',size
    obj = bpy.data.objects.new(name,data)
    studio.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (-obj.location).to_track_quat('-Z','Y').to_euler()
area('Corback | large soft key',(3,6,10),2200,(.80,.91,1),8)
area('Corback | port fill',(-6,0,5),1700,(.46,.68,1),7)
area('Corback | stern rim',(3,-8,4),2400,(.72,.89,1),6)
camera_data = bpy.data.cameras.new('Corback preview')
camera = bpy.data.objects.new('Corback preview',camera_data)
studio.objects.link(camera)
camera.location = (10,14,8)
camera.rotation_euler = (Vector((0,0,.15))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 14
source_scene.camera = camera
world = bpy.data.worlds.new('Corback studio world')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (.04,.06,.10,1)
world.node_tree.nodes['Background'].inputs[1].default_value = .55
source_scene.world = world
source_scene.render.engine = 'CYCLES'
source_scene.cycles.samples = 24
source_scene.cycles.use_denoising = True
source_scene.render.resolution_x = 1200
source_scene.render.resolution_y = 900
source_scene.render.resolution_percentage = 100
source_scene.render.image_settings.file_format = 'PNG'
source_scene.render.film_transparent = True
source_scene.render.filepath = str(ROOT/'public/images/corback-preview.png')
source_scene.view_settings.view_transform = 'AgX'
# A dedicated .blend contains only Corback scenes, while the open Blender
# session retains the user's other scenes. No existing project is overwritten.
bpy.data.libraries.write(str(ROOT/'assets/corback/corback.blend'),
    {source_scene,export_scene}, fake_user=True, compress=True)
print('Saved Corback .blend and .glb; call bpy.ops.render.render(write_still=True) for preview')
