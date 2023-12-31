// Я не умею писать на джаваскрипте, тут самый отвратительный код что я видел (и писал), соре

var c = document.getElementById('graphics');
//c.style.display="none";
var gl = c.getContext('webgl2');
var upscaleKoeff = 1.5;
const xshift = document.getElementById("xshift");
var image_loaded = false;
const dropbox = document.getElementById('drop_zone');

const ext =
  gl.getExtension("WEBGL_compressed_texture_s3tc") ||
  gl.getExtension("MOZ_WEBGL_compressed_texture_s3tc") ||
  gl.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");
  
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

async function loadTGAImage(textureType, file){

	let rawImgData = await file.arrayBuffer(); // прочитать тело файла как arrayBuffer

	let header = new Uint8Array(rawImgData, 0, 18); // header size 18 bytes?

	let height = header[15] * 256 + header[14];
	let width = header[13] * 256 + header[12];;
	let bitsPerPixel = header[16];
	let bytesPerPixel = bitsPerPixel/8;

	let imgSize = width * height * bytesPerPixel;

    if (bitsPerPixel != 24 && bitsPerPixel != 32) {
        console.log('Unknown bits per pixel value.');
    }

	let textureData = new Uint8Array(rawImgData, 18, rawImgData.byteLength - 18);
	let pixels = new Uint8Array(imgSize);
	
	if (header[2] == 2) { //uncomressed image
        for (i = 0; i < width * height; i++) {
            id = i * bytesPerPixel;
			pixels[id] = textureData[id+2];
			pixels[id + 1] = textureData[id+1];
			pixels[id + 2] = textureData[id];
			if (bytesPerPixel == 4)
				pixels[id + 3] = textureData[id+3];
        }
    }

	let colortype = gl.RGBA;
	if (bytesPerPixel === 3)
		colortype = gl.RGB;
	gl.texImage2D(textureType, 0, colortype, width, height, 0, colortype, gl.UNSIGNED_BYTE, textureData);//replace textureDAta with pixels
	
	console.log('Image loaded');
}

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
#define PI 3.1415926538
precision highp float; 
varying vec2 onScreenPos; 
uniform samplerCube inTexture;
uniform float phi_shift;
uniform bool swap_r_b;

