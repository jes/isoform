/**
 * Axis-Aligned Bounding Box (AABB) class
 * Represents a 3D box with sides aligned to the coordinate axes
 */
class AABB {
    /**
     * Create an AABB
     * @param {Vec3} min - Minimum corner point (smallest x, y, z coordinates)
     * @param {Vec3} max - Maximum corner point (largest x, y, z coordinates)
     */
    constructor(min, max) {
        this.min = min.clone();
        this.max = max.clone();
    }

    /**
     * Create an AABB from a center point and half-extents
     * @param {Vec3} center - Center point of the box
     * @param {Vec3} halfExtents - Half-sizes in each dimension
     * @returns {AABB} New AABB instance
     */
    static fromCenterAndSize(center, halfExtents) {
        return new AABB(
            center.sub(halfExtents),
            center.add(halfExtents)
        );
    }

    /**
     * Create an empty AABB (with min at +Infinity and max at -Infinity)
     * @returns {AABB} Empty AABB that will expand to contain any point added to it
     */
    static empty() {
        return new AABB(
            new Vec3(Infinity, Infinity, Infinity),
            new Vec3(-Infinity, -Infinity, -Infinity)
        );
    }

    /**
     * Create an infinite AABB (with min at -Infinity and max at Infinity)
     * @returns {AABB} Infinite AABB that will contain any point added to it
     */
    static infinite() {
        return new AABB(
            new Vec3(-Infinity, -Infinity, -Infinity),
            new Vec3(Infinity, Infinity, Infinity)
        );
    }

    /**
     * Clone this AABB
     * @returns {AABB} New AABB with the same min and max
     */
    clone() {
        return new AABB(this.min.clone(), this.max.clone());
    }

    /**
     * Get the center point of this AABB
     * @returns {Vec3} Center point
     */
    getCenter() {
        return this.min.add(this.max).mul(0.5);
    }

    /**
     * Get the size (dimensions) of this AABB
     * @returns {Vec3} Size vector
     */
    getSize() {
        return this.max.sub(this.min);
    }

    /**
     * Get the half-extents (half-sizes) of this AABB
     * @returns {Vec3} Half-extents vector
     */
    getHalfExtents() {
        return this.getSize().mul(0.5);
    }

    /**
     * Check if this AABB contains a point
     * @param {Vec3} point - Point to check
     * @returns {boolean} True if the point is inside or on the boundary
     */
    containsPoint(point) {
        return (
            point.x >= this.min.x && point.x <= this.max.x &&
            point.y >= this.min.y && point.y <= this.max.y &&
            point.z >= this.min.z && point.z <= this.max.z
        );
    }

    /**
     * Check if this AABB completely contains another AABB
     * @param {AABB} aabb - AABB to check
     * @returns {boolean} True if the other AABB is completely inside this one
     */
    containsAABB(aabb) {
        return (
            this.min.x <= aabb.min.x && this.max.x >= aabb.max.x &&
            this.min.y <= aabb.min.y && this.max.y >= aabb.max.y &&
            this.min.z <= aabb.min.z && this.max.z >= aabb.max.z
        );
    }

    /**
     * Check if this AABB intersects another AABB
     * @param {AABB} aabb - AABB to check
     * @returns {boolean} True if the AABBs intersect
     */
    intersectsAABB(aabb) {
        return !(
            this.max.x < aabb.min.x || this.min.x > aabb.max.x ||
            this.max.y < aabb.min.y || this.min.y > aabb.max.y ||
            this.max.z < aabb.min.z || this.min.z > aabb.max.z
        );
    }

    /**
     * Expand this AABB to include a point
     * @param {Vec3} point - Point to include
     * @returns {AABB} This AABB for chaining
     */
    expandByPoint(point) {
        this.min = this.min.min(point);
        this.max = this.max.max(point);
        return this;
    }

    /**
     * Expand this AABB to include another AABB
     * @param {AABB} aabb - AABB to include
     * @returns {AABB} This AABB for chaining
     */
    expandByAABB(aabb) {
        this.min = this.min.min(aabb.min);
        this.max = this.max.max(aabb.max);
        return this;
    }

    /**
     * Expand this AABB by a fixed amount in all directions
     * @param {number} amount - Amount to expand by
     * @returns {AABB} This AABB for chaining
     */
    expandByScalar(amount) {
        const delta = new Vec3(amount, amount, amount);
        this.min = this.min.sub(delta);
        this.max = this.max.add(delta);
        return this;
    }

    /**
     * Calculate the closest point on this AABB to a given point
     * @param {Vec3} point - Point to find closest point to
     * @returns {Vec3} Closest point on the AABB
     */
    closestPointTo(point) {
        return new Vec3(
            Math.max(this.min.x, Math.min(point.x, this.max.x)),
            Math.max(this.min.y, Math.min(point.y, this.max.y)),
            Math.max(this.min.z, Math.min(point.z, this.max.z))
        );
    }

