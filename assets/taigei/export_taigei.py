"""Run after build_taigei.py in Blender. Override ROOT for another checkout."""
import bpy
from pathlib import Path
from mathutils import Vector

ROOT = Path('/Users/koji/Codex/submarine-zero')
source_scene = bpy.context.scene
source = next(c for c in source_scene.collection.children if c.name.startswith('Taigei • Editable'))
depsgraph = bpy.context.evaluated_depsgraph_get()
export_scene = bpy.data.scenes.new('Taigei • Game export')
groups = {False: [], True: []}
for obj in source.objects:
    data = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
    clone = bpy.data.objects.new(obj.name + ' runtime', data)
    clone.matrix_world = obj.matrix_world.copy()
    export_scene.collection.objects.link(clone)
    groups[bool(obj.get('taigei_rotor'))].append(clone)

bpy.context.window.scene = export_scene
for is_rotor, objects in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = 'Taigei_Propeller' if is_rotor else 'Taigei_Hull'
    export_scene.cursor.location = (0,-4.82,0) if is_rotor else (0,0,0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    materials, slots = [], []
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
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/taigei.glb'),
    export_format='GLB', use_selection=True, use_active_scene=True,
    export_animations=False, export_cameras=False, export_lights=False,
    export_yup=True, export_extras=False, export_texcoords=False)
triangles = 0
for obj in export_scene.objects:
    obj.data.calc_loop_triangles()
    triangles += len(obj.data.loop_triangles)
print({'triangles':triangles,'nodes':len(export_scene.objects),
       'draw_calls':sum(len(o.data.materials) for o in export_scene.objects)})

bpy.context.window.scene = source_scene
studio = bpy.data.collections.new('Taigei • Preview studio (not exported)')
source_scene.collection.children.link(studio)
def area(name, position, energy, color, size):
    data = bpy.data.lights.new(name,'AREA')
    data.energy, data.color, data.shape, data.size = energy,color,'DISK',size
    obj = bpy.data.objects.new(name,data)
    studio.objects.link(obj)
    obj.location = position
    obj.rotation_euler = (-obj.location).to_track_quat('-Z','Y').to_euler()
area('Taigei | key',(3,6,8),1800,(.86,.92,1),7)
area('Taigei | fill',(-5,1,4),1300,(.62,.75,1),6)
area('Taigei | stern rim',(2,-7,5),2200,(.85,.93,1),5)
camera_data = bpy.data.cameras.new('Taigei preview')
camera = bpy.data.objects.new('Taigei preview',camera_data)
studio.objects.link(camera)
camera.location = (10,9,6)
camera.rotation_euler = (Vector((0,0,.3))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type, camera_data.ortho_scale = 'ORTHO', 10.8
source_scene.camera = camera
world = bpy.data.worlds.new('Taigei studio world')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (.035,.055,.07,1)
world.node_tree.nodes['Background'].inputs[1].default_value = .5
source_scene.world = world
source_scene.render.engine = 'CYCLES'
source_scene.cycles.samples = 32
source_scene.cycles.use_denoising = True
source_scene.render.resolution_x, source_scene.render.resolution_y = 1400, 900
source_scene.render.resolution_percentage = 100
source_scene.render.image_settings.file_format = 'PNG'
source_scene.render.film_transparent = False
source_scene.render.filepath = str(ROOT/'assets/taigei/preview.png')
source_scene.view_settings.view_transform = 'AgX'
for screen in bpy.data.screens:
    for area_ui in screen.areas:
        if area_ui.type == 'VIEW_3D':
            area_ui.spaces.active.region_3d.view_perspective = 'CAMERA'
bpy.data.libraries.write(str(ROOT/'assets/taigei/taigei.blend'),
    {source_scene,export_scene}, fake_user=True, compress=True)
print('Saved Taigei .blend and .glb. Render the current scene for preview.png.')
