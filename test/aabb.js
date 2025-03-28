/**
 * Unit tests for the AABB (Axis-Aligned Bounding Box) class
 */
const AABBTests = {
    /**
     * Run all AABB tests
     * @returns {Array} Array of test results
     */
    run: async function() {
        const tests = [
            this.testConstructor,
            this.testFromCenterAndSize,
            this.testEmpty,
            this.testInfinite,
            this.testClone,
            this.testGetCenter,
            this.testGetSize,
            this.testGetHalfExtents,
            this.testContainsPoint,
            this.testContainsAABB,
            this.testIntersectsAABB,
            this.testExpandByPoint,
            this.testExpandByAABB,
            this.testExpandByScalar,
            this.testClosestPointTo,
            this.testDistanceToPoint,
            this.testSquaredDistanceToPoint,
            this.testGetVolume,
            this.testGetSurfaceArea,
            this.testGetIntersection,
            this.testGetUnion
        ];

        const results = [];
        for (const test of tests) {
            try {
                const result = await test();
                results.push({
                    name: test.name.replace('test', ''),
                    passed: true
                });
            } catch (error) {
                results.push({
                    name: test.name.replace('test', ''),
                    passed: false,
                    error: error.message,
                    sourceLocation: error.stack
                });
            }
        }
        return results;
    },

    /**
     * Test AABB constructor
     */
    testConstructor: async function() {
        const min = new Vec3(1, 2, 3);
        const max = new Vec3(4, 5, 6);
        const aabb = new AABB(min, max);
        
        // Check that min and max are cloned, not referenced
        if (aabb.min === min || aabb.max === max) {
            throw new Error("Constructor should clone min and max vectors");
        }
        
        // Check values
        if (aabb.min.x !== 1 || aabb.min.y !== 2 || aabb.min.z !== 3) {
            throw new Error("Min vector not set correctly");
        }
        
        if (aabb.max.x !== 4 || aabb.max.y !== 5 || aabb.max.z !== 6) {
            throw new Error("Max vector not set correctly");
        }
    },

    /**
     * Test fromCenterAndSize static method
     */
    testFromCenterAndSize: async function() {
        const center = new Vec3(0, 0, 0);
        const halfExtents = new Vec3(1, 2, 3);
        const aabb = AABB.fromCenterAndSize(center, halfExtents);
        
        if (!aabb.min.equals(new Vec3(-1, -2, -3))) {
            throw new Error("fromCenterAndSize did not set min correctly");
        }
        
        if (!aabb.max.equals(new Vec3(1, 2, 3))) {
            throw new Error("fromCenterAndSize did not set max correctly");
        }
    },

    /**
     * Test empty static method
     */
    testEmpty: async function() {
        const aabb = AABB.empty();
        
        if (aabb.min.x !== Infinity || aabb.min.y !== Infinity || aabb.min.z !== Infinity) {
            throw new Error("Empty AABB min should be (Infinity, Infinity, Infinity)");
        }
        
        if (aabb.max.x !== -Infinity || aabb.max.y !== -Infinity || aabb.max.z !== -Infinity) {
            throw new Error("Empty AABB max should be (-Infinity, -Infinity, -Infinity)");
        }
    },

    /**
     * Test infinite static method
     */
    testInfinite: async function() {
        const aabb = AABB.infinite();
        
        if (aabb.min.x !== -Infinity || aabb.min.y !== -Infinity || aabb.min.z !== -Infinity) {
            throw new Error("Infinite AABB min should be (-Infinity, -Infinity, -Infinity)");
        }
        
        if (aabb.max.x !== Infinity || aabb.max.y !== Infinity || aabb.max.z !== Infinity) {
            throw new Error("Infinite AABB max should be (Infinity, Infinity, Infinity)");
        }
    },

    /**
     * Test clone method
     */
    testClone: async function() {
        const original = new AABB(new Vec3(1, 2, 3), new Vec3(4, 5, 6));
        const clone = original.clone();
        
        // Check that it's a new instance
        if (clone === original) {
            throw new Error("Clone should return a new AABB instance");
        }
        
        // Check that min and max are cloned
        if (clone.min === original.min || clone.max === original.max) {
            throw new Error("Clone should create new min and max vectors");
        }
        
        // Check values
        if (!clone.min.equals(original.min) || !clone.max.equals(original.max)) {
            throw new Error("Clone values don't match original");
        }
    },

    /**
     * Test getCenter method
     */
    testGetCenter: async function() {
        const aabb = new AABB(new Vec3(0, 0, 0), new Vec3(2, 4, 6));
        const center = aabb.getCenter();
        
        if (!center.equals(new Vec3(1, 2, 3))) {
            throw new Error("getCenter returned incorrect value");
        }
    },

    /**
     * Test getSize method
     */
    testGetSize: async function() {
        const aabb = new AABB(new Vec3(1, 2, 3), new Vec3(4, 6, 9));
        const size = aabb.getSize();
        
        if (!size.equals(new Vec3(3, 4, 6))) {
            throw new Error("getSize returned incorrect value");
        }
    },

    /**
     * Test getHalfExtents method
     */
    testGetHalfExtents: async function() {
        const aabb = new AABB(new Vec3(0, 0, 0), new Vec3(2, 4, 6));
        const halfExtents = aabb.getHalfExtents();
        
        if (!halfExtents.equals(new Vec3(1, 2, 3))) {
            throw new Error("getHalfExtents returned incorrect value");
        }
    },

    /**
     * Test containsPoint method
     */
    testContainsPoint: async function() {
        const aabb = new AABB(new Vec3(0, 0, 0), new Vec3(2, 2, 2));
        
        // Inside
        if (!aabb.containsPoint(new Vec3(1, 1, 1))) {
            throw new Error("containsPoint should return true for point inside");
        }
        
        // On boundary
        if (!aabb.containsPoint(new Vec3(0, 1, 1))) {
            throw new Error("containsPoint should return true for point on boundary");
        }
        
        // Outside
        if (aabb.containsPoint(new Vec3(3, 1, 1))) {
            throw new Error("containsPoint should return false for point outside");
        }
    },

    /**
     * Test containsAABB method
     */
    testContainsAABB: async function() {
        const aabb = new AABB(new Vec3(0, 0, 0), new Vec3(10, 10, 10));
        
        // Fully inside
        const inside = new AABB(new Vec3(1, 1, 1), new Vec3(9, 9, 9));
        if (!aabb.containsAABB(inside)) {
            throw new Error("containsAABB should return true for AABB fully inside");
        }
        
        // Partially inside
        const partial = new AABB(new Vec3(5, 5, 5), new Vec3(15, 15, 15));
        if (aabb.containsAABB(partial)) {
            throw new Error("containsAABB should return false for AABB partially inside");
        }
        
        // Fully outside
        const outside = new AABB(new Vec3(11, 11, 11), new Vec3(12, 12, 12));
        if (aabb.containsAABB(outside)) {
            throw new Error("containsAABB should return false for AABB fully outside");
        }
    },

    /**
     * Test intersectsAABB method
     */
    testIntersectsAABB: async function() {
        const aabb = new AABB(new Vec3(0, 0, 0), new Vec3(10, 10, 10));
        
        // Fully inside
        const inside = new AABB(new Vec3(1, 1, 1), new Vec3(9, 9, 9));
        if (!aabb.intersectsAABB(inside)) {
            throw new Error("intersectsAABB should return true for AABB fully inside");
        }
        
        // Partially inside
        const partial = new AABB(new Vec3(5, 5, 5), new Vec3(15, 15, 15));
        if (!aabb.intersectsAABB(partial)) {
            throw new Error("intersectsAABB should return true for AABB partially inside");
        }
        
        // Fully outside
        const outside = new AABB(new Vec3(11, 11, 11), new Vec3(12, 12, 12));
        if (aabb.intersectsAABB(outside)) {
            throw new Error("intersectsAABB should return false for AABB fully outside");
        }
    },

    /**
     * Test expandByPoint method
     */
    testExpandByPoint: async function() {
        const aabb = new AABB(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
        
        // Expand by point outside
        aabb.expandByPoint(new Vec3(2, 3, 4));
        
        if (!aabb.min.equals(new Vec3(0, 0, 0))) {
            throw new Error("expandByPoint should not change min for points greater than min");
        }
        
        if (!aabb.max.equals(new Vec3(2, 3, 4))) {
            throw new Error("expandByPoint should update max for points greater than max");
        }
        
        // Expand by point that affects min
        aabb.expandByPoint(new Vec3(-1, -2, -3));
        
        if (!aabb.min.equals(new Vec3(-1, -2, -3))) {
            throw new Error("expandByPoint should update min for points less than min");
        }
    },

    /**
     * Test expandByAABB method
     */
    testExpandByAABB: async function() {
        const aabb = new AABB(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
        const other = new AABB(new Vec3(-1, -2, -3), new Vec3(2, 3, 4));
        
        aabb.expandByAABB(other);
        
        if (!aabb.min.equals(new Vec3(-1, -2, -3))) {
            throw new Error("expandByAABB did not update min correctly");
        }
        
        if (!aabb.max.equals(new Vec3(2, 3, 4))) {
            throw new Error("expandByAABB did not update max correctly");
        }
    },

    /**
     * Test expandByScalar method
     */
    testExpandByScalar: async function() {
        const aabb = new AABB(new Vec3(1, 2, 3), new Vec3(4, 5, 6));
        
        aabb.expandByScalar(2);
        
        if (!aabb.min.equals(new Vec3(-1, 0, 1))) {
            throw new Error("expandByScalar did not update min correctly");
        }
        
        if (!aabb.max.equals(new Vec3(6, 7, 8))) {
            throw new Error("expandByScalar did not update max correctly");
        }
    },

    /**
     * Test closestPointTo method
     */
    testClosestPointTo: async function() {
        const aabb = new AABB(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
        
        // Point inside
        const insidePoint = new Vec3(0.5, 0.5, 0.5);
        const closestInside = aabb.closestPointTo(insidePoint);
        if (!closestInside.equals(insidePoint)) {
            throw new Error("closestPointTo should return the same point for points inside");
        }
        
        // Point outside
        const outsidePoint = new Vec3(2, 3, 4);
        const closestOutside = aabb.closestPointTo(outsidePoint);
        if (!closestOutside.equals(new Vec3(1, 1, 1))) {
            throw new Error("closestPointTo did not return correct closest point");
        }
    },

    /**
     * Test distanceToPoint method
     */
    testDistanceToPoint: async function() {
        const aabb = new AABB(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
        
        // Point inside
        const insideDistance = aabb.distanceToPoint(new Vec3(0.5, 0.5, 0.5));
        if (insideDistance !== 0) {
            throw new Error("distanceToPoint should return 0 for points inside");
        }
        
        // Point outside
        const outsideDistance = aabb.distanceToPoint(new Vec3(4, 0, 0));
        if (Math.abs(outsideDistance - 3) > 1e-10) {
            throw new Error("distanceToPoint returned incorrect distance");
        }
    },

    /**
     * Test squaredDistanceToPoint method
     */
    testSquaredDistanceToPoint: async function() {
        const aabb = new AABB(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
        
        // Point inside
        const insideDistance = aabb.squaredDistanceToPoint(new Vec3(0.5, 0.5, 0.5));
        if (insideDistance !== 0) {
            throw new Error("squaredDistanceToPoint should return 0 for points inside");
        }
        
        // Point outside
        const outsideDistance = aabb.squaredDistanceToPoint(new Vec3(4, 0, 0));
        if (Math.abs(outsideDistance - 9) > 1e-10) {
            throw new Error("squaredDistanceToPoint returned incorrect squared distance");
        }
    },

    /**
     * Test getVolume method
     */
    testGetVolume: async function() {
        const aabb = new AABB(new Vec3(0, 0, 0), new Vec3(2, 3, 4));
        const volume = aabb.getVolume();
        
        if (volume !== 24) {
            throw new Error("getVolume returned incorrect value");
        }
    },

    /**
     * Test getSurfaceArea method
     */
    testGetSurfaceArea: async function() {
        const aabb = new AABB(new Vec3(0, 0, 0), new Vec3(2, 3, 4));
        const area = aabb.getSurfaceArea();
        
        if (area !== 52) {
            throw new Error("getSurfaceArea returned incorrect value");
        }
    },

    /**
     * Test getIntersection method
     */
    testGetIntersection: async function() {
        const aabb1 = new AABB(new Vec3(0, 0, 0), new Vec3(2, 2, 2));
        const aabb2 = new AABB(new Vec3(1, 1, 1), new Vec3(3, 3, 3));
        
        const intersection = aabb1.getIntersection(aabb2);
        
        if (!intersection.min.equals(new Vec3(1, 1, 1))) {
            throw new Error("getIntersection did not set min correctly");
        }
        
        if (!intersection.max.equals(new Vec3(2, 2, 2))) {
            throw new Error("getIntersection did not set max correctly");
        }
        
        // Test non-intersecting boxes
        const aabb3 = new AABB(new Vec3(3, 3, 3), new Vec3(4, 4, 4));
        const noIntersection = aabb1.getIntersection(aabb3);
        
        if (!noIntersection.min.equals(new Vec3(Infinity, Infinity, Infinity))) {
            throw new Error("getIntersection should return empty AABB for non-intersecting boxes");
        }
    },

    /**
     * Test getUnion method
     */
    testGetUnion: async function() {
        const aabb1 = new AABB(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
        const aabb2 = new AABB(new Vec3(2, 2, 2), new Vec3(3, 3, 3));
        
        const union = aabb1.getUnion(aabb2);
        
        if (!union.min.equals(new Vec3(0, 0, 0))) {
            throw new Error("getUnion did not set min correctly");
        }
        
        if (!union.max.equals(new Vec3(3, 3, 3))) {
            throw new Error("getUnion did not set max correctly");
        }
    }
};
