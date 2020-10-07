import { DifFile, InteriorDetailLevel } from "./parsing/dif_parser";
import * as THREE from "three";
import OIMO from "./declarations/oimo";
import { ResourceManager } from "./resources";
import { TimeState, Level } from "./level";
import { Util, MaterialGeometry } from "./util";

export const INTERIOR_DEFAULT_FRICTION = 1;
export const INTERIOR_DEFAULT_RESTITUTION = 0.5;

const specialFriction: Record<string, number> = {
	"friction_high": 1.5,
	"friction_low": 0.025,
	"friction_none": 0.001,
	"friction_ramp_yellow": 2.0
};
const specialResistutionFactor: Record<string, number> = {
	"friction_high": 0.35,
	"friction_low": 0.5,
	"friction_none": 0.5
};
const specialMaterials = new Set(Object.keys(specialFriction));

/** Represents a Torque 3D Interior, used for the main surfaces and geometry of levels. */
export class Interior {
	level: Level;
	dif: DifFile;
	difPath: string;
	group: THREE.Group;
	/** The collision body of the interior. */
	body: OIMO.RigidBody;
	/** The relevant detail level to read from (non-default for pathed interiors) */
	detailLevel: DifFile["detailLevels"][number];
	worldMatrix = new THREE.Matrix4();
	materialGeometry: MaterialGeometry = [];

	constructor(file: DifFile, path: string, level: Level, subObjectIndex?: number) {
		this.group = new THREE.Group();
		this.dif = file;
		this.difPath = path;
		this.level = level;
		this.detailLevel = (subObjectIndex === undefined)? file.detailLevels[0] : file.subObjects[subObjectIndex];

		let rigidBodyConfig =  new OIMO.RigidBodyConfig();
		rigidBodyConfig.type = (subObjectIndex === undefined)? OIMO.RigidBodyType.STATIC : OIMO.RigidBodyType.KINEMATIC;
		this.body = new OIMO.RigidBody(rigidBodyConfig);
	}

	async init() {
		let materials: THREE.Material[] = [];
		for (let i = 0; i < this.detailLevel.materialList.materials.length; i++) {
			let mat = new THREE.MeshLambertMaterial();
			materials.push(mat);

			let currentPath = this.difPath;	
			while (true) {
				// Search for the texture file inside-out, first looking in the closest directory and then searching in parent directories until it is found.

				currentPath = currentPath.slice(0, Math.max(0, currentPath.lastIndexOf('/')));
				if (!currentPath) break; // Nothing found

				if (ResourceManager.getFullNamesOf(currentPath + '/' + this.detailLevel.materialList.materials[i]).length) {
					// We found the texture file; create the texture.
					let texture = await ResourceManager.getTexture(currentPath + '/' + this.detailLevel.materialList.materials[i] + '.jpg');
					texture.wrapS = THREE.RepeatWrapping;
					texture.wrapT = THREE.RepeatWrapping;
					mat.map = texture;

					break;
				}
			}

			this.materialGeometry.push({
				vertices: [],
				normals: [],
				uvs: [],
				indices: []
			});
		}

		for (let surface of this.detailLevel.surfaces) this.addSurface(surface); // Add every surface
		let geometry = Util.createGeometryFromMaterialGeometry(this.materialGeometry);
		let mesh = new THREE.Mesh(geometry, materials);
		mesh.receiveShadow = true;
		this.group.add(mesh);

		this.buildCollisionGeometry();

		this.level.loadingState.loaded++;
	}

