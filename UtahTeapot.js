
/**
 * @file A simple WebGL example for viewing meshes read from OBJ files
 * @author Justin Chan
 */

/** @global The WebGL context */
var gl;

/** @global The HTML5 canvas we draw on */
var canvas;

/** @global A simple GLSL shader program */
var shaderProgram;

var shaderProgramSB;

var shaderProgramReflect;

/** @global The Modelview matrix */
var mvMatrix = mat4.create();

/** @global The View matrix */
var vMatrix = mat4.create();

/** @global The Projection matrix */
var pMatrix = mat4.create();

/** @global The Normal matrix */
var nMatrix = mat3.create();

/** @global The rotation matrix */
var rMatrix = mat4.create();

/** @global The matrix stack for hierarchical modeling */
var mvMatrixStack = [];

/** @global An object holding the geometry for a 3D mesh */
var myMesh;

// Stores texture coords for the cube
var cubeTCoordBuffer;

// Stores cube's vertices
var cubeVertexBuffer;

// Stores cube's triangles
var cubeTriIndexBuffer;

// stores cube texture
var cubeTexture;

// View parameters
/** @global Location of the camera in world coordinates */
var eyePt = vec3.fromValues(0.0,2.0,14.0);
/** @global Direction of the view in world coordinates */
var viewDir = vec3.fromValues(0.0,0.0,-1.0);
/** @global Up vector for view matrix creation, in world coordinates */
var up = vec3.fromValues(0.0,1.0,0.0);
/** @global Location of a point along viewDir in world coordinates */
var viewPt = vec3.fromValues(0.0,0.0,0.0);

//Light parameters
/** @global Light position in VIEW coordinates */
var lightPosition = [30,30,30];
/** @global Ambient light color/intensity for Phong reflection */
var lAmbient = [0,0,0];
/** @global Diffuse light color/intensity for Phong reflection */
var lDiffuse = [1,1,1];
/** @global Specular light color/intensity for Phong reflection */
var lSpecular =[1,1,1];

//Material parameters
/** @global Ambient material color/intensity for Phong reflection */
var kAmbient = [1.0,1.0,1.0];
/** @global Diffuse material color/intensity for Phong reflection */
var kTerrainDiffuse = [205.0/255.0,163.0/255.0,63.0/255.0];
/** @global Specular material color/intensity for Phong reflection */
var kSpecular = [1.0,1.0,1.0];
/** @global Shininess exponent for Phong reflection */
var shininess = 23;
/** @global Edge color fpr wireframeish rendering */
var kEdgeBlack = [0.0,0.0,0.0];
/** @global Edge color for wireframe rendering */
var kEdgeWhite = [1.0,1.0,1.0];


//Model parameters
var orbitEulerY=0;

// Parameters for teapot rotation.
var teapotEulerY = 0;
var teapotEulerX = 0;

//-------------------------------------------------------------------------
/**
 * Asynchronously read a server-side text file
 */
function asyncGetFile(url) {
  //Your code here
    console.log("Getting text file");
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url);
        xhr.onload = () => resolve(xhr.responseText);
        xhr.onerror = () => resolve(xhr.statusText);
        xhr.send();
        console.log("Made promise");
    }); 
}

//-------------------------------------------------------------------------
/**
 * Sends Modelview matrix to shader
 */
function uploadModelViewMatrixToShader() {
  gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
}

//-------------------------------------------------------------------------
/**
 * Sends projection matrix to shader
 */
function uploadProjectionMatrixToShader() {
  gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, 
                      false, pMatrix);
}

//-------------------------------------------------------------------------
/**
 * Generates and sends the normal matrix to the shader
 */
function uploadNormalMatrixToShader() {
  mat3.fromMat4(nMatrix,mvMatrix);
  mat3.transpose(nMatrix,nMatrix);
  mat3.invert(nMatrix,nMatrix);
  gl.uniformMatrix3fv(shaderProgram.nMatrixUniform, false, nMatrix);
}