    /**
     * Calculate the distance from a point to this AABB
     * @param {Vec3} point - Point to calculate distance from
     * @returns {number} Distance to the AABB (0 if inside)
     */
    distanceToPoint(point) {
        const closestPoint = this.closestPointTo(point);
        return point.distanceTo(closestPoint);
    }

    /**
     * Calculate the squared distance from a point to this AABB
     * @param {Vec3} point - Point to calculate squared distance from
     * @returns {number} Squared distance to the AABB (0 if inside)
     */
    squaredDistanceToPoint(point) {
        const closestPoint = this.closestPointTo(point);
        const dx = point.x - closestPoint.x;
        const dy = point.y - closestPoint.y;
        const dz = point.z - closestPoint.z;
        return dx * dx + dy * dy + dz * dz;
    }

    /**
     * Get the volume of this AABB
     * @returns {number} Volume
     */
    getVolume() {
        const size = this.getSize();
        return size.x * size.y * size.z;
    }

    /**
     * Get the surface area of this AABB
     * @returns {number} Surface area
     */
    getSurfaceArea() {
        const size = this.getSize();
        return 2 * (size.x * size.y + size.x * size.z + size.y * size.z);
    }

    /**
     * Check if this AABB is empty (min >= max)
     * @returns {boolean} True if this is an empty AABB
     */
    isEmpty() {
        return (
            this.min.x >= this.max.x ||
            this.min.y >= this.max.y ||
            this.min.z >= this.max.z
        );
    }

    /**
     * Check if this AABB is infinite
     * @returns {boolean} True if this is an infinite AABB
     */
    isInfinite() {
        return (
            this.min.x === -Infinity && this.min.y === -Infinity && this.min.z === -Infinity &&
            this.max.x === Infinity && this.max.y === Infinity && this.max.z === Infinity
        );
    }

    /**
     * Get the intersection of this AABB with another AABB
     * @param {AABB} aabb - AABB to intersect with
     * @returns {AABB|null} New AABB representing the intersection, or null if no intersection
     */
    getIntersection(aabb) {
        const min = this.min.max(aabb.min);
        const max = this.max.min(aabb.max);
        
        // Check if there's a valid intersection
        if (this.intersectsAABB(aabb)) {
            return new AABB(min, max);
        }
        
        return AABB.empty();
    }

    /**
     * Get the union of this AABB with another AABB
     * @param {AABB} aabb - AABB to union with
     * @returns {AABB} New AABB representing the union
     */
    getUnion(aabb) {
        return new AABB(
            this.min.min(aabb.min),
            this.max.max(aabb.max)
        );
    }

    /**
     * Get the result of subtracting another AABB from this one
     * @param {AABB} aabb - AABB to subtract
     * @returns {AABB} New AABB approximating the subtraction result
     * 
     * Note: This attempts to find the smallest AABB that completely contains the result 
     * of the boolean subtraction operation. Since AABB subtraction can result in non-AABB 
     * shapes, this is an approximation.
     */
    getSubtraction(aabb) {
        // If no intersection, return this AABB unchanged
        if (!this.intersectsAABB(aabb)) {
            return this.clone();
        }
        
        // If other AABB completely contains this one, result is empty
        if (aabb.containsAABB(this)) {
            return AABB.empty();
        }
        
        // For partial overlaps, we need to find the regions that remain after subtraction
        // We'll compute up to 6 remaining regions and find the smallest AABB that contains them all
        
        // Get the intersection of the two AABBs
        const intersection = this.getIntersection(aabb);
        
        // We'll create up to 6 sub-boxes (one for each face of the AABB that might remain)
        // and combine them to get the minimal enclosing AABB
        let result = AABB.empty();
        
        // X-axis: left and right regions
        if (this.min.x < intersection.min.x) {
            // Left part remains
            result.expandByAABB(new AABB(
                new Vec3(this.min.x, this.min.y, this.min.z),
                new Vec3(intersection.min.x, this.max.y, this.max.z)
            ));
        }
        
        if (intersection.max.x < this.max.x) {
            // Right part remains
            result.expandByAABB(new AABB(
                new Vec3(intersection.max.x, this.min.y, this.min.z),
                new Vec3(this.max.x, this.max.y, this.max.z)
            ));
        }
        
        // Y-axis: bottom and top regions
        if (this.min.y < intersection.min.y) {
            // Bottom part remains (excluding any portions that were handled by X-axis cases)
            result.expandByAABB(new AABB(
                new Vec3(intersection.min.x, this.min.y, this.min.z),
                new Vec3(intersection.max.x, intersection.min.y, this.max.z)
            ));
        }
        
        if (intersection.max.y < this.max.y) {
            // Top part remains (excluding any portions that were handled by X-axis cases)
            result.expandByAABB(new AABB(
                new Vec3(intersection.min.x, intersection.max.y, this.min.z),
                new Vec3(intersection.max.x, this.max.y, this.max.z)
            ));
        }
        
        // Z-axis: front and back regions
        if (this.min.z < intersection.min.z) {
            // Front part remains (excluding any portions that were handled by X and Y axis cases)
            result.expandByAABB(new AABB(
                new Vec3(intersection.min.x, intersection.min.y, this.min.z),
                new Vec3(intersection.max.x, intersection.max.y, intersection.min.z)
            ));
        }
        
        if (intersection.max.z < this.max.z) {
            // Back part remains (excluding any portions that were handled by X and Y axis cases)
            result.expandByAABB(new AABB(
                new Vec3(intersection.min.x, intersection.min.y, intersection.max.z),
                new Vec3(intersection.max.x, intersection.max.y, this.max.z)
            ));
        }
        
        // If the result is still empty, the subtraction might have resulted in disjoint regions
        // In this case, we return the original AABB as a conservative approximation
        if (result.isEmpty()) {
            return this.clone();
        }
        
        return result;
    }

