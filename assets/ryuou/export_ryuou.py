"""Run after build_ryuou.py. Exports only the Ryuou, preserving editable parts."""
import bpy
import bmesh
from mathutils import Vector

ROOT = '/Users/koji/Codex/submarine-zero'
source_scene = bpy.context.scene
source_collection = next(c for c in source_scene.collection.children if c.name.startswith('Ryuou • Editable'))
source_parts = list(source_collection.objects)
for obj in source_parts:
    if obj.type == 'MESH':
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        bm.to_mesh(obj.data)
        bm.free()

depsgraph = bpy.context.evaluated_depsgraph_get()
export_scene = bpy.data.scenes.new('Ryuou • Game export')
export_parts = []
for obj in source_parts:
    data = bpy.data.meshes.new_from_object(obj.evaluated_get(depsgraph))
    clone = bpy.data.objects.new(obj.name + ' • export', data)
    clone.matrix_world = obj.matrix_world.copy()
    export_scene.collection.objects.link(clone)
    export_parts.append(clone)

bpy.context.window.scene = export_scene
static = [o for o in export_parts if not o.name.startswith('Ryuou_Rotor')]
for obj in static:
    obj.select_set(True)
bpy.context.view_layer.objects.active = static[0]
bpy.ops.object.join()
hull_obj = bpy.context.object
hull_obj.name = 'Ryuou_Hull'
# One material slot per surface, so glTF draws each material just once.
unique_materials = []
slot_map = []
for mat in hull_obj.data.materials:
    if mat not in unique_materials:
        unique_materials.append(mat)
    slot_map.append(unique_materials.index(mat))
face_materials = [slot_map[p.material_index] for p in hull_obj.data.polygons]
hull_obj.data.materials.clear()
for mat in unique_materials:
    hull_obj.data.materials.append(mat)
for poly, index in zip(hull_obj.data.polygons, face_materials):
    poly.material_index = index

for obj in export_scene.objects:
    obj.select_set(True)
    if obj.name.startswith('Ryuou_Rotor'):
        obj.name = obj.name.split(' • export')[0] + '_Game'
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

# Reduce only the runtime copy; the source keeps all editable detail.
bpy.context.view_layer.objects.active = hull_obj
mod = hull_obj.modifiers.new('Game mesh reduction', 'DECIMATE')
mod.ratio = 0.65
mod.delimit = {'MATERIAL', 'NORMAL'}
bpy.ops.object.modifier_apply(modifier=mod.name)
for mat in unique_materials:
    mat.use_backface_culling = True

bpy.ops.export_scene.gltf(
    filepath=ROOT + '/public/models/ryuou.glb',
    export_format='GLB', use_selection=True, use_active_scene=True, export_animations=False,
    export_cameras=False, export_lights=False, export_yup=True,
    export_extras=False, export_texcoords=False,
)
triangle_count = 0
for obj in export_scene.objects:
    obj.data.calc_loop_triangles()
    triangle_count += len(obj.data.loop_triangles)
print({'triangles': triangle_count, 'objects': len(export_scene.objects), 'draw_calls': len(unique_materials)+2})

bpy.context.window.scene = source_scene
studio = bpy.data.collections.new('Ryuou • Preview studio (not exported)')
source_scene.collection.children.link(studio)
def area(name, location, energy, color, size):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.color = color
    data.shape = 'DISK'
    data.size = size
    obj = bpy.data.objects.new(name,data)
    studio.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (-obj.location).to_track_quat('-Z','Y').to_euler()
area('Studio | soft key', (4,-3,10), 1800, (0.80,0.89,1.0), 8)
area('Studio | violet fill', (-7,3,4), 1200, (0.66,0.53,1.0), 7)
area('Studio | cyan rim', (3,7,6), 2200, (0.30,0.72,1.0), 5)
camera_data=bpy.data.cameras.new('Ryuou preview')
camera=bpy.data.objects.new('Ryuou preview',camera_data)
studio.objects.link(camera)
camera.location=(10,-14,9)
camera.rotation_euler=(Vector((0,0,0.25))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type='ORTHO'
camera_data.ortho_scale=15.2
source_scene.camera=camera
world=bpy.data.worlds.new('Ryuou studio world')
world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(0.018,0.026,0.046,1)
world.node_tree.nodes['Background'].inputs[1].default_value=0.45
source_scene.world=world
source_scene.render.engine='CYCLES'
source_scene.cycles.samples=24
source_scene.cycles.use_denoising=True
source_scene.render.resolution_x=1200
source_scene.render.resolution_y=900
source_scene.render.resolution_percentage=100
source_scene.render.image_settings.file_format='PNG'
source_scene.render.film_transparent=True
source_scene.render.filepath=ROOT+'/public/images/ryuou-preview.png'
source_scene.view_settings.view_transform='AgX'
bpy.ops.wm.save_as_mainfile(filepath=ROOT+'/assets/ryuou/ryuou.blend')
print('Saved editable .blend and game .glb; preview camera ready')