//-------------------------------------------------------------------------
/**
 * Sends Modelview matrix to skybox shader
 */
function uploadModelViewMatrixToShaderSB() {
  gl.uniformMatrix4fv(shaderProgramSB.mvMatrixUniform, false, mvMatrix);
}

//-------------------------------------------------------------------------
/**
 * Sends projection matrix to skybox shader
 */
function uploadProjectionMatrixToShaderSB() {
  gl.uniformMatrix4fv(shaderProgramSB.pMatrixUniform, 
                      false, pMatrix);
}

//-------------------------------------------------------------------------
/**
 * Sends Modelview matrix to reflect shader
 */
function uploadModelViewMatrixToShaderReflect() {
  gl.uniformMatrix4fv(shaderProgramReflect.mvMatrixUniform, false, mvMatrix);
}

//-------------------------------------------------------------------------
/**
 * Sends projection matrix to reflect shader
 */
function uploadProjectionMatrixToShaderReflect() {
  gl.uniformMatrix4fv(shaderProgramReflect.pMatrixUniform, 
                      false, pMatrix);
}

/**
 * Sends reflection matrix to shader
 */
function uploadReflectionMatrixToShader() {
    gl.uniformMatrix4fv(shaderProgramReflect.rMatrixUniform, false, rMatrix);
}

//----------------------------------------------------------------------------------
/**
 * Pushes matrix onto modelview matrix stack
 */
function mvPushMatrix() {
    var copy = mat4.clone(mvMatrix);
    mvMatrixStack.push(copy);
}


//----------------------------------------------------------------------------------
/**
 * Pops matrix off of modelview matrix stack
 */
function mvPopMatrix() {
    if (mvMatrixStack.length == 0) {
      throw "Invalid popMatrix!";
    }
    mvMatrix = mvMatrixStack.pop();
}

//----------------------------------------------------------------------------------
/**
 * Sends projection/modelview matrices to shader
 */
function setMatrixUniforms() {
    uploadModelViewMatrixToShader();
    uploadNormalMatrixToShader();
    uploadProjectionMatrixToShader();
}

//----------------------------------------------------------------------------------
/**
 * Sends projection/modelview matrices to shader
 */
function setMatrixUniformsSB() {
    uploadModelViewMatrixToShaderSB();
    uploadProjectionMatrixToShaderSB();
}

/**
 * Sends projection/modelview matrices ot shader
 */
function setMatrixUniformsReflect() {
    uploadModelViewMatrixToShaderReflect();
    uploadProjectionMatrixToShaderReflect();
    uploadReflectionMatrixToShader();
}

//----------------------------------------------------------------------------------
/**
 * Translates degrees to radians
 * @param {Number} degrees Degree input to function
 * @return {Number} The radians that correspond to the degree input
 */
function degToRad(degrees) {
        return degrees * Math.PI / 180;
}

//----------------------------------------------------------------------------------
/**
 * Creates a context for WebGL
 * @param {element} canvas WebGL canvas
 * @return {Object} WebGL context
 */
function createGLContext(canvas) {
  var names = ["webgl", "experimental-webgl"];
  var context = null;
  for (var i=0; i < names.length; i++) {
    try {
      context = canvas.getContext(names[i]);
    } catch(e) {}
    if (context) {
      break;
    }
  }
  if (context) {
    context.viewportWidth = canvas.width;
    context.viewportHeight = canvas.height;
  } else {
    alert("Failed to create WebGL context!");
  }
  return context;
}

//----------------------------------------------------------------------------------
/**
 * Loads Shaders
 * @param {string} id ID string for shader to load. Either vertex shader/fragment shader
 */
