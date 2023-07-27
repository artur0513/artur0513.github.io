var c = document.getElementById('graphics');
var gl = c.getContext('webgl2');

const ext = gl.getExtension("WEBGL_compressed_texture_s3tc") || gl.getExtension("MOZ_WEBGL_compressed_texture_s3tc") || gl.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");
	
function createShader(str, type) {
	var shader = gl.createShader(type);
	gl.shaderSource(shader, str);
	gl.compileShader(shader);
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

async function loadDDSImage(url){
	let response = await fetch(url);
	
	if (!response.ok) {
		alert("HTTP Error: " + response.status);
	} else {
		console.log('Fetching URL succsesfull: ' + url);
	}

	let rawImgData = await response.arrayBuffer(); // прочитать тело ответа как arrayBuffer
	console.log('Reading response as array buffer');

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
	
	const texture = gl.createTexture();

	gl.bindTexture(gl.TEXTURE_2D, texture);
	
	let firstMipMapSize = Math.floor((width + 3) / 4) * Math.floor((height + 3) / 4) * 8;
	let textureData = new Uint8Array(rawImgData, 128, firstMipMapSize); //mb 129 or 127?
	
	gl.compressedTexImage2D(
	  gl.TEXTURE_2D,
	  0,
	  ext.COMPRESSED_RGBA_S3TC_DXT1_EXT,
	  width,
	  height,
	  0,
	  textureData,
	);

	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	
	return texture;
}

async function configureWebGL(){
	let texture = await loadDDSImage('https://raw.githubusercontent.com/artur0513/artur0513.github.io/main/images/soc.dds');
	
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
	uniform sampler2D inTexture;
	void main() { 
	vec2 texCoord = (onScreenPos + vec2(1.0))/2.0; 
	texCoord.y = 1.0 - texCoord.y; 
	gl_FragColor = texture2D(inTexture, texCoord); 
	}`;
	
	var program = createProgram(vertexShaderCode, fragmentShaderCode);
	gl.useProgram(program);
	
	program.vertexPosAttrib = gl.getAttribLocation(program, 'pos');
	gl.enableVertexAttribArray(program.vertexPosAttrib);
	gl.vertexAttribPointer(program.vertexPosAttrib, 2, gl.FLOAT, false, 0, 0);
	
	var textureLocation = gl.getUniformLocation(program, "in_Texture");
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.uniform1i(textureLocation, 0);
}

async function drawScene() { 
	await configureWebGL();
	gl.drawArrays(gl.TRIANGLES, 0, 6);
}

gl.clearColor(0,0,0.8,1);
gl.clear(gl.COLOR_BUFFER_BIT);

drawScene();