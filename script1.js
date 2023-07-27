var c = document.getElementById('graphics');

const canvas = document.querySelector('#graphics');
const upscaleKoeff = 1.50;

function onResize(canvas) {
  const correctWidth  = Math.floor(canvas.clientWidth * window.devicePixelRatio * upscaleKoeff);
  const correctHeight = Math.floor(canvas.clientHeight * window.devicePixelRatio * upscaleKoeff);
 
  const needResize = canvas.width  !== correctWidth ||
                     canvas.height !== correctHeight;
 
  if (needResize) {
    // Make the canvas the same size
    canvas.width  = correctWidth;
    canvas.height = correctHeight;
	console.log('Panorama rendering resolution: ' + canvas.width.toString() + 'x' + canvas.height.toString());
  }
 
  return needResize;
}

var gl = c.getContext('webgl2');

c.addEventListener("mousemove", function(mouseEvent){
	if (mousePressed){
	sphereCoords[1] -= mouseEvent.movementX/500.0;
	sphereCoords[0] -= mouseEvent.movementY/500.0; }});
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
		fov[1] *= 1.0 + Math.sign(wheelEvent.deltaY)/25.0;
		fov[0] = Math.atan(Math.tan(fov[1] * 0.5) * c.width/c.height)*2.0;
		wheelEvent.preventDefault();
	}
});
document.addEventListener("keydown", function(keyEvent){
	if (keyEvent.code == "KeyF"){
		if (!document.fullscreenElement) {
			document.documentElement.requestFullscreen();
		} else {
			document.exitFullscreen();
		}
	}
});

const ext =
  gl.getExtension("WEBGL_compressed_texture_s3tc") ||
  gl.getExtension("MOZ_WEBGL_compressed_texture_s3tc") ||
  gl.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");
if (!ext) {
	alert("Webgl extension is not supported");
}

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

	let header = new Int32Array(rawImgData, 0, 32); // header size 128 bytes?
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

// ЕСЛИ НЕТ ПОДДЕРЖКИ DXT, ТО РАСКОДИРУЕМ ВСЕ САМИ