function loadShaderFromDOM(id) {
  var shaderScript = document.getElementById(id);
  
  // If we don't find an element with the specified id
  // we do an early exit 
  if (!shaderScript) {
    return null;
  }
  
  // Loop through the children for the found DOM element and
  // build up the shader source code as a string
  var shaderSource = "";
  var currentChild = shaderScript.firstChild;
  while (currentChild) {
    if (currentChild.nodeType == 3) { // 3 corresponds to TEXT_NODE
      shaderSource += currentChild.textContent;
    }
    currentChild = currentChild.nextSibling;
  }
 
  var shader;
  if (shaderScript.type == "x-shader/x-fragment") {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderScript.type == "x-shader/x-vertex") {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    return null;
  }
 
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
 
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert(gl.getShaderInfoLog(shader));
    return null;
  } 
  return shader;
}

//----------------------------------------------------------------------------------
/**
 * Setup the fragment and vertex shaders
 */
function setupShaders() {
  vertexShader = loadShaderFromDOM("shader-vs");
  fragmentShader = loadShaderFromDOM("shader-fs");
  
  shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert("Failed to setup shaders");
  }

  shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
  gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);

  shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
  gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);

  shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
  shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
  shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
  shaderProgram.uniformLightPositionLoc = gl.getUniformLocation(shaderProgram, "uLightPosition");    
  shaderProgram.uniformAmbientLightColorLoc = gl.getUniformLocation(shaderProgram, "uAmbientLightColor");  
  shaderProgram.uniformDiffuseLightColorLoc = gl.getUniformLocation(shaderProgram, "uDiffuseLightColor");
  shaderProgram.uniformSpecularLightColorLoc = gl.getUniformLocation(shaderProgram, "uSpecularLightColor");
  shaderProgram.uniformShininessLoc = gl.getUniformLocation(shaderProgram, "uShininess");    
  shaderProgram.uniformAmbientMaterialColorLoc = gl.getUniformLocation(shaderProgram, "uKAmbient");  
  shaderProgram.uniformDiffuseMaterialColorLoc = gl.getUniformLocation(shaderProgram, "uKDiffuse");
  shaderProgram.uniformSpecularMaterialColorLoc = gl.getUniformLocation(shaderProgram, "uKSpecular");
}

/**
 * Set up the fragment and vertex shaders for the skybox shader.
 */
function setupSBShaders() {
  vertexShader = loadShaderFromDOM("shader-vs_SB");
  fragmentShader = loadShaderFromDOM("shader-fs_SB");
  
  shaderProgramSB = gl.createProgram();
  gl.attachShader(shaderProgramSB, vertexShader);
  gl.attachShader(shaderProgramSB, fragmentShader);
  gl.linkProgram(shaderProgramSB);

  if (!gl.getProgramParameter(shaderProgramSB, gl.LINK_STATUS)) {
    alert("Failed to setup shaders");
  }
  
  shaderProgramSB.texCoordAttribute = gl.getAttribLocation(shaderProgramSB, "aTexCoord");
  console.log("Tex coord attrib: ", shaderProgramSB.texCoordAttribute);
  gl.enableVertexAttribArray(shaderProgramSB.texCoordAttribute);
    
  shaderProgramSB.vertexPositionAttribute = gl.getAttribLocation(shaderProgramSB, "aVertexPosition");
  console.log("Vertex attrib: ", shaderProgramSB.vertexPositionAttribute);
  gl.enableVertexAttribArray(shaderProgramSB.vertexPositionAttribute);
    
  shaderProgramSB.mvMatrixUniform = gl.getUniformLocation(shaderProgramSB, "uMVMatrix");
  shaderProgramSB.pMatrixUniform = gl.getUniformLocation(shaderProgramSB, "uPMatrix");
}

/**
 * Set up the fragment and vertex shaders for the teapot reflection shader.
 */