	/** Adds one surface worth of geometry. */
	addSurface(surface: InteriorDetailLevel["surfaces"][number]) {
		let detailLevel = this.detailLevel;
		let texGenEqs = detailLevel.texGenEqs[surface.texGenIndex];
		// These are needed for UVs
		let texPlaneX = new THREE.Plane(new THREE.Vector3(texGenEqs.planeX.x, texGenEqs.planeX.y, texGenEqs.planeX.z), texGenEqs.planeX.d);
		let texPlaneY = new THREE.Plane(new THREE.Vector3(texGenEqs.planeY.x, texGenEqs.planeY.y, texGenEqs.planeY.z), texGenEqs.planeY.d);
		let planeData = detailLevel.planes[surface.planeIndex & ~0x8000]; // Mask it here because the bit at 0x8000 specifies whether or not to invert the plane's normal.
		let planeNormal = detailLevel.normals[planeData.normalIndex];
		let geometryData = this.materialGeometry[surface.textureIndex];

		let k = 0; // Keep track of the face's index for corrent vertex winding order.
		for (let i = surface.windingStart; i < surface.windingStart + surface.windingCount - 2; i++) {
			let i1 = this.detailLevel.windings[i];
			let i2 = this.detailLevel.windings[i+1];
			let i3 = this.detailLevel.windings[i+2];

			if (k % 2 === 0) {
				// Swap the first and last index to mainting correct winding order
				let temp = i1;
				i1 = i3;
				i3 = temp;
			}

			let normal = new THREE.Vector3(planeNormal.x, planeNormal.y, planeNormal.z);
			if (surface.planeIndex & 0x8000) normal.multiplyScalar(-1); // Invert the plane if so specified

			for (let index of [i1, i2, i3]) {
				let vertex = this.detailLevel.points[index];
				geometryData.vertices.push(vertex.x, vertex.y, vertex.z);

				// Figure out UV coordinates by getting the distances of the corresponding vertices to the plane.
				let u = texPlaneX.distanceToPoint(new THREE.Vector3(vertex.x, vertex.y, vertex.z));
				let v = texPlaneY.distanceToPoint(new THREE.Vector3(vertex.x, vertex.y, vertex.z));
				geometryData.uvs.push(u, v);

				geometryData.normals.push(normal.x, normal.y, normal.z);
			}

			k++;
		}
	}

	/** Builds the collision geometry of this interior based on convex hull descriptions. */
	buildCollisionGeometry() {
		/** Adds a convex hull collision shape. */
		const addShape = (vertices: OIMO.Vec3[], material: string) => {
			let geometry = new OIMO.ConvexHullGeometry(vertices);
			let shapeConfig = new OIMO.ShapeConfig();
			shapeConfig.geometry = geometry;
			shapeConfig.restitution = INTERIOR_DEFAULT_RESTITUTION * (specialResistutionFactor[material] ?? 1);
			shapeConfig.friction = INTERIOR_DEFAULT_FRICTION * (specialFriction[material] ?? 1);
			let shape = new OIMO.Shape(shapeConfig);
			this.body.addShape(shape);
		};

		for (let i = 0; i < this.detailLevel.convexHulls.length; i++) {
			let hull = this.detailLevel.convexHulls[i];
			let vertices: OIMO.Vec3[] = [];
 
			// Get the vertices
			for (let j = hull.hullStart; j < hull.hullStart + hull.hullCount; j++) {
				let point = this.detailLevel.points[this.detailLevel.hullIndices[j]];
				vertices.push(new OIMO.Vec3(point.x, point.y, point.z));
			}

			let materials = new Set();
			let firstMaterial: string;

			// Add all materials
			for (let j = hull.surfaceStart; j < hull.surfaceStart + hull.surfaceCount; j++) {
				let surface = this.detailLevel.surfaces[this.detailLevel.hullSurfaceIndices[j]];
				if (!surface) continue;
				
				let material = this.detailLevel.materialList.materials[surface.textureIndex];
				materials.add(material);
				firstMaterial = material;
			}

			// In case there is more than one material and one of them is special, generate geometry directly from the surfaces instead of from the convex hull.
			if (materials.size > 1 && Util.setsHaveOverlap(materials, specialMaterials)) {
				for (let j = hull.surfaceStart; j < hull.surfaceStart + hull.surfaceCount; j++) {
					let surface = this.detailLevel.surfaces[this.detailLevel.hullSurfaceIndices[j]];
					if (!surface) continue;

					let material = this.detailLevel.materialList.materials[surface.textureIndex];
					let vertices: OIMO.Vec3[] = [];

					for (let k = surface.windingStart; k < surface.windingStart + surface.windingCount; k++) {
						let point = this.detailLevel.points[this.detailLevel.windings[k]];
						vertices.push(new OIMO.Vec3(point.x, point.y, point.z));
					}

					addShape(vertices, material);
				}
			} else {
				// Otherwise, just add one shape for the entire convex hull.
				addShape(vertices, firstMaterial);
			}
		}
	}

	setTransform(position: THREE.Vector3, orientation: THREE.Quaternion) {
		this.group.position.copy(position);
		this.group.quaternion.copy(orientation);
		this.worldMatrix.compose(position, orientation, new THREE.Vector3(1, 1, 1));

		this.body.setPosition(new OIMO.Vec3(position.x, position.y, position.z));
		this.body.setOrientation(new OIMO.Quat(orientation.x, orientation.y, orientation.z, orientation.w));
	}

	tick(time: TimeState) {}
	render(time: TimeState) {}
	reset() {}
}