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
            this.testGetUnion,
            this.testGetSubtraction
        ];

        const results = [];
        for (const test of tests) {
            try {
                // Bind the test function to this context
                const result = await test.bind(this)();
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
     * Helper method to assert that two AABBs are equal
     * @param {AABB} actual The actual AABB
     * @param {AABB} expected The expected AABB
     * @param {string} message Optional message prefix for the error
     */
    assertAABBEquals: function(actual, expected, message = "AABB equality check failed") {
        if (!actual.min.equals(expected.min) || !actual.max.equals(expected.max)) {
            throw new Error(`${message}:\n` + 
                `  Expected: min=${expected.min.toString()}, max=${expected.max.toString()}\n` +
                `  Actual:   min=${actual.min.toString()}, max=${actual.max.toString()}`);
        }
    },

    /**
     * Helper method to assert that two Vec3s are equal
     * @param {Vec3} actual The actual Vec3
     * @param {Vec3} expected The expected Vec3
     * @param {string} message Optional message prefix for the error
     */
    assertVec3Equals: function(actual, expected, message = "Vec3 equality check failed") {
        if (!actual.equals(expected)) {
            throw new Error(`${message}:\n` + 
                `  Expected: ${expected.toString()}\n` +
                `  Actual:   ${actual.toString()}`);
        }
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
        
        this.assertVec3Equals(aabb.min, new Vec3(-1, -2, -3), 
            "fromCenterAndSize did not set min correctly");
        
        this.assertVec3Equals(aabb.max, new Vec3(1, 2, 3),
            "fromCenterAndSize did not set max correctly");
    },

    /**
     * Test empty static method
     */
    testEmpty: async function() {
        const aabb = AABB.empty();
        
        this.assertVec3Equals(aabb.min, new Vec3(Infinity, Infinity, Infinity),
            "Empty AABB min should be (Infinity, Infinity, Infinity)");
        
        this.assertVec3Equals(aabb.max, new Vec3(-Infinity, -Infinity, -Infinity),
            "Empty AABB max should be (-Infinity, -Infinity, -Infinity)");
    },

    /**
     * Test infinite static method
     */
    testInfinite: async function() {
        const aabb = AABB.infinite();
        
        this.assertVec3Equals(aabb.min, new Vec3(-Infinity, -Infinity, -Infinity),
            "Infinite AABB min should be (-Infinity, -Infinity, -Infinity)");
        
        this.assertVec3Equals(aabb.max, new Vec3(Infinity, Infinity, Infinity),
            "Infinite AABB max should be (Infinity, Infinity, Infinity)");
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
        
        this.assertVec3Equals(center, new Vec3(1, 2, 3),
            "getCenter returned incorrect value");
    },

    /**
     * Test getSize method
     */
    testGetSize: async function() {
        const aabb = new AABB(new Vec3(1, 2, 3), new Vec3(4, 6, 9));
        const size = aabb.getSize();
        
        this.assertVec3Equals(size, new Vec3(3, 4, 6),
            "getSize returned incorrect value");
    },

    /**
     * Test getHalfExtents method
     */
    testGetHalfExtents: async function() {
        const aabb = new AABB(new Vec3(0, 0, 0), new Vec3(2, 4, 6));
        const halfExtents = aabb.getHalfExtents();
        
        this.assertVec3Equals(halfExtents, new Vec3(1, 2, 3),
            "getHalfExtents returned incorrect value");
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
        this.assertAABBEquals(
            intersection, 
            new AABB(new Vec3(1, 1, 1), new Vec3(2, 2, 2)),
            "getIntersection did not return correct result"
        );
        
        // Test non-intersecting boxes
        const aabb3 = new AABB(new Vec3(3, 3, 3), new Vec3(4, 4, 4));
        const noIntersection = aabb1.getIntersection(aabb3);
        
        this.assertAABBEquals(
            noIntersection,
            AABB.empty(),
            "getIntersection should return empty AABB for non-intersecting boxes"
        );
    },

    /**
     * Test getUnion method
     */
    testGetUnion: async function() {
        const aabb1 = new AABB(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
        const aabb2 = new AABB(new Vec3(2, 2, 2), new Vec3(3, 3, 3));
        
        const union = aabb1.getUnion(aabb2);
        
        this.assertAABBEquals(
            union,
            new AABB(new Vec3(0, 0, 0), new Vec3(3, 3, 3)),
            "getUnion did not return correct result"
        );
    },

    /**
     * Test getSubtraction method
     */
    testGetSubtraction: async function() {
        // Case 1: No intersection
        const aabb1 = new AABB(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
        const aabb2 = new AABB(new Vec3(2, 2, 2), new Vec3(3, 3, 3));
        
        const noIntersection = aabb1.getSubtraction(aabb2);
        this.assertAABBEquals(
            noIntersection,
            aabb1,
            "getSubtraction should return original AABB when there's no intersection"
        );
        
        // Case 2: Complete containment
        const aabb3 = new AABB(new Vec3(0.5, 0.5, 0.5), new Vec3(0.8, 0.8, 0.8));
        const aabb4 = new AABB(new Vec3(0, 0, 0), new Vec3(1, 1, 1));
        
        const completeContainment = aabb3.getSubtraction(aabb4);
        this.assertAABBEquals(
            completeContainment,
            AABB.empty(),
            "getSubtraction should return empty AABB when completely contained"
        );
        
        // Case 3: Partial intersection - X-axis cut through
        const aabb5 = new AABB(new Vec3(0, 0, 0), new Vec3(3, 3, 3));
        const aabb6 = new AABB(new Vec3(-1, 1, 1), new Vec3(4, 2, 2));
        
        const xAxisCut = aabb5.getSubtraction(aabb6);
        // Expected: An AABB containing both top and bottom parts
        const expectedXCut = new AABB(
            new Vec3(0, 0, 0),
            new Vec3(3, 3, 3)
        );
        this.assertAABBEquals(
            xAxisCut,
            expectedXCut,
            "getSubtraction should correctly handle X-axis cut through"
        );
        
        // Case 4: Partial intersection - Y-axis cut through
        const aabb7 = new AABB(new Vec3(0, 0, 0), new Vec3(3, 3, 3));
        const aabb8 = new AABB(new Vec3(1, -1, 1), new Vec3(2, 4, 2));
        
        const yAxisCut = aabb7.getSubtraction(aabb8);
        // Expected: An AABB containing both left and right parts
        const expectedYCut = new AABB(
            new Vec3(0, 0, 0),
            new Vec3(3, 3, 3)
        );
        this.assertAABBEquals(
            yAxisCut,
            expectedYCut,
            "getSubtraction should correctly handle Y-axis cut through"
        );
        
        // Case 5: Partial intersection - Z-axis cut through
        const aabb9 = new AABB(new Vec3(0, 0, 0), new Vec3(3, 3, 3));
        const aabb10 = new AABB(new Vec3(1, 1, -1), new Vec3(2, 2, 4));
        
        const zAxisCut = aabb9.getSubtraction(aabb10);
        this.assertAABBEquals(
            zAxisCut,
            new AABB(new Vec3(0, 0, 0), new Vec3(3, 3, 3)),
            "getSubtraction should return original AABB when subtraction box cuts completely through an axis"
        );
        
        // Case 6: Partial intersection - Corner removal
        const aabb11 = new AABB(new Vec3(0, 0, 0), new Vec3(4, 4, 4));
        const aabb12 = new AABB(new Vec3(3, 3, 3), new Vec3(5, 5, 5));
        
        const cornerRemoval = aabb11.getSubtraction(aabb12);
        // The corner is removed, but we still need the smallest AABB containing all parts
        // which is the original AABB in this case
        this.assertAABBEquals(
            cornerRemoval,
            aabb11,
            "getSubtraction should handle corner removal correctly"
        );
        
        // Case 7: Partial intersection - Narrow slice removal
        const aabb13 = new AABB(new Vec3(0, 0, 0), new Vec3(5, 5, 5));
        const aabb14 = new AABB(new Vec3(2, -1, -1), new Vec3(3, 6, 6));
        
        const sliceRemoval = aabb13.getSubtraction(aabb14);
        // This should keep left and right parts
        const expectedSliceResult = new AABB(new Vec3(0, 0, 0), new Vec3(5, 5, 5));
        this.assertAABBEquals(
            sliceRemoval,
            expectedSliceResult,
            "getSubtraction should handle slice removal correctly"
        );
    }
};