function setupReflectShaders() {
  vertexShader = loadShaderFromDOM("shader-vs_reflect");
  fragmentShader = loadShaderFromDOM("shader-fs_reflect");
  
  shaderProgramReflect = gl.createProgram();
  gl.attachShader(shaderProgramReflect, vertexShader);
  gl.attachShader(shaderProgramReflect, fragmentShader);
  gl.linkProgram(shaderProgramReflect);

  if (!gl.getProgramParameter(shaderProgramReflect, gl.LINK_STATUS)) {
    alert("Failed to setup shaders");
  }
  
  shaderProgramReflect.vertexPositionAttribute = gl.getAttribLocation(shaderProgramReflect, "aVertexPosition");
  console.log("Vertex attrib: ", shaderProgramReflect.vertexPositionAttribute);
  gl.enableVertexAttribArray(shaderProgramReflect.vertexPositionAttribute);
    
  shaderProgramReflect.mvMatrixUniform = gl.getUniformLocation(shaderProgramReflect, "uMVMatrix");
  shaderProgramReflect.pMatrixUniform = gl.getUniformLocation(shaderProgramReflect, "uPMatrix");
  shaderProgramReflect.rMatrixUniform = gl.getUniformLocation(shaderProgramReflect, "uRMatrix");
}

//-------------------------------------------------------------------------
/**
 * Sends material information to the shader
 * @param {Float32} alpha shininess coefficient
 * @param {Float32Array} a Ambient material color
 * @param {Float32Array} d Diffuse material color
 * @param {Float32Array} s Specular material color
 */
function setMaterialUniforms(alpha,a,d,s) {
  gl.uniform1f(shaderProgram.uniformShininessLoc, alpha);
  gl.uniform3fv(shaderProgram.uniformAmbientMaterialColorLoc, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseMaterialColorLoc, d);
  gl.uniform3fv(shaderProgram.uniformSpecularMaterialColorLoc, s);
}

//-------------------------------------------------------------------------
/**
 * Sends light information to the shader
 * @param {Float32Array} loc Location of light source
 * @param {Float32Array} a Ambient light strength
 * @param {Float32Array} d Diffuse light strength
 * @param {Float32Array} s Specular light strength
 */
function setLightUniforms(loc,a,d,s) {
  gl.uniform3fv(shaderProgram.uniformLightPositionLoc, loc);
  gl.uniform3fv(shaderProgram.uniformAmbientLightColorLoc, a);
  gl.uniform3fv(shaderProgram.uniformDiffuseLightColorLoc, d);
  gl.uniform3fv(shaderProgram.uniformSpecularLightColorLoc, s);
}

//----------------------------------------------------------------------------------
/**
 * Populate mesh buffers with data
 */
function setupMesh(filename) {
   //Your code here
    myMesh = new TriMesh();
    myPromise = asyncGetFile(filename);
    myPromise.then((retrievedText) => {
        myMesh.loadFromOBJ(retrievedText);
        console.log("Yay! got the file");
    })
    .catch(
        (reason) => {
            console.log("Handle rejected promise (" + reason + ") here.");
        });
}

/**
 * Creates texture for application to cube.
 */
function setupTextures() { 
   cubeTexture = gl.createTexture();
   gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeTexture);

   const faceInfos = [
    {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_X,
      url: 'box/pos-x.png'
    },
    {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
      url: 'box/neg-x.png'
    },
    {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
      url: 'box/pos-y.png'
    },
    {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
      url: 'box/neg-y.png'
    },
    {
      target: gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
      url: 'box/pos-z.png'
    },
    {
      target: gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
      url: 'box/neg-z.png'
    },
  ];
  faceInfos.forEach((faceInfo) => {
    const {target, url} = faceInfo;

    // Upload the canvas to the cubemap face.
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 512;
    const height = 512;
    const format = gl.RGBA;
    const type = gl.UNSIGNED_BYTE;

    // setup each face so it's immediately renderable
    gl.texImage2D(target, level, internalFormat, width, height, 0, format, type, null);

    // Asynchronously load an image
    const image = new Image();
    image.src = url;
    image.addEventListener('load', function() {
      // Now that the image has loaded make copy it to the texture.
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, cubeTexture);
      gl.texImage2D(target, level, internalFormat, format, type, image);
      gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    });
  });
  gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
}

/**
 * Sets up buffers for cube.
 */
/**
 * Populate buffers with data
 */