async function loadDDSImageWithoutExtensions(textureType, url){
	// Копия кода чтобы считать хедер, лень выносить в отдельную функцию
	let response = await fetch(url);
	
	if (!response.ok) {
		alert("HTTP Error: " + response.status + ' ' + url);
	}

	let rawImgData = await response.arrayBuffer(); // прочитать тело ответа как arrayBuffer

	let header = new Int32Array(rawImgData, 0, 32); // header size 128 bytes?
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
	const blockSize = 8; // 8 bytes for 4x4 pixels
	let encodedImage = new Uint16Array(rawImgData, 128, firstMipMapSize/2); //mb 129 or 127?
	
	// =======================================
	
	function convert565ByteToRgb (byte) {
		return [
			Math.round(((byte >>> 11) & 31) * (255 / 31)),
			Math.round(((byte >>> 5) & 63) * (255 / 63)),
			Math.round((byte & 31) * (255 / 31))
		];
	};
	
	let decodedImage = new Uint8Array(width*height*4);
	
	var colors = new Uint8Array(16);
	for (var h = 0; h < Math.floor(height/4); h++){
		for (var w = 0; w < Math.floor(width/4); w++){
			var color1_16 = encodedImage[(w + h*width)*4];
			var color2_16 = encodedImage[(w + h*width)*4 + 1];
			
			let c1 = convert565ByteToRgb(color1_16);
			colors[0] = c1[0];
			colors[1] = c1[1];
			colors[2] = c1[2];
			colors[3] = 255;
			
			let c2 = convert565ByteToRgb(color2_16);
			colors[4] = c2[0];
			colors[5] = c2[1];
			colors[6] = c2[2];
			colors[7] = 255;
			
			if (color1_16 > color2_16) { // no alpha channel
				colors[8] = colors[0]*0.333 + colors[4]*0.666;
				colors[9] = colors[1]*0.333 + colors[5]*0.666;
				colors[10] = colors[2]*0.333 + colors[6]*0.666;
				colors[11] = 255;
				
				colors[12] = colors[0]*0.666 + colors[4]*0.333;
				colors[13] = colors[1]*0.666 + colors[5]*0.333;
				colors[14] = colors[2]*0.666 + colors[6]*0.333;
				colors[15] = 255;
			}
			else { // with alpha channel
				colors[8] = colors[0]*0.5 + colors[4]*0.5;
				colors[9] = colors[1]*0.5 + colors[5]*0.5;
				colors[10] = colors[2]*0.5 + colors[6]*0.5;
				colors[11] = 255;
				
				colors[12] = 0;
				colors[13] = 0;
				colors[14] = 0;
				colors[15] = 0;
			}
			
			for (var i = 0; i < 4; i++){
				console.log(colors[4*i] + ' ' + colors[4*i + 1] + ' ' +colors[4*i+2] + ' ' +colors[4*i+3] + ' ');
			}
			
			for (var x = 0; x < 4; x++){
				for (var y = 0; y < 4; y++){
					let id = 0, shift = 0;
					if (y < 2) {
						id = encodedImage[(w + h*width)*4 + 2];
						shift = y;
					} else {
						id = encodedImage[(w + h*width)*4 + 3];
						shift = y - 2;
					}
					id = 4*((id >>> x*2 + shift*8)&0x03);
					
					let pos = 4*((y + h*4)*width + x + w*4);
					
					console.log('pixel x: ' + (x + w*4) + ' y: ' + (y + h*4) + ' id: ' + id + ' Color: ' + colors[id] + ' ' 
					+ colors[id+1] + ' '+ colors[id+2] + ' '+ colors[id+3] + ' ');
					
					decodedImage[pos] = colors[id];
					decodedImage[pos+1] = colors[id+1];
					decodedImage[pos+2] = colors[id+2];
					decodedImage[pos+3] = colors[id+3];
				}
			}
			
		}
	}
	gl.texImage2D(textureType, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, decodedImage);
	
}

async function configureWebGL(){
	const texture = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
	await loadDDSImageWithoutExtensions(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 'https://raw.githubusercontent.com/artur0513/artur0513.github.io/main/images/decode_study.dds');
	await loadDDSImageWithoutExtensions(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 'https://raw.githubusercontent.com/artur0513/artur0513.github.io/main/images/decode_study.dds');
	await loadDDSImageWithoutExtensions(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 'https://raw.githubusercontent.com/artur0513/artur0513.github.io/main/images/decode_study.dds');
	await loadDDSImageWithoutExtensions(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 'https://raw.githubusercontent.com/artur0513/artur0513.github.io/main/images/decode_study.dds');
	await loadDDSImageWithoutExtensions(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 'https://raw.githubusercontent.com/artur0513/artur0513.github.io/main/images/decode_study.dds');
	await loadDDSImageWithoutExtensions(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 'https://raw.githubusercontent.com/artur0513/artur0513.github.io/main/images/decode_study.dds');
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	
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

//c.width = window.innerWidth;
//c.height = window.innerHeight;
let startFovY = 1.5707;
var locations, sphereCoords = [0.0, 0.0], fov = [Math.atan(Math.tan(startFovY * 0.5) * c.width/c.height)*2.0, startFovY], mousePressed = false;
//document.body.style.cursor = 'none';

configureWebGL().then(function (result) { // ждем пока все загрузится, а ПОТОМ начинаем рисовать этот кал
locations = result; requestAnimationFrame(drawScene);
});

async function drawScene() { 
	if (onResize(gl.canvas)){
		gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
	}

	let fovLocation = locations[0];
	let sphereCoordLocation = locations[1];
	gl.uniform2f(fovLocation, fov[0], fov[1]);
	gl.uniform2f(sphereCoordLocation, sphereCoords[0], sphereCoords[1]);
	gl.drawArrays(gl.TRIANGLES, 0, 6);
	
	requestAnimationFrame(drawScene);
}