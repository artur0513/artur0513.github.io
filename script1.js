var c = document.getElementById('graphics');
var gl = c.getContext('webgl2');
c.addEventListener("mousemove", function(mouseEvent){
	if (mousePressed){
	sphereCoords[1] -= mouseEvent.movementX/600.0;
	sphereCoords[0] -= mouseEvent.movementY/600.0; }});
c.addEventListener("mousedown", function(mouseEvent) {
	mousePressed = true;
});
c.addEventListener("mouseup", function(mouseEvent) {
	mousePressed = false;
});
c.addEventListener("mouseout", function(mouseEvent) { 
	mousePressed = false;
});
c.addEventListener("wheel", function(wheelEvent) {
	if (mousePressed){
		fov[0] *= 1.0 + Math.sign(wheelEvent.deltaY)/25.0;
		fov[1] *= 1.0 + Math.sign(wheelEvent.deltaY)/25.0;
		wheelEvent.preventDefault();
	}
});


const ext = gl.getExtension("WEBGL_compressed_texture_s3tc") || gl.getExtension("MOZ_WEBGL_compressed_texture_s3tc") || gl.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");
	
function createShader(str, type) {
	var shader = gl.createShader(type);
	gl.shaderSource(shader, str);
	gl.compileShader(shader);
	
	const message = gl.getShaderInfoLog(shader);

	if (message.length > 0) {
		console.log(message);
	}
	
	return shader;
}	

function createProgram(vstr, fstr) {
	var program = gl.createProgram();
	var vshader = createShader(vstr, gl.VERTEX_SHADER);
	var fshader = createShader(fstr, gl.FRAGMENT_SHADER);
	gl.attachShader(program, vshader);
	gl.attachShader(program, fshader);
	gl.linkProgram(program);
	return program;
}

async function loadDDSImage(textureType, url){
	let response = await fetch(url);
	
	if (!response.ok) {
		alert("HTTP Error: " + response.status + ' ' + url);
	}

	let rawImgData = await response.arrayBuffer(); // прочитать тело ответа как arrayBuffer

	let header = new Int32Array(rawImgData, 0, 128); // header size 128 bytes?
	if (header[0] != 0x20534444){
		alert('Loaded file is not .dds, header is: ' + header[0].toString());
	}

	let height = header[3];
	let width = header[4];
	let imgSize = header[5]; // size with all mipmaps, we will use only first one
	let mipMapCount = header[7];
	let dwFourCC = header[21];
	
	// DXT1 = 827611204   DXT3 = 861165636    DXT5 = 894720068
	if(dwFourCC != 827611204){
		alert('Compression type is not dxt1: ' + dwFourCC.toString());
	}
	console.log('Image header read succsesfull');
	
	let firstMipMapSize = Math.floor((width + 3) / 4) * Math.floor((height + 3) / 4) * 8;
	let textureData = new Uint8Array(rawImgData, 128, firstMipMapSize); //mb 129 or 127?
	
	gl.compressedTexImage2D(
	  textureType,
	  0,
	  ext.COMPRESSED_RGBA_S3TC_DXT1_EXT,
	  width,
	  height,
	  0,
	  textureData,
	);
}

async function configureWebGL(){
	const texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
	await loadDDSImage(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 'https://raw.githubusercontent.com/artur0513/artur0513.github.io/main/images/cubemap2/1.dds');
	await loadDDSImage(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 'https://raw.githubusercontent.com/artur0513/artur0513.github.io/main/images/cubemap2/2.dds');
	await loadDDSImage(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 'https://raw.githubusercontent.com/artur0513/artur0513.github.io/main/images/cubemap2/3.dds');
	await loadDDSImage(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 'https://raw.githubusercontent.com/artur0513/artur0513.github.io/main/images/cubemap2/4.dds');
	await loadDDSImage(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 'https://raw.githubusercontent.com/artur0513/artur0513.github.io/main/images/cubemap2/5.dds');
	await loadDDSImage(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 'https://raw.githubusercontent.com/artur0513/artur0513.github.io/main/images/cubemap2/6.dds');
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	
	var vertexPosBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vertexPosBuffer);
	var vertices = [-1.0, 1.0, -1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0, 1.0, -1.0];
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
	
	var vertexShaderCode = `
	attribute vec2 pos;
	varying vec2 onScreenPos;
	void main() {
		onScreenPos = pos; 
		gl_Position = vec4(pos, 0.0, 1.0);
	}`;
	var fragmentShaderCode = `
	precision mediump float; 
	varying vec2 onScreenPos; 
	uniform samplerCube inTexture;
	
	uniform vec2 sphere_coords;
	uniform vec2 fov;
	void main() { 
		mat3 rot_y;
		rot_y[0] = vec3(cos(sphere_coords.y), 0, -sin(sphere_coords.y));
		rot_y[1] = vec3(0, 1, 0);
		rot_y[2] = vec3(sin(sphere_coords.y), 0, cos(sphere_coords.y));
		
		mat3 rot_x;
		rot_x[0] = vec3(1, 0, 0);
		rot_x[1] = vec3(0, cos(sphere_coords.x), sin(sphere_coords.x));
		rot_x[2] = vec3(0, -sin(sphere_coords.x), cos(sphere_coords.x));
		
		
		vec3 cubemapCoord = vec3(onScreenPos.x * tan(fov.x * 0.5),  onScreenPos.y * tan(fov.y * 0.5), 1.0);
		cubemapCoord = (rot_y * rot_x) * normalize(cubemapCoord);
		
		gl_FragColor = textureCube(inTexture, cubemapCoord); 
	}`;
	
	var program = createProgram(vertexShaderCode, fragmentShaderCode);
	gl.useProgram(program);
	
	program.vertexPosAttrib = gl.getAttribLocation(program, 'pos');
	gl.enableVertexAttribArray(program.vertexPosAttrib);
	gl.vertexAttribPointer(program.vertexPosAttrib, 2, gl.FLOAT, false, 0, 0);
	
	var textureLocation = gl.getUniformLocation(program, "in_Texture");
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
	gl.uniform1i(textureLocation, 0);
	
	var fovLocation = gl.getUniformLocation(program, 'fov');
	var sphereCoordLocation = gl.getUniformLocation(program, 'sphere_coords');
	return [fovLocation, sphereCoordLocation];
}

let startFovY = 1.0;
var locations, sphereCoords = [0.0, 0.0], fov = [Math.atan(Math.tan(startFovY * 0.5) * c.width/c.height)*2.0, startFovY], mousePressed = false;
//document.body.style.cursor = 'none';

configureWebGL().then(function (result) { // ждем пока все загрузится, а ПОТОМ начинаем рисовать этот кал
locations = result; requestAnimationFrame(drawScene);
});

async function drawScene() { 
	let fovLocation = locations[0];
	let sphereCoordLocation = locations[1];
	gl.uniform2f(fovLocation, fov[0], fov[1]);
	gl.uniform2f(sphereCoordLocation, sphereCoords[0], sphereCoords[1]);
	gl.drawArrays(gl.TRIANGLES, 0, 6);
	
	requestAnimationFrame(drawScene);
}