function setupBuffers() {

  // Create a buffer for the cube's vertices.

  cubeVertexBuffer = gl.createBuffer();

  // Select the cubeVerticesBuffer as the one to apply vertex
  // operations to from here out.

  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer);

  // Now create an array of vertices for the cube.

  var vertices = [
    // Front face
    -20.0, -20.0,  20.0,
     20.0, -20.0,  20.0,
     20.0,  20.0,  20.0,
    -20.0,  20.0,  20.0,

    // Back face
    -20.0, -20.0, -20.0,
    -20.0,  20.0, -20.0,
     20.0,  20.0, -20.0,
     20.0, -20.0, -20.0,

    // Top face
    -20.0,  20.0, -20.0,
    -20.0,  20.0,  20.0,
     20.0,  20.0,  20.0,
     20.0,  20.0, -20.0,

    // Bottom face
    -20.0, -20.0, -20.0,
     20.0, -20.0, -20.0,
     20.0, -20.0,  20.0,
    -20.0, -20.0,  20.0,

    // Right face
     20.0, -20.0, -20.0,
     20.0,  20.0, -20.0,
     20.0,  20.0,  20.0,
     20.0, -20.0,  20.0,

    // Left face
    -20.0, -20.0, -20.0,
    -20.0, -20.0,  20.0,
    -20.0,  20.0,  20.0,
    -20.0,  20.0, -20.0
  ];

  // Now pass the list of vertices into WebGL to build the shape. We
  // do this by creating a Float32Array from the JavaScript array,
  // then use it to fill the current vertex buffer.

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

  // Map the texture onto the cube's faces.

  cubeTCoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeTCoordBuffer);

  var textureCoordinates = [
    // Front
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0,
    // Back
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0,
    // Top
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0,
    // Bottom
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0,
    // Right
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0,
    // Left
    0.0,  0.0,
    1.0,  0.0,
    1.0,  1.0,
    0.0,  1.0
  ];

  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates),
                gl.STATIC_DRAW);

  // Build the element array buffer; this specifies the indices
  // into the vertex array for each face's vertices.

  cubeTriIndexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeTriIndexBuffer);

  // This array defines each face as two triangles, using the
  // indices into the vertex array to specify each triangle's
  // position.

  var cubeVertexIndices = [
    0,  1,  2,      0,  2,  3,    // front
    4,  5,  6,      4,  6,  7,    // back
    8,  9,  10,     8,  10, 11,   // top
    12, 13, 14,     12, 14, 15,   // bottom
    16, 17, 18,     16, 18, 19,   // right
    20, 21, 22,     20, 22, 23    // left
  ]

  // Now send the element array to GL

  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(cubeVertexIndices), gl.STATIC_DRAW);
}

/**
 * Draw a cube based on buffers.
 */
function drawCube(){

  gl.useProgram(shaderProgramSB);
    
  // Draw the cube by binding the array buffer to the cube's vertices
  // array, setting attributes, and pushing it to GL.

  gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexBuffer);
  gl.vertexAttribPointer(shaderProgramSB.vertexPositionAttribute, 3, gl.FLOAT, false, 0, 0);

  // Set the texture coordinates attribute for the vertices.

  gl.bindBuffer(gl.ARRAY_BUFFER, cubeTCoordBuffer);
  gl.vertexAttribPointer(shaderProgramSB.texCoordAttribute, 2, gl.FLOAT, false, 0, 0);

  // Specify the texture to map onto the faces.
    
  gl.uniform1i(gl.getUniformLocation(shaderProgramSB, "uSampler"), 0);

  // Draw the cube.

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeTriIndexBuffer);
  setMatrixUniformsSB();
  gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
}

//----------------------------------------------------------------------------------
/**
 * Draw call that applies matrix transformations to model and draws model in frame
 */