    /**
     * Check if this AABB is equal to another AABB
     * @param {AABB} aabb - AABB to compare with
     * @returns {boolean} True if the AABBs are equal
     */
    equals(aabb) {
        return this.min.equals(aabb.min) && this.max.equals(aabb.max);
    }

    /**
     * Get an AABB that contains this AABB after rotation around an axis
     * @param {Vec3} axis - Axis of rotation (normalized)
     * @param {number} angleRad - Angle of rotation in radians
     * @returns {AABB} New AABB that contains the rotated box
     */
    getRotatedAABB(axis, angleRad) {
        // Create rotation matrix
        const rotationMatrix = new Mat3().makeRotation(axis, angleRad);
        
        // Get all 8 corners of this AABB
        const corners = [
            new Vec3(this.min.x, this.min.y, this.min.z),
            new Vec3(this.max.x, this.min.y, this.min.z),
            new Vec3(this.min.x, this.max.y, this.min.z),
            new Vec3(this.min.x, this.min.y, this.max.z),
            new Vec3(this.max.x, this.max.y, this.min.z),
            new Vec3(this.max.x, this.min.y, this.max.z),
            new Vec3(this.min.x, this.max.y, this.max.z),
            new Vec3(this.max.x, this.max.y, this.max.z)
        ];
        
        // Create a new AABB to contain all rotated corners
        const result = AABB.empty();
        
        // Rotate each corner and add to the new AABB
        for (const corner of corners) {
            const rotatedCorner = rotationMatrix.mulVec3(corner);
            result.expandByPoint(rotatedCorner);
        }
        
        return result;
    }

    /**
     * Get an AABB that contains this AABB after transformation by a matrix
     * @param {Mat3} matrix - Transformation matrix
     * @returns {AABB} New AABB that contains the transformed box
     */
    getTransformedAABB(matrix) {
        // Get all 8 corners of this AABB
        const corners = [
            new Vec3(this.min.x, this.min.y, this.min.z),
            new Vec3(this.max.x, this.min.y, this.min.z),
            new Vec3(this.min.x, this.max.y, this.min.z),
            new Vec3(this.min.x, this.min.y, this.max.z),
            new Vec3(this.max.x, this.max.y, this.min.z),
            new Vec3(this.max.x, this.min.y, this.max.z),
            new Vec3(this.min.x, this.max.y, this.max.z),
            new Vec3(this.max.x, this.max.y, this.max.z)
        ];
        
        // Create a new AABB to contain all transformed corners
        const result = AABB.empty();
        
        // Transform each corner and add to the new AABB
        for (const corner of corners) {
            const transformedCorner = matrix.mulVec3(corner);
            result.expandByPoint(transformedCorner);
        }
        
        return result;
    }
}

// Detect environment and export accordingly
(function() {
    const nodes = { AABB };
    
    // Check if we're in a module environment
    if (typeof exports !== 'undefined') {
        // Node.js or ES modules environment
        if (typeof module !== 'undefined' && module.exports) {
            // CommonJS (Node.js)
            Object.assign(module.exports, nodes);
        } else {
            // ES modules
            Object.keys(nodes).forEach(key => {
                exports[key] = nodes[key];
            });
        }
    } else if (typeof window !== 'undefined') {
        // Browser environment with script tags
        Object.keys(nodes).forEach(key => {
            window[key] = nodes[key];
        });
    }
})();
