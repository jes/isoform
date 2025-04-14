const TreeNodeTests = {
    run: async function() {
        const tests = [
            this.testConstructor,
            this.testParentChildRelationship,
            this.testAddChild,
            this.testRemoveChild,
            this.testTraversal,
            this.testFindNode,
            this.testDepth,
            this.testClone,
            this.testSerialize,
            this.testDeserialize,
            this.testReplaceChild
        ];
        
        let passCount = 0;
        let results = [];
        
        for (const test of tests) {
            try {
                await test.call(this);
                passCount++;
                results.push({
                    passed: true,
                    name: test.name
                });
            } catch (error) {
                results.push({
                    passed: false,
                    name: test.name,
                    error: error.message,
                    sourceLocation: error.stack
                });
            }
        }
        
        return results;
    },
    
    assertEquals: function(actual, expected, message) {
        if (expected instanceof Vec3) {
            if (!(actual instanceof Vec3) || !actual.equals(expected)) {
                throw new Error(message || `Expected ${expected}, got ${actual}`);
            }
        } else if (expected instanceof TreeNode) {
            if (JSON.stringify(actual.serialize()) !== JSON.stringify(expected.serialize())) {
                throw new Error(message || `Expected ${expected}, got ${actual}`);
            }
        } else if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(message || `Expected ${expected}, got ${actual}`);
        }
    },
    
    assertNotEquals: function(actual, expected, message) {
        if (expected instanceof Vec3) {
            if (actual instanceof Vec3 && actual.equals(expected)) {
                throw new Error(message || `Expected not ${expected}, got ${actual}`);
            }
        } else if (JSON.stringify(actual) === JSON.stringify(expected)) {
            throw new Error(message || `Expected not ${expected}, got ${actual}`);
        }
    },
    
    testConstructor: function() {
        // Test basic constructor
        const node = new TreeNode("TestNode");
        this.assertEquals(node.name, "TestNode", "Name should be set correctly");
        this.assertEquals(node.children.length, 0, "New node should have no children");
        this.assertEquals(node.parent, null, "New node should have no parent");
        this.assertEquals(node.maxChildren, 0, "Default maxChildren should be 0");
        this.assertEquals(node.isDirty, true, "New node should be dirty");
        this.assertEquals(node.isDisabled, false, "New node should not be disabled");
        
        // Test surfaceId increment
        const prevId = TreeNode.nextId - 1;
        this.assertEquals(node.surfaceId, prevId, "Node should have correct unique ID");
        
        // Test displayName
        this.assertEquals(node.displayName, `TestNode${prevId}`, "DisplayName should combine name and surfaceId");
    },
    
    testParentChildRelationship: function() {
        const parent = new TreeNode("Parent");
        parent.maxChildren = 2;
        const child1 = new TreeNode("Child1");
        const child2 = new TreeNode("Child2");
        
        parent.addChild(child1);
        this.assertEquals(child1.parent, parent, "Child should reference parent");
        this.assertEquals(parent.children.length, 1, "Parent should have one child");
        this.assertEquals(parent.children[0], child1, "Parent's child should be child1");
        
        parent.addChild(child2);
        this.assertEquals(child2.parent, parent, "Child2 should reference parent");
        this.assertEquals(parent.children.length, 2, "Parent should have two children");
        
        // Test hasParent
        this.assertEquals(child1.hasParent(parent), true, "Child should recognize its parent");
        this.assertEquals(parent.hasParent(child1), false, "Parent should not recognize child as parent");
        
        // Test containsNode
        this.assertEquals(parent.containsNode(child1), true, "Parent should contain child");
        this.assertEquals(child1.containsNode(parent), false, "Child should not contain parent");
    },
    
    testAddChild: function() {
        const parent = new TreeNode("Parent");
        parent.maxChildren = 3;
        const child1 = new TreeNode("Child1");
        const child2 = new TreeNode("Child2");
        const child3 = new TreeNode("Child3");
        
        // Test single child addition
        parent.addChild(child1);
        this.assertEquals(parent.children.length, 1, "Parent should have one child");
        
        // Test multiple children addition
        const addedNodes = parent.addChild([child2, child3]);
        this.assertEquals(parent.children.length, 3, "Parent should have three children");
        this.assertEquals(addedNodes.length, 2, "Should return array of added nodes");
        
        // Test maxChildren limit
        try {
            const extraChild = new TreeNode("ExtraChild");
            parent.addChild(extraChild);
            throw new Error("Should have thrown error for exceeding maxChildren");
        } catch (error) {
            // Expected error
            this.assertEquals(parent.children.length, 3, "Parent should still have three children");
        }
        
        // Test reparenting
        const newParent = new TreeNode("NewParent");
        newParent.maxChildren = 1;
        newParent.addChild(child1);
        this.assertEquals(parent.children.length, 2, "Original parent should lose child");
        this.assertEquals(newParent.children.length, 1, "New parent should gain child");
        this.assertEquals(child1.parent, newParent, "Child should reference new parent");
    },
    
    testRemoveChild: function() {
        const parent = new TreeNode("Parent");
        parent.maxChildren = 3;
        const child1 = new TreeNode("Child1");
        const child2 = new TreeNode("Child2");
        const child3 = new TreeNode("Child3");
        
        parent.addChild([child1, child2, child3]);
        this.assertEquals(parent.children.length, 3, "Parent should have three children");
        
        // Test single child removal
        const removed = parent.removeChild(child2);
        this.assertEquals(removed, true, "removeChild should return true for success");
        this.assertEquals(parent.children.length, 2, "Parent should have two children");
        this.assertEquals(child2.parent, null, "Removed child should have null parent");
        
        // Test multiple children removal
        const multiRemoved = parent.removeChild([child1, child3]);
        this.assertEquals(multiRemoved.every(r => r === true), true, "All removals should succeed");
        this.assertEquals(parent.children.length, 0, "Parent should have no children");
        
        // Test removing non-existent child
        const nonRemoved = parent.removeChild(child1);
        this.assertEquals(nonRemoved, false, "removeChild should return false for non-existent child");
        
        // Test delete method
        parent.addChild(child1);
        child1.delete();
        this.assertEquals(parent.children.length, 0, "Parent should have no children after child deletes itself");
        this.assertEquals(child1.parent, null, "Deleted child should have null parent");
    },
    
    testTraversal: function() {
        // Create a tree structure
        const root = new TreeNode("Root");
        root.maxChildren = null; // unlimited children
        
        const child1 = new TreeNode("Child1");
        child1.maxChildren = 2;
        const child2 = new TreeNode("Child2");
        child2.maxChildren = 2;
        
        const grandchild1 = new TreeNode("GrandChild1");
        const grandchild2 = new TreeNode("GrandChild2");
        const grandchild3 = new TreeNode("GrandChild3");
        
        root.addChild([child1, child2]);
        child1.addChild(grandchild1);
        child2.addChild([grandchild2, grandchild3]);
        
        // Test getChildren
        const rootChildren = root.getChildren();
        this.assertEquals(rootChildren.length, 2, "Root should have two children");
        this.assertEquals(rootChildren[0], child1, "First child should be child1");
        
        // Test hasChildren
        this.assertEquals(root.hasChildren(), true, "Root should have children");
        this.assertEquals(grandchild1.hasChildren(), false, "Grandchild should not have children");
        
        // Test dfsUsedNames
        const usedNames = root.dfsUsedNames();
        this.assertEquals(usedNames.size, 6, "Should find all node display names");
        this.assertEquals(usedNames.has(root.displayName), true, "Should contain root display name");
        this.assertEquals(usedNames.has(grandchild3.displayName), true, "Should contain leaf display name");
    },
    
    testFindNode: function() {
        // Create a tree structure
        const root = new TreeNode("Root");
        root.maxChildren = null;
        
        const child1 = new TreeNode("Child1");
        child1.maxChildren = 1;
        const child2 = new TreeNode("Child2");
        child2.maxChildren = 1;
        
        const grandchild1 = new TreeNode("GrandChild1");
        const grandchild2 = new TreeNode("GrandChild2");
        
        root.addChild([child1, child2]);
        child1.addChild(grandchild1);
        child2.addChild(grandchild2);
        
        // We don't have a built-in findNode method, so we'll create one for testing
        function findNodeById(node, id) {
            if (node.surfaceId === id) return node;
            for (const child of node.children) {
                const found = findNodeById(child, id);
                if (found) return found;
            }
            return null;
        }
        
        // Test finding by ID
        const found = findNodeById(root, grandchild1.surfaceId);
        this.assertEquals(found, grandchild1, "Should find node by ID");
        
        // Test with non-existent ID
        const notFound = findNodeById(root, 99999);
        this.assertEquals(notFound, null, "Should return null for non-existent ID");
    },
    
    testDepth: function() {
        // Create a tree structure
        const root = new TreeNode("Root");
        root.maxChildren = null;
        
        const child1 = new TreeNode("Child1");
        child1.maxChildren = 1;
        const child2 = new TreeNode("Child2");
        child2.maxChildren = 1;
        
        const grandchild1 = new TreeNode("GrandChild1");
        
        root.addChild([child1, child2]);
        child1.addChild(grandchild1);
        
        // Helper to calculate depth
        function getDepth(node) {
            if (!node.parent) return 0;
            return 1 + getDepth(node.parent);
        }
        
        this.assertEquals(getDepth(root), 0, "Root depth should be 0");
        this.assertEquals(getDepth(child1), 1, "Child depth should be 1");
        this.assertEquals(getDepth(grandchild1), 2, "Grandchild depth should be 2");
    },
    
    testClone: function() {
        // Create a tree structure
        const root = new TreeNode("Root");
        root.maxChildren = null;
        
        const child1 = new TreeNode("Child1");
        child1.maxChildren = 2;
        root.addChild(child1);
        
        // Set some custom properties
        root.customProp = "custom";
        root.blendRadius = 0.5;
        
        // Clone the root
        const cloned = root.clone();
        
        // Test basic properties
        this.assertNotEquals(cloned.surfaceId, root.surfaceId, "Cloned node should have different ID");
        this.assertEquals(cloned.name, root.name, "Cloned node should have same name");
        this.assertNotEquals(cloned.displayName, root.displayName, "Cloned node should have different display name");
        this.assertEquals(cloned.maxChildren, root.maxChildren, "Cloned node should have same maxChildren");
        this.assertEquals(cloned.customProp, root.customProp, "Custom properties should be cloned");
        this.assertEquals(cloned.blendRadius, root.blendRadius, "Blend radius should be cloned");
        
        // Test cloned structure
        this.assertEquals(cloned.children.length, 1, "Cloned node should have one child");
        this.assertNotEquals(cloned.children[0].surfaceId, child1.surfaceId, "Cloned child should have different ID");
        this.assertEquals(cloned.children[0].name, child1.name, "Cloned child should have same name");
        this.assertEquals(cloned.children[0].parent, cloned, "Cloned child should reference cloned parent");
    },
    
    testSerialize: function() {
        // Create a tree structure
        const root = new TreeNode("Root");
        root.maxChildren = null;
        root.blendRadius = 0.5;
        
        const child = new TreeNode("Child");
        child.maxChildren = 1;
        root.addChild(child);
        
        // Add a Vec3 property
        const position = new Vec3(1, 2, 3);
        child.position = position;
        
        // Serialize
        const serialized = root.serialize();
        
        // Test serialized data
        this.assertEquals(serialized.type, "TreeNode", "Serialized type should be TreeNode");
        this.assertEquals(serialized.name, "Root", "Serialized name should match");
        this.assertEquals(serialized.blendRadius, 0.5, "Serialized blendRadius should match");
        this.assertEquals(serialized.children.length, 1, "Serialized node should have one child");
        this.assertEquals(serialized.children[0].name, "Child", "Serialized child name should match");
        this.assertEquals(serialized.children[0].position.isVec3, true, "Vector should be marked as Vec3");
        this.assertEquals(serialized.children[0].position.x, 1, "Vec3 x component should be preserved");
        this.assertEquals(serialized.children[0].position.y, 2, "Vec3 y component should be preserved");
        this.assertEquals(serialized.children[0].position.z, 3, "Vec3 z component should be preserved");
    },
    
    testDeserialize: function() {
        // Create a tree structure
        const root = new TreeNode("Root");
        root.maxChildren = null;
        root.blendRadius = 0.5;
        
        const child = new TreeNode("Child");
        child.maxChildren = 1;
        child.position = new Vec3(1, 2, 3);
        root.addChild(child);
        
        // Serialize and then deserialize
        const serialized = root.serialize();
        const deserialized = TreeNode.fromSerialized(serialized);
        
        // Test deserialized data
        this.assertEquals(deserialized.name, root.name, "Deserialized name should match");
        this.assertEquals(deserialized.blendRadius, root.blendRadius, "Deserialized blendRadius should match");
        this.assertEquals(deserialized.children.length, 1, "Deserialized node should have one child");
        this.assertEquals(deserialized.children[0].name, child.name, "Deserialized child name should match");
        
        // Check Vec3 property
        this.assertEquals(deserialized.children[0].position instanceof Vec3, true, "Position should be a Vec3");
        this.assertEquals(deserialized.children[0].position.x, 1, "Vec3 x component should be preserved");
        this.assertEquals(deserialized.children[0].position.y, 2, "Vec3 y component should be preserved");
        this.assertEquals(deserialized.children[0].position.z, 3, "Vec3 z component should be preserved");
    },
    
    testReplaceChild: function() {
        const parent = new TreeNode("Parent");
        parent.maxChildren = null;
        
        const oldChild = new TreeNode("OldChild");
        const newChild = new TreeNode("NewChild");
        const newChild2 = new TreeNode("NewChild2");
        
        parent.addChild(oldChild);
        this.assertEquals(parent.children.length, 1, "Parent should have one child");
        this.assertEquals(parent.children[0], oldChild, "Parent's child should be oldChild");
        
        // Test replacing with single child
        parent.replaceChild(oldChild, newChild);
        this.assertEquals(parent.children.length, 1, "Parent should still have one child");
        this.assertEquals(parent.children[0], newChild, "Parent's child should now be newChild");
        this.assertEquals(oldChild.parent, null, "Old child should no longer have a parent");
        this.assertEquals(newChild.parent, parent, "New child should reference parent");
        
        // Test replacing with multiple children
        parent.replaceChild(newChild, [oldChild, newChild2]);
        this.assertEquals(parent.children.length, 2, "Parent should now have two children");
        this.assertEquals(parent.children[0], oldChild, "First child should be oldChild");
        this.assertEquals(parent.children[1], newChild2, "Second child should be newChild2");
    }
};

// Detect environment and export accordingly
(function() {
    const nodes = { TreeNodeTests };
    
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