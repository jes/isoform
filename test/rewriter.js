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
            this.testRewriteNoBlends2,
            this.testRewriteNoopBlend,
            this.testRewriteSimpleBlend,
            this.testRewriteSimpleBlendWithModifiers,
            this.testRewriteAllPairsBlends,
            this.testNoRewriteForLikeBlends,
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

    assertTrue: function(condition, message = "Truth check failed") {
        if (!condition) {
            throw new Error(`${message}:\n` + 
                `  Condition: ${condition}`);
        }
    },

    stringTree: function(tree) {
        let txt;
        if (tree.children.length > 0) {
            txt = tree.name;
            txt += "(";
            txt += tree.children.map(child => this.stringTree(child)).join(",");
            txt += ")";
        } else {
            txt = tree.displayName;
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
        let txt = '';
        if (tree.modifiers.length > 0) {
            txt += "modifier(";
            txt += tree.modifiers.map(modifier => modifier.name).join("");
            txt += ",";
        }
        txt += tree.type;
        if (tree.type == 'combinator') {
            txt += "(";
            txt += tree.treeNode.name + ",";
            txt += this.stringIntermediateTree(tree.left);
            txt += ",";
            txt += this.stringIntermediateTree(tree.right);
            txt += ")";
        } else if (tree.type == 'primitive') {
            txt += '(' + tree.treeNode.displayName + ')';
        } else {
            throw new Error('Unknown node type: ' + tree.type);
        }
        if (tree.modifiers.length > 0) {
            txt += ")";
        }
        return txt;
    },

    testNormalised: async function() {
        TreeNode.nextId = 1;
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
        this.assertEquals(this.stringTree(tree), "Union(Subtraction(Sphere1,Sphere2,Box3),Intersection(Sphere5,Box6,Gyroid7),Union(Sphere9,Gyroid10,Box11))");

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
        this.assertEquals(this.stringTree(treeNormalised), "Union(Union(Intersection(Intersection(Sphere1,Negate(Sphere2)),Negate(Box3)),Intersection(Intersection(Sphere5,Box6),Gyroid7)),Union(Union(Sphere9,Gyroid10),Box11))");

        this.checkParents(treeNormalised);

        // check that the original tree is unchanged
        this.assertEquals(tree.children.length, 3, "Original tree should have 3 children");
        for (const child of tree.children) {
            this.assertEquals(child.children.length, 3, "Original child should have 3 children");
        }
        this.assertEquals(this.stringTree(tree), "Union(Subtraction(Sphere1,Sphere2,Box3),Intersection(Sphere5,Box6,Gyroid7),Union(Sphere9,Gyroid10,Box11))");
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

            'Sphere': 'primitive',
            'Box': 'primitive',
            'Gyroid': 'primitive',
        }

        const t = TreeRewriter.fromTreeNode(tree.cloneWithSameIds().normalised());

        let count = 0;

        const dfs = (node) => {
            count++;
            if (node.type == 'combinator') {
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

        this.assertEquals(count, 11);

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
        this.assertEquals(origTreeString, "Union(Twist(Transform(Intersection(Intersection(DomainDeform(Sphere1),Negate(Sphere3)),Negate(Box4)))),Intersection(Intersection(Sphere8,Box9),Gyroid10))");
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
        this.assertEquals(origTreeString, "Union(Twist(Transform(Intersection(Intersection(DomainDeform(Sphere1),Negate(Sphere3)),Negate(Box4)))),Intersection(Intersection(Sphere8,Box9),Gyroid10))");
        this.assertEquals(this.stringIntermediateTree(intermediateTree), "combinator(Union,modifier(TwistTransform,combinator(Intersection,combinator(Intersection,modifier(DomainDeform,primitive(Sphere1)),modifier(Negate,primitive(Sphere3))),modifier(Negate,primitive(Box4)))),combinator(Intersection,combinator(Intersection,primitive(Sphere8),primitive(Box9)),primitive(Gyroid10)))");
    },

    // basic case 2: we ask for a blend with an id that is not present in the tree,
    // so we don't apply any blends
    testRewriteNoBlends2: async function() {
        TreeNode.nextId = 1;
        const sphere = new SphereNode();
        this.assertEquals(sphere.uniqueId, 1);
        const tree = new UnionNode([
            new TwistNode(new TransformNode(new SubtractionNode([
                new DomainDeformNode(new SphereNode()),
                sphere,
                new BoxNode(),
            ]))),
            new IntersectionNode([
                new SphereNode(),
                new BoxNode(),
                new GyroidNode(),
            ]),
        ]);
        tree.blends = new Set([
            {
                nodes: [sphere, new BoxNode()],
                blendRadius: 0.5,
                chamfer: 1.0,
            },
        ]);
        this.checkParents(tree);
        const treeNormalised = tree.cloneWithSameIds().normalised();
        const origTreeString = this.stringTree(treeNormalised);
        const intermediateTree = TreeRewriter.rewriteTree(TreeRewriter.fromTreeNode(treeNormalised));
        const newTree = TreeRewriter.toTreeNode(intermediateTree);
        this.checkParents(newTree);
        const newTreeString = this.stringTree(newTree);
        this.assertEquals(newTreeString, origTreeString);
        this.assertEquals(origTreeString, "Union(Twist(Transform(Intersection(Intersection(DomainDeform(Sphere2),Negate(Sphere1)),Negate(Box4)))),Intersection(Intersection(Sphere8,Box9),Gyroid10))");
        this.assertEquals(this.stringIntermediateTree(intermediateTree), "combinator(Union,modifier(TwistTransform,combinator(Intersection,combinator(Intersection,modifier(DomainDeform,primitive(Sphere2)),modifier(Negate,primitive(Sphere1))),modifier(Negate,primitive(Box4)))),combinator(Intersection,combinator(Intersection,primitive(Sphere8),primitive(Box9)),primitive(Gyroid10)))");
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
        const blends = new Set([new BlendNode(box, sphere, 0.5, 1.0)]);
        this.checkParents(tree);
        const treeNormalised = tree.cloneWithSameIds().normalised();
        const origTreeString = this.stringTree(treeNormalised);
        const intermediateTree = TreeRewriter.rewriteTree(TreeRewriter.fromTreeNode(treeNormalised), blends);
        const newTree = TreeRewriter.toTreeNode(intermediateTree);
        this.checkParents(newTree);
        const newTreeString = this.stringTree(newTree);
        this.assertEquals(newTreeString, origTreeString);
        this.assertEquals(origTreeString, "Union(Twist(Transform(Intersection(Intersection(DomainDeform(Sphere3),Negate(Sphere5)),Negate(Box6)))),DistanceDeform(Intersection(Intersection(Sphere1,Box2),Gyroid10)))");
        this.assertEquals(this.stringIntermediateTree(intermediateTree), "combinator(Union,modifier(TwistTransform,combinator(Intersection,combinator(Intersection,modifier(DomainDeform,primitive(Sphere3)),modifier(Negate,primitive(Sphere5))),modifier(Negate,primitive(Box6)))),modifier(DistanceDeform,combinator(Intersection,combinator(Intersection,primitive(Sphere1),primitive(Box2)),primitive(Gyroid10))))");

        // see if we can find the requested blend in the new tree
        let hasBlend = false;
        const dfs = (node) => {
            if (node.isCombinator
                && node.children[0].displayName == 'Sphere1'
                && node.children[1].displayName == 'Box2') {
                if (node.blendRadius == 0.5 && node.chamfer == 1.0) {
                    hasBlend = true;
                } else {
                    console.log("Bad blend:", node);
                }
            }
            for (const child of node.children) {
                dfs(child);
            }
        };
        dfs(newTree);
        if (!hasBlend) {
            throw new Error("Blend parameters weren't applied to the new tree");
        }
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
        const blends = new Set([new BlendNode(box, sphere, 0.5, 1.0)]);
        this.checkParents(tree);
        const treeNormalised = tree.cloneWithSameIds().normalised();
        const origTreeString = this.stringTree(treeNormalised);
        const intermediateTree = TreeRewriter.rewriteTree(TreeRewriter.fromTreeNode(treeNormalised), blends);
        const newTree = TreeRewriter.toTreeNode(intermediateTree);
        this.checkParents(newTree);
        const newTreeString = this.stringTree(newTree);
        this.assertEquals(origTreeString, "Union(Intersection(Sphere1,Gyroid3),Box2)");
        this.assertEquals(newTreeString, "Intersection(Union(Sphere1,Box2),Union(Gyroid3,Box2))");
        this.assertEquals(this.stringIntermediateTree(intermediateTree), "combinator(Intersection,combinator(Union,primitive(Sphere1),primitive(Box2)),combinator(Union,primitive(Gyroid3),primitive(Box2)))");
    },

    // same as testRewriteSimpleBlend, but with modifier chains
    // we have:
    //   Transform(Twist(Union(DomainDeform(Shell(Intersection(Sphere, Transform(Gyroid)))), Scale(Box)))
    // with a blend between Sphere and Box, so we need to rewrite to:
    //   Transform(Twist(Intersection(Union(DomainDeform(Shell(Sphere)),Scale(Box)),Union(DomainDeform(Shell(Transform(Gyroid))),Scale(Box)))))
    testRewriteSimpleBlendWithModifiers: async function() {
        console.log("testRewriteSimpleBlendWithModifiers");
        TreeNode.nextId = 1;
        const sphere = new SphereNode();
        this.assertEquals(sphere.uniqueId, 1);
        const box = new BoxNode();
        this.assertEquals(box.uniqueId, 2);
        const tree = new TransformNode(new TwistNode(new UnionNode([
            new DomainDeformNode(new ShellNode(new IntersectionNode([sphere, new TransformNode(new GyroidNode())]))),
            new ScaleNode(box),
        ])));
        tree.blends = new Set([
            {
                nodes: [sphere, box],
                blendRadius: 0.5,
                chamfer: 1.0,
            },
        ]);
        this.checkParents(tree);
        const treeNormalised = tree.cloneWithSameIds().normalised();
        const origTreeString = this.stringTree(treeNormalised);
        const intermediateTree = TreeRewriter.rewriteTree(TreeRewriter.fromTreeNode(treeNormalised), true);
        const newTree = TreeRewriter.toTreeNode(intermediateTree);
        this.checkParents(newTree);
        const newTreeString = this.stringTree(newTree);
        this.assertEquals(origTreeString, "Transform(Twist(Union(DomainDeform(Shell(Intersection(Sphere1,Transform(Gyroid3)))),Scale(Box2))))");
        this.assertEquals(newTreeString, "Transform(Twist(Intersection(Union(DomainDeform(Shell(Sphere1)),Scale(Box2)),Union(DomainDeform(Shell(Transform(Gyroid3))),Scale(Box2)))))");
        this.assertEquals(this.stringIntermediateTree(intermediateTree), "modifier(TransformTwist,combinator(Intersection,combinator(Union,modifier(DomainDeformShell,primitive(Sphere1)),modifier(Scale,primitive(Box2))),combinator(Union,modifier(DomainDeformShellTransform,primitive(Gyroid3)),modifier(Scale,primitive(Box2)))))");
    },

    // this test applies blends between every pair of primitives in the tree and checks
    // that each pair of primitives appears as siblings of exactly one combinator, and
    // that combinator has the correct blend parameters
    testRewriteAllPairsBlends: async function() {
        TreeNode.nextId = 1;
        const box = new BoxNode();
        this.assertEquals(box.uniqueId, 1);
        const sphere = new SphereNode();
        this.assertEquals(sphere.uniqueId, 2);
        const gyroid = new GyroidNode();
        this.assertEquals(gyroid.uniqueId, 3);
        const cylinder = new CylinderNode();
        this.assertEquals(cylinder.uniqueId, 4);
        const tree = new UnionNode([
            new IntersectionNode([sphere, gyroid]),
            new SubtractionNode([box, cylinder]),
        ]);
        tree.blends = new Set([
            {
                nodes: [sphere, box],
                blendRadius: 0.1,
                chamfer: 1.0,
            },
            {
                nodes: [box, cylinder],
                blendRadius: 0.2,
                chamfer: 1.0,
            },
            {
                nodes: [sphere, cylinder],
                blendRadius: 0.3,
                chamfer: 1.0,
            },
            {
                nodes: [gyroid, box],
                blendRadius: 0.4,
                chamfer: 1.0,
            },
            {
                nodes: [gyroid, cylinder],
                blendRadius: 0.5,
                chamfer: 1.0,
            },
            {
                nodes: [sphere, gyroid],
                blendRadius: 0.6,
                chamfer: 1.0,
            },
        ]);
        this.checkParents(tree);
        const newTree = TreeRewriter.rewrite(tree, true);
        this.checkParents(newTree);
        //this.assertEquals(this.stringTree(newTree), "Union(Intersection(Intersection(Intersection(Union(Sphere2,Box1),Union(Sphere2,Negate(Cylinder4))),Intersection(Union(Gyroid3,Box1),Union(Gyroid3,Negate(Cylinder4)))),Union(Intersection(Sphere2,Gyroid3),Gyroid3)),Intersection(Union(Sphere2,Intersection(Box1,Negate(Cylinder4))),Intersection(Box1,Negate(Cylinder4))))");
        let checked = new Set();
        const dfs = (node) => {
            if (node.isCombinator) {
                const left = node.children[0];
                const right = node.children[1];
                const leftIds = left.possibleSurfaceIds();
                const rightIds = right.possibleSurfaceIds();
                if (leftIds.size == 1 && rightIds.size == 1) {
                    const idLeft = Array.from(leftIds)[0];
                    const idRight = Array.from(rightIds)[0];
                    for (const blend of tree.blends) {
                        if ((blend.nodes[0].uniqueId == idLeft && blend.nodes[1].uniqueId == idRight) ||
                            (blend.nodes[0].uniqueId == idRight && blend.nodes[1].uniqueId == idLeft)) {
                            if (node.blendRadius !== blend.blendRadius || node.chamfer !== blend.chamfer) {
                                console.log(`Blend parameters mismatch for ${idLeft},${idRight}: expected radius=${blend.blendRadius}, chamfer=${blend.chamfer} but got radius=${node.blendRadius}, chamfer=${node.chamfer}`);
                            }
                            checked.add(blend);
                        }
                    }
                }
            }
            for (const child of node.children) {
                dfs(child);
            }
        };
        dfs(newTree);
        const checkedString = Array.from(checked).map(blend => `(${blend.nodes[0].displayName},${blend.nodes[1].displayName})`).join(',');
        this.assertEquals(checked.size, 6, "Combinators should all have been checked, only saw: " + checkedString);
    },

    testNoRewriteForLikeBlends: async function() {
        TreeNode.nextId = 1;
        const sphere = new SphereNode();
        this.assertEquals(sphere.uniqueId, 1);
        const box = new BoxNode();
        this.assertEquals(box.uniqueId, 2);
        const gyroid = new GyroidNode();
        this.assertEquals(gyroid.uniqueId, 3);
        const tree = new UnionNode([
            new IntersectionNode([sphere, box]),
            gyroid,
        ]);
        tree.blends = new Set([
            {
                nodes: [sphere, gyroid],
                blendRadius: 0.5,
                chamfer: 1.0,
            },
            {
                nodes: [box, gyroid],
                blendRadius: 0.5,
                chamfer: 1.0,
            },
        ]);
        this.checkParents(tree);
        const newTree = TreeRewriter.rewrite(tree);
        this.checkParents(newTree);
        this.assertEquals(this.stringTree(newTree), "Union(Intersection(Sphere1,Box2),Gyroid3)");
        this.assertEquals(newTree.name, "Union");
        this.assertEquals(newTree.blendRadius, 0.5);
        this.assertEquals(newTree.chamfer, 1.0);
    },
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