void main() { 
	float phi = (onScreenPos.x + 1.0) * PI + phi_shift;
	float theta = (onScreenPos.y + 1.0)/2.0 * PI;
	vec3 cubemapCoord = vec3(-sin(theta)*cos(phi), -cos(theta), sin(theta)*sin(phi));
	
	vec4 col = textureCube(inTexture, cubemapCoord); 
	if (!swap_r_b)
		gl_FragColor = col; 
	else
		gl_FragColor = vec4(col.b, col.g, col.r, col.a);
}`;

var program = createProgram(vertexShaderCode, fragmentShaderCode);
gl.useProgram(program);

var targetTextureHeight, targetTextureWidth, texture, fb, targetTexture;
	
texture = gl.createTexture();
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

program.vertexPosAttrib = gl.getAttribLocation(program, 'pos');
gl.enableVertexAttribArray(program.vertexPosAttrib);
gl.vertexAttribPointer(program.vertexPosAttrib, 2, gl.FLOAT, false, 0, 0);

var textureLocation = gl.getUniformLocation(program, "inTexture");
gl.uniform1i(textureLocation, 0);

var x_shift_pos = gl.getUniformLocation(program, 'phi_shift');
var swap_r_b = gl.getUniformLocation(program, 'swap_r_b');
gl.uniform1i(swap_r_b, 1);

function configureWebgl() {
	c.width  = c.clientWidth * window.devicePixelRatio * upscaleKoeff;
	c.height = c.clientHeight * window.devicePixelRatio * upscaleKoeff;
	gl.viewport(0, 0, c.width, c.height);
}

async function itemToTextureLoad(file) {
	console.log(file.name);
	let textureType;
	switch(file.name[file.name.indexOf('#')+1]) {
		case '1':
			textureType = gl.TEXTURE_CUBE_MAP_POSITIVE_X;
			console.log('gl.TEXTURE_CUBE_MAP_POSITIVE_X');
			break;
		case '2':
			textureType = gl.TEXTURE_CUBE_MAP_NEGATIVE_X;
			console.log('gl.TEXTURE_CUBE_MAP_NEGATIVE_X');
			break;
		case '3':
			textureType = gl.TEXTURE_CUBE_MAP_POSITIVE_Y;
			console.log('gl.TEXTURE_CUBE_MAP_POSITIVE_Y');
			break;
		case '4':
			textureType = gl.TEXTURE_CUBE_MAP_NEGATIVE_Y;
			console.log('gl.TEXTURE_CUBE_MAP_NEGATIVE_Y');
			break;
		case '5':
			textureType = gl.TEXTURE_CUBE_MAP_POSITIVE_Z;
			console.log('gl.TEXTURE_CUBE_MAP_POSITIVE_Z');
			break;
		case '6':
			textureType = gl.TEXTURE_CUBE_MAP_NEGATIVE_Z;
			console.log('gl.TEXTURE_CUBE_MAP_NEGATIVE_Z');
			break;
		default:
			console.log('Unknown image name');
			return 1;
	}
	await loadTGAImage(textureType, file);
	return 0;
}

var x_shift_value = 0.0;
var mousePressed = false;
c.addEventListener("mousemove", function(mouseEvent){
	if (mousePressed && image_loaded){
		document.activeElement?.blur();
		x_shift_value += mouseEvent.movementX/500.0;
		x_shift_value %= (2*3.1415926538);
		x_shift_value = Math.round(x_shift_value/0.001)*0.001;
		xshift.value = x_shift_value;
		gl.uniform1f(x_shift_pos, x_shift_value);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
	}});
c.addEventListener("mousedown", function(mouseEvent) {
	mousePressed = true;
});
c.addEventListener("mouseup", function(mouseEvent) {
	mousePressed = false;
});
c.addEventListener("mouseout", function(mouseEvent) { 
	mousePressed = false;
});
xshift.addEventListener("input", function(ev) {
	if (image_loaded){
		x_shift_value = parseFloat(xshift.value);
		gl.uniform1f(x_shift_pos, x_shift_value);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
	}
});

/*
const yres_preview_input = document.getElementById('yres_preview');
yres_preview_input.addEventListener("change", function(ev) { 
	upscaleKoeff = yres_preview_input.value/c.clientHeight * window.devicePixelRatio; //костыль, лень менять
	configureWebgl();
});*/

const loadbutton = document.getElementById('loadbutton');
loadbutton.addEventListener("click", function(ev) {
	if (image_loaded){
		gl.uniform1i(swap_r_b, 0);
		targetTexture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, targetTexture);
		
		targetTextureHeight = document.getElementById("yres").value;
		targetTextureWidth = targetTextureHeight * 2.0;
	
		
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA,
					targetTextureWidth, targetTextureHeight, 0,
					gl.RGBA, gl.UNSIGNED_BYTE, null);
		// set the filtering so we don't need mips
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		console.log('target image created');
		// Create and bind the framebuffer
		fb = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
		 
		// attach the texture as the first color attachment
		var attachmentPoint = gl.COLOR_ATTACHMENT0;
		gl.framebufferTexture2D(
			gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, targetTexture, 0);
		console.log('framebuffer created and configured');
		gl.viewport(0, 0, targetTextureWidth, targetTextureHeight);
		
		gl.drawArrays(gl.TRIANGLES, 0, 6);
		var data = new Uint8Array(targetTextureWidth * targetTextureHeight * 4 + 18);
		
		data[2] = 2;
		data[14] = targetTextureHeight % 256;
		data[15] = (targetTextureHeight - targetTextureHeight % 256)/256;
		
		data[12] = targetTextureWidth % 256;
		data[13] = (targetTextureWidth - targetTextureWidth % 256)/256;
		data[16] = 32;
		
		gl.readPixels(0, 0, targetTextureWidth, targetTextureHeight, gl.RGBA, gl.UNSIGNED_BYTE, data, 18);
		download(data, "result.tga");
		gl.deleteTexture(targetTexture);
		gl.deleteFramebuffer(fb);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, c.width, c.height);
		gl.uniform1i(swap_r_b, 1);
	}
});

async function dropHandler(ev) {
  // Prevent default behavior (Prevent file from being opened)
	ev.preventDefault();
	console.log('recived amount of files: ' + ev.dataTransfer.items.length);

	if (ev.dataTransfer.items.length != 6){
		alert('Для создания панорамы нужно перетащить 6 изображений');
		return;
	}
	[...ev.dataTransfer.items].forEach((item, i) =>{
		if (item.kind != "file") {
			return;
		}
	})
	const files = [...ev.dataTransfer.items].map(item => item.getAsFile());
	
	//upscaleKoeff = yres_preview_input.value/c.clientWidth * window.devicePixelRatio;
	configureWebgl();
	
	let error = 0;
	error += await itemToTextureLoad(files[0]);
	error += await itemToTextureLoad(files[1]);
	error += await itemToTextureLoad(files[2]);
	error += await itemToTextureLoad(files[3]);
	error += await itemToTextureLoad(files[4]);
	error += await itemToTextureLoad(files[5]);
	
	image_loaded = true;
	
	if (error > 0){
		console.log('An error happened while loading images');
		return;
	}
		
	gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function dragOverHandler(ev) {
  ev.preventDefault();
}

function download(data, filename) {
	var file = new Blob([data]);

    if (window.navigator.msSaveOrOpenBlob) // IE10+
        window.navigator.msSaveOrOpenBlob(file, filename);
    else { // Others
        var a = document.createElement("a"),
                url = URL.createObjectURL(file);
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function() {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);  
        }, 0); 
    }
}