function draw() { 
    //console.log("function draw()")
  
    gl.viewport(0, 0, gl.viewportWidth, gl.viewportHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // We'll use perspective 
    mat4.perspective(pMatrix,degToRad(45), 
                     gl.viewportWidth / gl.viewportHeight,
                     0.1, 500.0);

    // We want to look down -z, so create a lookat point in that direction    
    vec3.add(viewPt, eyePt, viewDir);
    
    // Then generate the lookat matrix and initialize the view matrix to that view
    mat4.lookAt(vMatrix,eyePt,viewPt,up);
    
    //Draw Mesh
    //ADD an if statement to prevent early drawing of myMesh
    if (myMesh.loaded()) {       
        mvPushMatrix();
        mat4.rotateY(mvMatrix, mvMatrix, degToRad(orbitEulerY));
        mat4.multiply(mvMatrix,vMatrix,mvMatrix);
        
        // Copy the model view matrix.
        var mvMatrixCP = mat4.create();
        mat4.copy(mvMatrixCP, mvMatrix);
        
        // Rotate the teapot
        mat4.rotateY(mvMatrix, mvMatrix, degToRad(teapotEulerY));
        mat4.rotateX(mvMatrix, mvMatrix, degToRad(teapotEulerX));
        
        if ((document.getElementById("shaded").checked))
        {
            gl.useProgram(shaderProgram);
            
            myMesh.drawTriangles();
            setMatrixUniforms();
            setLightUniforms(lightPosition,lAmbient,lDiffuse,lSpecular);
            setMaterialUniforms(shininess,kAmbient,kTerrainDiffuse,kSpecular); 
        }
        else if(document.getElementById("reflective").checked)
        {
            gl.useProgram(shaderProgramReflect);
        
            gl.uniform1i(gl.getUniformLocation(shaderProgramReflect, "uSampler"), 0);
            myMesh.drawTrianglesReflect(shaderProgramReflect);
            setMatrixUniformsReflect();
        }
        
        // Copy back old model view matrix.
        mat4.copy(mvMatrix, mvMatrixCP);
        
        // Draw the skybox
        drawCube();
        
        mvPopMatrix();
    }
  
}

//----------------------------------------------------------------------------------
//Code to handle user interaction
var currentlyPressedKeys = {};

function handleKeyDown(event) {
        //console.log("Key down ", event.key, " code ", event.code);
        currentlyPressedKeys[event.key] = true;
        if (currentlyPressedKeys["a"]) {
            // key A
            orbitEulerY-= 1;
            vec3.rotateY(lightPosition, lightPosition, [0, 0, 0], degToRad(-1));
        } else if (currentlyPressedKeys["d"]) {
            // key D
            orbitEulerY+= 1;
            vec3.rotateY(lightPosition, lightPosition, [0, 0, 0], degToRad(1));
        } 
    
        if (currentlyPressedKeys["j"]) {
            // For rotating the teapot
            teapotEulerY -= 1;
            mat4.rotateY(rMatrix, rMatrix, degToRad(-1));
        } else if (currentlyPressedKeys["l"]) {
            // For rotating the teapot
            teapotEulerY += 1;
            mat4.rotateY(rMatrix, rMatrix, degToRad(1));
        } 
}

function handleKeyUp(event) {
        //console.log("Key up ", event.key, " code ", event.code);
        currentlyPressedKeys[event.key] = false;
}

//----------------------------------------------------------------------------------
/**
 * Startup function called from html code to start program.
 */
 function startup() {
  canvas = document.getElementById("myGLCanvas");
  gl = createGLContext(canvas);
  // creating shaders
  setupShaders();
  setupReflectShaders();
  setupSBShaders();
     
  // Setting up teapot mesh
  setupMesh("teapot_0.obj");
     
  // Setting up skybox buffers and textures
  setupBuffers();
  setupTextures();
     
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);
  document.onkeydown = handleKeyDown;
  document.onkeyup = handleKeyUp;
  tick();
}

//----------------------------------------------------------------------------------
/**
 * Keeping drawing frames....
 */
function tick() {
    requestAnimFrame(tick);
    draw();
}

