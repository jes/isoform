/**
 * Unit tests for the Rewriter functionality
 */
const RewriterTests = {
    /**
     * Run all Rewriter tests
     * @returns {Array} Array of test results
     */
    run: async function() {
        const tests = [
            this.testNormalised,
            this.testFromTreeNode,
            this.testToTreeNode,
            this.testRewriteNoBlends,
            this.testRewriteNoopBlend,
            this.testRewriteSimpleBlend,
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
     * Helper method to assert equality
     * @param {any} actual The actual value
     * @param {any} expected The expected value
     * @param {string} message Optional message prefix for the error
     */
    assertEquals: function(actual, expected, message = "Equality check failed") {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`${message}:\n` + 
                `  Expected: ${JSON.stringify(expected)}\n` +
                `  Actual:   ${JSON.stringify(actual)}`);
        }
    },

    assertNotEquals: function(actual, expected, message = "Inequality check failed") {
        if (JSON.stringify(actual) === JSON.stringify(expected)) {
            throw new Error(`${message}:\n` + 
                `  Expected: ${JSON.stringify(expected)}\n` +
                `  Actual:   ${JSON.stringify(actual)}`);
        }
    },

    stringTree: function(tree) {
        let txt = tree.name;
        if (tree.children.length > 0) {
            txt += "(";
            txt += tree.children.map(child => this.stringTree(child)).join(",");
            txt += ")";
        }
        return txt;
    },

    checkParents: function(tree) {
        for (const child of tree.children) {
            if (child.parent != tree) {
                console.log(tree);
                throw new Error("Parent of child should be self");
            }
            this.checkParents(child);
        }
    },

    stringIntermediateTree: function(tree) {
        let txt = tree.type;
        if (tree.type == 'combinator') {
            txt += "(";
            txt += tree.treeNode.name + ",";
            txt += this.stringIntermediateTree(tree.left);
            txt += ",";
            txt += this.stringIntermediateTree(tree.right);
            txt += ")";
        } else if (tree.type == 'modifier') {
            let node = tree.treeNode;
            let modifierChain = '';
            while (node.children.length == 1) {
                modifierChain += node.name;
                node = node.children[0];
            }
            txt += "(";
            txt += modifierChain + ",";
            txt += this.stringIntermediateTree(tree.child);
            txt += ")";
        } else if (tree.type == 'primitive') {
            txt += '(' + tree.treeNode.displayName + ')';
        } else {
            throw new Error('Unknown node type: ' + tree.type);
        }
        return txt;
    },

    testNormalised: async function() {
        const tree = new UnionNode([
            new SubtractionNode([
                new SphereNode(),
                new SphereNode(),
                new BoxNode(),
            ]),
            new IntersectionNode([
                new SphereNode(),
                new BoxNode(),
                new GyroidNode(),
            ]),
            new UnionNode([
                new SphereNode(),
                new GyroidNode(),
                new BoxNode(),
            ]),
        ]);

        this.checkParents(tree);

        const origSurfaceIds = tree.possibleSurfaceIds();

        this.assertEquals(origSurfaceIds.size, 9, "Original tree should have 9 surface ids");

        // check that the starting tree has 3 children, and so does each child
        this.assertEquals(tree.children.length, 3, "Tree should have 3 children");
        for (const child of tree.children) {
            this.assertEquals(child.children.length, 3, "Child should have 3 children");
        }

        // check that the starting tree is of the right form when stringified
        this.assertEquals(this.stringTree(tree), "Union(Subtraction(Sphere,Sphere,Box),Intersection(Sphere,Box,Gyroid),Union(Sphere,Gyroid,Box))");

        const treeNormalised = tree.cloneWithSameIds().normalised();

        const newSurfaceIds = treeNormalised.possibleSurfaceIds();
        this.assertEquals(newSurfaceIds.size, origSurfaceIds.size, "Normalised tree should have the same number of surface ids as the original tree");
        
        // Check that the sets contain the same elements
        const origArray = Array.from(origSurfaceIds).sort();
        const newArray = Array.from(newSurfaceIds).sort();
        this.assertEquals(newArray, origArray, "Normalised tree should have the same surface ids as the original tree");

        // check that the normalised tree has 2 children, and recursively each child
        // either is a combinator with 2 children or is not a combinator
        let count = 0;
        const checkNode = (node) => {
            count++;
            if (node.isCombinator) {
                this.assertEquals(node.children.length, 2, "Combinator should have 2 children");
            }
            for (const child of node.children) {
                checkNode(child);
            }
        }
        checkNode(treeNormalised);

        // check that we checked the right number of nodes
        this.assertEquals(count, 19);

        // check that the normalised tree is of the right form when stringified
        this.assertEquals(this.stringTree(treeNormalised), "Union(Union(Intersection(Intersection(Sphere,Negate(Sphere)),Negate(Box)),Intersection(Intersection(Sphere,Box),Gyroid)),Union(Union(Sphere,Gyroid),Box))");

        this.checkParents(treeNormalised);

        // check that the original tree is unchanged
        this.assertEquals(tree.children.length, 3, "Original tree should have 3 children");
        for (const child of tree.children) {
            this.assertEquals(child.children.length, 3, "Original child should have 3 children");
        }
        this.assertEquals(this.stringTree(tree), "Union(Subtraction(Sphere,Sphere,Box),Intersection(Sphere,Box,Gyroid),Union(Sphere,Gyroid,Box))");
    },

    testFromTreeNode: async function() {
        TreeNode.nextId = 1;
        const tree = new UnionNode([
            new TwistNode(new TransformNode(new SubtractionNode([
                new DomainDeformNode(new SphereNode()),
                new SphereNode(),
                new BoxNode(),
            ]))),
            new IntersectionNode([
                new SphereNode(),
                new BoxNode(),
                new GyroidNode(),
            ]),
        ]);
        this.checkParents(tree);

        const typeMap = {
            'Union': 'combinator',
            'Subtraction': 'combinator',
            'Intersection': 'combinator',

            'DomainDeform': 'modifier',
            'Negate': 'modifier',
            'Transform': 'modifier',
            'Twist': 'modifier',

            'Sphere': 'primitive',
            'Box': 'primitive',
            'Gyroid': 'primitive',
        }

        const t = TreeRewriter.fromTreeNode(tree.cloneWithSameIds().normalised());

        let count = 0;

        const dfs = (node) => {
            count++;
            if (node.type == 'modifier') {
                this.assertEquals(typeMap[node.treeNode.name], 'modifier', "Modifier should have a modifier treeNode");
                this.assertNotEquals(node.child.type, 'modifier', "Modifier chain should be collapsed into one node");
                if (node.left || node.right) {
                    throw new Error("Modifier should not have boolean children");
                }
                if (!node.child) {
                    throw new Error("Modifier should have a child");
                }
                dfs(node.child);
            } else if (node.type == 'combinator') {
                this.assertEquals(typeMap[node.treeNode.name], 'combinator', "Combinator should have a combinator treeNode");
                if (!node.left || !node.right) {
                    throw new Error("Combinator should have two children");
                }
                if (node.child) {
                    throw new Error("Combinator should not have a unary child");
                }
                this.assertEquals(node.treeNode.isCombinator, true, "Combinator should have a combinator treeNode");
                dfs(node.left);
                dfs(node.right);
            } else if (node.type == 'primitive') {
                this.assertEquals(typeMap[node.treeNode.name], 'primitive', "Primitive should have a primitive treeNode");
                if (node.left || node.right || node.child) {
                    throw new Error("Primitive should not have any children");
                }
            } else {
                throw new Error('Unknown node type: ' + node.type);
            }
        }
        dfs(t);

        this.assertEquals(count, 15);

        this.assertEquals(this.stringIntermediateTree(t), "combinator(Union,modifier(TwistTransform,combinator(Intersection,combinator(Intersection,modifier(DomainDeform,primitive(Sphere1)),modifier(Negate,primitive(Sphere3))),modifier(Negate,primitive(Box4)))),combinator(Intersection,combinator(Intersection,primitive(Sphere8),primitive(Box9)),primitive(Gyroid10)))");
    },

    testToTreeNode: async function() {
        TreeNode.nextId = 1;
        const tree = new UnionNode([
            new TwistNode(new TransformNode(new SubtractionNode([
                new DomainDeformNode(new SphereNode()),
                new SphereNode(),
                new BoxNode(),
            ]))),
            new IntersectionNode([
                new SphereNode(),
                new BoxNode(),
                new GyroidNode(),
            ]),
        ]);
        this.checkParents(tree);
        const treeNormalised = tree.cloneWithSameIds().normalised();
        const origTreeString = this.stringTree(treeNormalised);
        const intermediateTree = TreeRewriter.fromTreeNode(treeNormalised);
        const newTree = TreeRewriter.toTreeNode(intermediateTree);
        this.checkParents(newTree);
        const newTreeString = this.stringTree(newTree);
        this.assertEquals(newTreeString, origTreeString);
        this.assertEquals(origTreeString, "Union(Twist(Transform(Intersection(Intersection(DomainDeform(Sphere),Negate(Sphere)),Negate(Box)))),Intersection(Intersection(Sphere,Box),Gyroid))");
        this.assertEquals(this.stringIntermediateTree(intermediateTree), "combinator(Union,modifier(TwistTransform,combinator(Intersection,combinator(Intersection,modifier(DomainDeform,primitive(Sphere1)),modifier(Negate,primitive(Sphere3))),modifier(Negate,primitive(Box4)))),combinator(Intersection,combinator(Intersection,primitive(Sphere8),primitive(Box9)),primitive(Gyroid10)))");
    },

    // basic case: we don't ask for any blends, so produce a tree that is identical
    // to the original
    testRewriteNoBlends: async function() {
        TreeNode.nextId = 1;
        const tree = new UnionNode([
            new TwistNode(new TransformNode(new SubtractionNode([
                new DomainDeformNode(new SphereNode()),
                new SphereNode(),
                new BoxNode(),
            ]))),
            new IntersectionNode([
                new SphereNode(),
                new BoxNode(),
                new GyroidNode(),
            ]),
        ]);
        this.checkParents(tree);
        const treeNormalised = tree.cloneWithSameIds().normalised();
        const origTreeString = this.stringTree(treeNormalised);
        const intermediateTree = TreeRewriter.rewriteTree(TreeRewriter.fromTreeNode(treeNormalised));
        const newTree = TreeRewriter.toTreeNode(intermediateTree);
        this.checkParents(newTree);
        const newTreeString = this.stringTree(newTree);
        this.assertEquals(newTreeString, origTreeString);
        this.assertEquals(origTreeString, "Union(Twist(Transform(Intersection(Intersection(DomainDeform(Sphere),Negate(Sphere)),Negate(Box)))),Intersection(Intersection(Sphere,Box),Gyroid))");
        this.assertEquals(this.stringIntermediateTree(intermediateTree), "combinator(Union,modifier(TwistTransform,combinator(Intersection,combinator(Intersection,modifier(DomainDeform,primitive(Sphere1)),modifier(Negate,primitive(Sphere3))),modifier(Negate,primitive(Box4)))),combinator(Intersection,combinator(Intersection,primitive(Sphere8),primitive(Box9)),primitive(Gyroid10)))");
    },

    // easy case: we *do* ask for a blend, but it doesn't require any rewriting
    // of the tree
    testRewriteNoopBlend: async function() {
        TreeNode.nextId = 1;
        const sphere = new SphereNode();
        this.assertEquals(sphere.uniqueId, 1);
        const box = new BoxNode();
        this.assertEquals(box.uniqueId, 2);
        const tree = new UnionNode([
            new TwistNode(new TransformNode(new SubtractionNode([
                new DomainDeformNode(new SphereNode()),
                new SphereNode(),
                new BoxNode(),
            ]))),
            new DistanceDeformNode(new IntersectionNode([
                sphere,
                box,
                new GyroidNode(),
            ])),
        ]);
        tree.blends = [
            {
                nodes: [sphere, box],
                blendRadius: 0.5,
                chamfer: 1.0,
            },
        ];
        this.checkParents(tree);
        const treeNormalised = tree.cloneWithSameIds().normalised();
        const origTreeString = this.stringTree(treeNormalised);
        const intermediateTree = TreeRewriter.rewriteTree(TreeRewriter.fromTreeNode(treeNormalised));
        const newTree = TreeRewriter.toTreeNode(intermediateTree);
        this.checkParents(newTree);
        const newTreeString = this.stringTree(newTree);
        this.assertEquals(newTreeString, origTreeString);
        this.assertEquals(origTreeString, "Union(Twist(Transform(Intersection(Intersection(DomainDeform(Sphere),Negate(Sphere)),Negate(Box)))),DistanceDeform(Intersection(Intersection(Sphere,Box),Gyroid)))");
        this.assertEquals(this.stringIntermediateTree(intermediateTree), "combinator(Union,modifier(TwistTransform,combinator(Intersection,combinator(Intersection,modifier(DomainDeform,primitive(Sphere3)),modifier(Negate,primitive(Sphere5))),modifier(Negate,primitive(Box6)))),modifier(DistanceDeform,combinator(Intersection,combinator(Intersection,primitive(Sphere1),primitive(Box2)),primitive(Gyroid10))))");
    },

    // simple blend case: we ask for a blend, and it requires one application
    // of the distributivity rule, with no modifier chains
    //
    // we have:
    //   Union(Intersection(Sphere, Gyroid), Box)
    // with a blend between Sphere and Box, so we need to rewrite to:
    //   Intersection(Union(Sphere, Box), Union(Gyroid, Box))
    testRewriteSimpleBlend: async function() {
        TreeNode.nextId = 1;
        const sphere = new SphereNode();
        this.assertEquals(sphere.uniqueId, 1);
        const box = new BoxNode();
        this.assertEquals(box.uniqueId, 2);
        const tree = new UnionNode([
            new IntersectionNode([sphere, new GyroidNode()]),
            box,
        ]);
        tree.blends = [
            {
                nodes: [sphere, box],
                blendRadius: 0.5,
                chamfer: 1.0,
            },
        ];
        this.checkParents(tree);
        console.log(tree);
        const treeNormalised = tree.cloneWithSameIds().normalised();
        const origTreeString = this.stringTree(treeNormalised);
        const intermediateTree = TreeRewriter.rewriteTree(TreeRewriter.fromTreeNode(treeNormalised));
        const newTree = TreeRewriter.toTreeNode(intermediateTree);
        this.checkParents(newTree);
        const newTreeString = this.stringTree(newTree);
        this.assertEquals(newTreeString, "Intersection(Union(Sphere,Box),Union(Gyroid,Box))");
        this.assertEquals(origTreeString, "Union(Intersection(Sphere,Gyroid),Box)");
        this.assertEquals(this.stringIntermediateTree(intermediateTree), "combinator(Intersection,combinator(Union,primitive(Sphere1),primitive(Box2)),combinator(Union,primitive(Gyroid3),primitive(Box2)))");
    },

    // TODO: more complex tests that includes modifier chains
    // TODO: very complex test that includes distinct blends between every pair of primitives
};

// Detect environment and export accordingly
(function() {
    const nodes = { RewriterTests };
    
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
